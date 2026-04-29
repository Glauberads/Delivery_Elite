import {
  HttpError,
  corsHeaders,
  createSupabaseAdminClient,
  getSupabaseEnv,
  jsonResponse,
} from "../_shared/http.ts";

type BillingStatusPayload = {
  tenant_id?: string;
};

type AuthUserResponse = {
  id: string;
};

const supabaseAdmin = createSupabaseAdminClient();

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw new HttpError(401, "Token de autenticação ausente.");
  }

  return authorization.slice(7).trim();
}

async function getAuthenticatedUser(accessToken: string) {
  const { url, serviceRoleKey } = getSupabaseEnv();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new HttpError(401, "Sessão inválida para consultar a assinatura.");
  }

  return (await response.json()) as AuthUserResponse;
}

async function ensureTenantAccess(userId: string, tenantId: string) {
  const [superadminResult, tenantUserResult] = await Promise.all([
    supabaseAdmin.from("superadmin_users").select("id").eq("id", userId).maybeSingle(),
    supabaseAdmin
      .from("tenant_users")
      .select("tenant_id, active")
      .eq("id", userId)
      .eq("active", true)
      .maybeSingle(),
  ]);

  if (superadminResult.error) {
    throw new HttpError(500, "Falha ao validar o superadmin autenticado.");
  }

  if (tenantUserResult.error) {
    throw new HttpError(500, "Falha ao validar o tenant autenticado.");
  }

  if (superadminResult.data) {
    return;
  }

  if (!tenantUserResult.data || tenantUserResult.data.tenant_id !== tenantId) {
    throw new HttpError(403, "Você não tem permissão para consultar este tenant.");
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  try {
    const payload = (await request.json().catch(() => ({}))) as BillingStatusPayload;
    const tenantId = String(payload.tenant_id ?? "").trim();

    if (!isUuid(tenantId)) {
      throw new HttpError(400, "tenant_id inválido.");
    }

    const accessToken = getBearerToken(request);
    const user = await getAuthenticatedUser(accessToken);

    if (!user?.id) {
      throw new HttpError(401, "Usuário autenticado inválido.");
    }

    await ensureTenantAccess(user.id, tenantId);

    const [tenantResult, subscriptionResult] = await Promise.all([
      supabaseAdmin
        .from("tenants")
        .select("status, trial_ends_at")
        .eq("id", tenantId)
        .maybeSingle(),
      supabaseAdmin
        .from("tenant_subscriptions")
        .select("status, current_period_end")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (tenantResult.error) {
      throw new HttpError(500, "Falha ao consultar status do tenant.", tenantResult.error);
    }

    if (subscriptionResult.error) {
      throw new HttpError(500, "Falha ao consultar status da assinatura.", subscriptionResult.error);
    }

    const tenantStatus = tenantResult.data?.status ?? null;
    const subscriptionStatus = subscriptionResult.data?.status ?? null;
    const normalizedTenantStatus = String(tenantStatus ?? "").toLowerCase();
    const normalizedSubscriptionStatus = String(subscriptionStatus ?? "").toLowerCase();
    const status = normalizedTenantStatus || normalizedSubscriptionStatus || null;

    return jsonResponse({
      status,
      tenantStatus,
      subscriptionStatus,
      trialEndsAt: tenantResult.data?.trial_ends_at ?? null,
      currentPeriodEnd: subscriptionResult.data?.current_period_end ?? null,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message, details: error.body }, error.status);
    }

    console.error("check-tenant-billing-status unexpected error", error);
    return jsonResponse({ error: "Erro interno ao consultar status financeiro." }, 500);
  }
});



