import { createClient } from "npm:@supabase/supabase-js@2";
import { buildBillingLifecycleEmail } from "../_shared/email-templates.ts";
import { createEmailDispatch, hasEmailDispatch } from "../_shared/email-dispatch-log.ts";
import { loadResendConfig, sendPlatformEmail } from "../_shared/platform-email.ts";
import { loadAsaasConfig } from "../_shared/platform-settings.ts";
import {
  resolveCarryOverBaseDateFromCandidates,
  selectCurrentSubscription,
} from "../_shared/subscription-period.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const RENEWAL_URL = "https://app.vipdelivery.com.br/admin/profile";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);

  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index++) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}

function getAsaasBaseUrl(environment: "sandbox" | "production") {
  return environment === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
}

async function verifyAsaasPayment(baseUrl: string, apiKey: string, paymentId: string) {
  const response = await fetch(`${baseUrl}/payments/${paymentId}`, {
    method: "GET",
    headers: {
      access_token: apiKey,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, "Erro ao consultar pagamento no Asaas S2S");
  }

  return response.json();
}

async function acquireIdempotencyLock(eventId: string, hash: string, paymentId: string, eventType: string) {
  const { data, error } = await supabaseAdmin
    .from("payment_webhook_events")
    .insert({
      provider: "asaas",
      provider_event_id: eventId,
      payment_id: paymentId,
      event_type: eventType,
      payload_hash: hash,
      status: "received"
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (String(error.code) === "23505") {
      // Conflict
      return null; // Already processing or processed
    }
    throw new HttpError(500, "Erro ao adquirir lock de idempotência");
  }
  return data?.id;
}

async function markEventStatus(eventId: string, status: string, errorMsg?: string) {
  await supabaseAdmin
    .from("payment_webhook_events")
    .update({ 
      status, 
      processed_at: new Date().toISOString(),
      error_message: errorMsg 
    })
    .eq("id", eventId);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new HttpError(500, "Secrets ausentes");
    }

    const receivedToken = request.headers.get("asaas-access-token");
    if (!ASAAS_WEBHOOK_TOKEN || !receivedToken || !constantTimeEqual(receivedToken, ASAAS_WEBHOOK_TOKEN)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const bodyText = await request.text();
    const payloadHash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bodyText)))
    ).map(b => b.toString(16).padStart(2, '0')).join('');
    
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      throw new HttpError(400, "Invalid JSON");
    }

    const event = body.event;
    const payment = body.payment;
    const paymentId = payment?.id;
    const eventId = body.id || `${event}_${paymentId}_${Date.now()}`;

    if (!event || !paymentId) {
       return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const internalEventId = await acquireIdempotencyLock(eventId, payloadHash, paymentId, event);
    if (!internalEventId) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    try {
      const asaasConfig = await loadAsaasConfig(supabaseAdmin);
      const asaasBaseUrl = getAsaasBaseUrl(asaasConfig.environment);

      // Server-to-server check
      const realPayment = await verifyAsaasPayment(asaasBaseUrl, asaasConfig.apiKey, paymentId);
      
      const customerId = realPayment.customer;
      
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("id, name, email, plan_id, trial_ends_at")
        .eq("asaas_customer_id", customerId)
        .maybeSingle();

      if (!tenant) {
        await markEventStatus(internalEventId, "ignored", "Tenant não encontrado");
        return new Response("ok", { status: 200, headers: corsHeaders });
      }

      // State machine transitions
      if (["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(event)) {
        await supabaseAdmin.from("tenant_subscriptions").update({ status: "active" }).eq("tenant_id", tenant.id);
        await supabaseAdmin.from("tenant_billing_history").update({ status: "paid" }).eq("asaas_payment_id", paymentId);
      } else if (["PAYMENT_REFUNDED", "PAYMENT_DELETED"].includes(event)) {
        await supabaseAdmin.from("tenant_billing_history").update({ status: "refunded" }).eq("asaas_payment_id", paymentId);
        // Note: Real state machine should check if there are OTHER valid payments before suspending
        await supabaseAdmin.from("tenant_subscriptions").update({ status: "canceled" }).eq("tenant_id", tenant.id);
      } else if (["PAYMENT_OVERDUE", "PAYMENT_CHARGEBACK_REQUESTED"].includes(event)) {
        await supabaseAdmin.from("tenant_subscriptions").update({ status: "past_due" }).eq("tenant_id", tenant.id);
      }

      await markEventStatus(internalEventId, "processed");
      return new Response("ok", { status: 200, headers: corsHeaders });
    } catch (e: any) {
      await markEventStatus(internalEventId, "retryable_error", e.message);
      throw e;
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: error.status || 500, headers: corsHeaders });
  }
});
