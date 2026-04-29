import { createClient } from "npm:@supabase/supabase-js@2";
import { buildBillingLifecycleEmail } from "../_shared/email-templates.ts";
import { createEmailDispatch, hasEmailDispatch } from "../_shared/email-dispatch-log.ts";
import { loadResendConfig, sendPlatformEmail } from "../_shared/platform-email.ts";
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
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const RENEWAL_URL = "https://delivery.overflex.cloud/admin/profile";

type AsaasPaymentPayload = {
  id?: string | null;
  customer?: string | null;
  value?: number | null;
  billingType?: string | null;
  clientPaymentDate?: string | null;
  dueDate?: string | null;
};

type AsaasWebhookPayload = {
  event?: string;
  payment?: AsaasPaymentPayload;
};

type BillingHistoryRow = {
  id: string;
  status: string | null;
  updated_at: string | null;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function okResponse() {
  return new Response("ok", {
    status: 200,
    headers: corsHeaders,
  });
}

function addDaysFromBase(baseDate: Date, days: number) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function getBillingDays(value?: number | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("ok", { status: 405, headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new HttpError(500, "Secrets obrigatórios ausentes na Edge Function.");
    }

    const body = (await request.json()) as AsaasWebhookPayload;
    const event = body.event ?? "";
    const payment = body.payment ?? {};
    const customer = payment.customer ?? null;
    const paymentId = String(payment.id ?? "").trim() || null;

    if (!["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(event)) {
      return okResponse();
    }

    if (!customer || !paymentId) {
      return okResponse();
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, name, email, plan_id, trial_ends_at")
      .eq("asaas_customer_id", customer)
      .maybeSingle();

    if (tenantError) {
      throw new HttpError(500, "Falha ao localizar o tenant do webhook.");
    }

    if (!tenant) {
      return okResponse();
    }

    const { data: subscriptionRows, error: subscriptionError } = await supabaseAdmin
      .from("tenant_subscriptions")
      .select("id, plan_id, status, current_period_start, current_period_end, created_at, updated_at")
      .eq("tenant_id", tenant.id)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false });

    if (subscriptionError) {
      throw new HttpError(500, "Falha ao localizar a assinatura do tenant.");
    }

    const subscription = selectCurrentSubscription(subscriptionRows ?? []);

    const planId = subscription?.plan_id ?? tenant.plan_id ?? null;
    let planName = "Plano";
    let billingDays = 30;

    if (planId) {
      const { data: plan, error: planError } = await supabaseAdmin
        .from("plans")
        .select("name, billing_days")
        .eq("id", planId)
        .maybeSingle();

      if (planError) {
        throw new HttpError(500, "Falha ao localizar o plano do tenant.");
      }

      planName = plan?.name ?? "Plano";
      billingDays = getBillingDays(plan?.billing_days);
    }

    const amount = Number(payment.value ?? 0);
    const dueDate = payment.dueDate ?? null;
    const paymentMethod = payment.billingType ?? null;
    const paidAt = payment.clientPaymentDate ?? new Date().toISOString();
    const billingDescription = `Assinatura ${planName}`;

    const { data: existingBilling, error: existingBillingError } = await supabaseAdmin
      .from("tenant_billing_history")
      .select("id, status, updated_at")
      .eq("tenant_id", tenant.id)
      .eq("asaas_payment_id", paymentId)
      .maybeSingle();

    if (existingBillingError) {
      throw new HttpError(500, "Falha ao localizar histórico financeiro do tenant.");
    }

    if (existingBilling?.status === "paid") {
      return okResponse();
    }

    let billingRow: BillingHistoryRow | null = existingBilling;

    if (!billingRow) {
      const { data: insertedBilling, error: insertBillingError } = await supabaseAdmin
        .from("tenant_billing_history")
        .insert({
          tenant_id: tenant.id,
          plan_id: planId,
          amount,
          status: "pending",
          payment_method: paymentMethod,
          asaas_payment_id: paymentId,
          due_date: dueDate,
          description: billingDescription,
        })
        .select("id, status, updated_at")
        .maybeSingle();

      if (insertBillingError) {
        const duplicateKey = String((insertBillingError as { code?: string }).code ?? "") === "23505";

        if (!duplicateKey) {
          throw new HttpError(500, "Falha ao registrar o histórico financeiro do tenant.");
        }

        const { data: duplicatedBilling, error: duplicatedBillingError } = await supabaseAdmin
          .from("tenant_billing_history")
          .select("id, status, updated_at")
          .eq("tenant_id", tenant.id)
          .eq("asaas_payment_id", paymentId)
          .maybeSingle();

        if (duplicatedBillingError) {
          throw new HttpError(500, "Falha ao localizar histórico financeiro duplicado do tenant.");
        }

        if (duplicatedBilling?.status === "paid") {
          return okResponse();
        }

        billingRow = duplicatedBilling;
      } else {
        billingRow = insertedBilling;
      }
    }

    if (!billingRow?.id) {
      throw new HttpError(500, "Histórico financeiro inválido para processar pagamento.");
    }

    const claimTimestamp = new Date().toISOString();
    let claimQuery = supabaseAdmin.from("tenant_billing_history").update({ updated_at: claimTimestamp }).eq("id", billingRow.id);

    if (billingRow.updated_at) {
      claimQuery = claimQuery.eq("updated_at", billingRow.updated_at);
    } else {
      claimQuery = claimQuery.is("updated_at", null);
    }

    const { data: claimedBilling, error: claimError } = await claimQuery.select("id").maybeSingle();

    if (claimError) {
      throw new HttpError(500, "Falha ao garantir idempotência do pagamento.");
    }

    if (!claimedBilling) {
      return okResponse();
    }

    const now = new Date();
    const carryOverCandidates = [
      ...(subscriptionRows ?? []).map((row) => row.current_period_end),
      tenant.trial_ends_at,
    ];
    const baseDate = resolveCarryOverBaseDateFromCandidates(now, carryOverCandidates);
    const nextPeriodEnd = addDaysFromBase(baseDate, billingDays);

    const subscriptionPatch = {
      tenant_id: tenant.id,
      plan_id: planId,
      status: "active" as const,
      current_period_start: baseDate.toISOString(),
      current_period_end: nextPeriodEnd,
    };

    if (subscription?.id) {
      const { error: updateSubscriptionError } = await supabaseAdmin
        .from("tenant_subscriptions")
        .update(subscriptionPatch)
        .eq("id", subscription.id);

      if (updateSubscriptionError) {
        throw new HttpError(500, "Falha ao atualizar vigência da assinatura do tenant.");
      }
    } else {
      const { error: insertSubscriptionError } = await supabaseAdmin
        .from("tenant_subscriptions")
        .insert(subscriptionPatch);

      if (insertSubscriptionError) {
        throw new HttpError(500, "Falha ao criar assinatura local do tenant.");
      }
    }

    const { error: updateTenantError } = await supabaseAdmin
      .from("tenants")
      .update({
        status: "active",
        plan_id: planId,
        trial_ends_at: null,
      })
      .eq("id", tenant.id);

    if (updateTenantError) {
      throw new HttpError(500, "Falha ao reativar o tenant via webhook.");
    }

    const { error: finalizeBillingError } = await supabaseAdmin
      .from("tenant_billing_history")
      .update({
        tenant_id: tenant.id,
        plan_id: planId,
        amount,
        status: "paid",
        payment_method: paymentMethod,
        asaas_payment_id: paymentId,
        paid_at: paidAt,
        due_date: dueDate,
        description: billingDescription,
      })
      .eq("id", billingRow.id);

    if (finalizeBillingError) {
      throw new HttpError(500, "Falha ao atualizar o histórico financeiro do tenant.");
    }

    if (tenant.email) {
      const renewalEventKey = `renewal_completed:${paymentId}`;
      const alreadySentRenewalEmail = await hasEmailDispatch(
        supabaseAdmin,
        tenant.id,
        "renewal_completed",
        renewalEventKey,
      );

      if (!alreadySentRenewalEmail) {
        try {
          const resendConfig = await loadResendConfig(supabaseAdmin);
          const renewalEmail = buildBillingLifecycleEmail({
            variant: "renewal_completed",
            storeName: tenant.name ?? "sua loja",
            renewalUrl: RENEWAL_URL,
          });

          await sendPlatformEmail(resendConfig, {
            to: tenant.email,
            subject: renewalEmail.subject,
            html: renewalEmail.html,
            text: renewalEmail.text,
          });

          await createEmailDispatch(supabaseAdmin, {
            tenantId: tenant.id,
            recipientEmail: tenant.email,
            eventType: "renewal_completed",
            eventKey: renewalEventKey,
            metadata: {
              paymentId,
              event,
              paidAt,
            },
          });
        } catch (emailError) {
          console.error("asaas-webhook renewal email side effect failed", emailError);
        }
      }
    }

    return okResponse();
  } catch (error) {
    console.error("asaas-webhook unexpected error", error);
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
});



