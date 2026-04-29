import { buildBillingLifecycleEmail, type BillingEmailVariant } from "../_shared/email-templates.ts";
import { createEmailDispatch, hasEmailDispatch } from "../_shared/email-dispatch-log.ts";
import { createSupabaseAdminClient, corsHeaders, jsonResponse } from "../_shared/http.ts";
import { loadResendConfig, sendPlatformEmail } from "../_shared/platform-email.ts";

const supabaseAdmin = createSupabaseAdminClient();
const RENEWAL_URL = "https://delivery.overflex.cloud/admin/profile?billing=renew";

type TenantRow = {
  id: string;
  name: string | null;
  email: string | null;
  status: string | null;
  trial_ends_at: string | null;
};

type SubscriptionRow = {
  tenant_id: string;
  status: string | null;
  current_period_end: string | null;
  created_at: string | null;
};

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getEffectiveExpiryDate(trialEndsAt?: string | null, subscriptionPeriodEnd?: string | null) {
  return parseDate(subscriptionPeriodEnd ?? trialEndsAt ?? null);
}

function getDaysRemaining(expiryDate: Date) {
  return Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 3600 * 24));
}

function shouldSendSuspensionEmail(tenantStatus?: string | null, subscriptionStatus?: string | null, daysRemaining?: number | null) {
  const normalizedTenantStatus = String(tenantStatus ?? "").toLowerCase();
  const normalizedSubscriptionStatus = String(subscriptionStatus ?? "").toLowerCase();
  const manuallyBlocked = normalizedTenantStatus === "suspended" || normalizedTenantStatus === "inactive";

  if (manuallyBlocked) {
    return true;
  }

  return typeof daysRemaining === "number" && daysRemaining <= 0 && normalizedSubscriptionStatus !== "active";
}

function getReminderVariant(input: {
  tenantStatus?: string | null;
  subscriptionStatus?: string | null;
  daysRemaining?: number | null;
}): BillingEmailVariant | null {
  if (shouldSendSuspensionEmail(input.tenantStatus, input.subscriptionStatus, input.daysRemaining)) {
    return "access_suspended";
  }

  if (input.daysRemaining === 3) {
    return "reminder_3d";
  }

  if (input.daysRemaining === 1) {
    return "reminder_1d";
  }

  return null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!["POST", "GET"].includes(request.method)) {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  try {
    const [tenantsResult, subscriptionsResult, resendConfig] = await Promise.all([
      supabaseAdmin
        .from("tenants")
        .select("id, name, email, status, trial_ends_at")
        .not("email", "is", null),
      supabaseAdmin
        .from("tenant_subscriptions")
        .select("tenant_id, status, current_period_end, created_at")
        .order("created_at", { ascending: false }),
      loadResendConfig(supabaseAdmin),
    ]);

    if (tenantsResult.error) throw tenantsResult.error;
    if (subscriptionsResult.error) throw subscriptionsResult.error;

    const latestSubscriptionByTenant = new Map<string, SubscriptionRow>();

    for (const subscription of (subscriptionsResult.data ?? []) as SubscriptionRow[]) {
      if (!latestSubscriptionByTenant.has(subscription.tenant_id)) {
        latestSubscriptionByTenant.set(subscription.tenant_id, subscription);
      }
    }

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const tenant of (tenantsResult.data ?? []) as TenantRow[]) {
      const subscription = latestSubscriptionByTenant.get(tenant.id);
      const expiryDate = getEffectiveExpiryDate(tenant.trial_ends_at, subscription?.current_period_end);

      if (!expiryDate || !tenant.email) {
        skipped += 1;
        continue;
      }

      const daysRemaining = getDaysRemaining(expiryDate);
      const variant = getReminderVariant({
        tenantStatus: tenant.status,
        subscriptionStatus: subscription?.status,
        daysRemaining,
      });

      if (!variant) {
        skipped += 1;
        continue;
      }

      const eventKey = `${variant}:${expiryDate.toISOString().slice(0, 10)}`;
      const alreadySent = await hasEmailDispatch(supabaseAdmin, tenant.id, variant, eventKey);

      if (alreadySent) {
        skipped += 1;
        continue;
      }

      try {
        const emailPayload = buildBillingLifecycleEmail({
          variant,
          storeName: tenant.name ?? "sua loja",
          renewalUrl: RENEWAL_URL,
        });

        await sendPlatformEmail(resendConfig, {
          to: tenant.email,
          subject: emailPayload.subject,
          html: emailPayload.html,
          text: emailPayload.text,
        });

        await createEmailDispatch(supabaseAdmin, {
          tenantId: tenant.id,
          recipientEmail: tenant.email,
          eventType: variant,
          eventKey,
          metadata: {
            daysRemaining,
            expiryDate: expiryDate.toISOString(),
          },
        });

        processed += 1;
      } catch (tenantError) {
        failed += 1;
        console.error("check-expirations tenant dispatch failed", {
          tenantId: tenant.id,
          email: tenant.email,
          variant,
          error: tenantError,
        });
      }
    }

    return jsonResponse({
      success: true,
      processed,
      skipped,
      failed,
    });
  } catch (error) {
    console.error("check-expirations unexpected error", error);
    return jsonResponse({ error: "Erro interno ao processar a régua de expiração." }, 500);
  }
});



