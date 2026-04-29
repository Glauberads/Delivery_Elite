import { loadAsaasConfig } from "../_shared/platform-settings.ts";
import {
  HttpError,
  corsHeaders,
  createSupabaseAdminClient,
  getSupabaseEnv,
  jsonResponse,
} from "../_shared/http.ts";
import { selectCurrentSubscription } from "../_shared/subscription-period.ts";

type BillingType = "PIX" | "CREDIT_CARD";

type CreditCard = {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
};

type CreateAsaasSubscriptionPayload = {
  tenant_id?: string;
  plan_id?: string;
  billingType?: BillingType;
  creditCard?: CreditCard;
};

type AuthUserResponse = {
  id: string;
  email: string;
  user_metadata?: {
    cpf_cnpj?: string | null;
    cpfCnpj?: string | null;
    [key: string]: unknown;
  } | null;
};

type AsaasErrorItem = {
  code?: string;
  description?: string;
};

type AsaasCustomerResponse = {
  id: string;
};

type AsaasSubscriptionResponse = {
  id: string;
  status?: string | null;
};

type AsaasPayment = {
  id: string;
  status?: string | null;
  invoiceUrl?: string | null;
  dueDate?: string | null;
};

type AsaasListResponse<T> = {
  data?: T[];
};

type AsaasPixQrCodeResponse = {
  encodedImage: string;
  payload: string;
  expirationDate?: string | null;
};

const supabaseAdmin = createSupabaseAdminClient();

function digitsOnly(value?: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

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
    throw new HttpError(401, "Sessão inválida para iniciar a assinatura.");
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
    throw new HttpError(403, "Você não tem permissão para criar a assinatura deste tenant.");
  }
}

function getAsaasBaseUrl(environment: "sandbox" | "production") {
  return environment === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
}

function getSaoPauloDate() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") ?? "127.0.0.1";
}

function mapPlanCycle(value?: string | null) {
  switch (String(value ?? "").toLowerCase()) {
    case "quarterly":
      return "QUARTERLY";
    case "annual":
      return "YEARLY";
    default:
      return "MONTHLY";
  }
}

function normalizeSubscriptionStatus(status?: string | null): "active" | "past_due" | "canceled" | "trialing" {
  switch ((status ?? "").toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "OVERDUE":
    case "PAST_DUE":
      return "past_due";
    case "INACTIVE":
    case "CANCELED":
      return "canceled";
    default:
      return "trialing";
  }
}

function buildAsaasErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "Falha ao processar a assinatura no Asaas.";
  }

  const candidate = payload as { errors?: AsaasErrorItem[]; message?: string };

  if (Array.isArray(candidate.errors) && candidate.errors.length > 0) {
    return candidate.errors.map((item) => item.description || item.code || "Erro no Asaas").join(" | ");
  }

  return candidate.message || "Falha ao processar a assinatura no Asaas.";
}

async function asaasRequest<T>(baseUrl: string, apiKey: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      access_token: apiKey,
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new HttpError(response.status, buildAsaasErrorMessage(data), data);
  }

  return data as T;
}

async function getFirstSubscriptionPayment(baseUrl: string, apiKey: string, subscriptionId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const payments = await asaasRequest<AsaasListResponse<AsaasPayment>>(
      baseUrl,
      apiKey,
      `/subscriptions/${subscriptionId}/payments`,
      { method: "GET" },
    );

    const firstPayment = (payments.data ?? [])
      .slice()
      .sort((left, right) => String(left.dueDate ?? "").localeCompare(String(right.dueDate ?? "")))[0];

    if (firstPayment?.id) {
      return firstPayment;
    }

    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  return null;
}

function validatePayload(payload: CreateAsaasSubscriptionPayload) {
  const tenantId = String(payload.tenant_id ?? "").trim();
  const planId = String(payload.plan_id ?? "").trim();
  const billingType = String(payload.billingType ?? "").trim().toUpperCase();

  if (!isUuid(tenantId)) {
    throw new HttpError(400, "tenant_id inválido.");
  }

  if (!isUuid(planId)) {
    throw new HttpError(400, "plan_id inválido.");
  }

  if (!["PIX", "CREDIT_CARD"].includes(billingType)) {
    throw new HttpError(400, "billingType inválido.");
  }

  if (billingType === "CREDIT_CARD") {
    const card = payload.creditCard;

    if (!card) {
      throw new HttpError(400, "Dados do cartão obrigatórios para pagamento com cartão.");
    }

    if (!card.holderName || !card.number || !card.expiryMonth || !card.expiryYear || !card.ccv) {
      throw new HttpError(400, "Dados do cartão incompletos.");
    }
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
    const payload = (await request.json().catch(() => ({}))) as CreateAsaasSubscriptionPayload;
    validatePayload(payload);

    const tenantId = String(payload.tenant_id ?? "").trim();
    const planId = String(payload.plan_id ?? "").trim();
    const billingType = String(payload.billingType ?? "").trim().toUpperCase() as BillingType;

    const accessToken = getBearerToken(request);
    const user = await getAuthenticatedUser(accessToken);

    if (!user?.id) {
      throw new HttpError(401, "Usuário autenticado inválido.");
    }

    await ensureTenantAccess(user.id, tenantId);

    const asaasConfig = await loadAsaasConfig(supabaseAdmin);
    const asaasBaseUrl = getAsaasBaseUrl(asaasConfig.environment);

    const [tenantResult, subscriptionResult] = await Promise.all([
      supabaseAdmin
        .from("tenants")
        .select("id, name, email, phone, cpf_cnpj, asaas_customer_id")
        .eq("id", tenantId)
        .maybeSingle(),
      supabaseAdmin
        .from("tenant_subscriptions")
        .select("id, status, current_period_start, current_period_end, created_at, updated_at")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false }),
    ]);

    if (tenantResult.error) {
      throw new HttpError(500, "Falha ao consultar tenant.", tenantResult.error);
    }

    if (!tenantResult.data) {
      throw new HttpError(404, "Tenant não encontrado.");
    }

    if (subscriptionResult.error) {
      throw new HttpError(500, "Falha ao consultar assinatura local.", subscriptionResult.error);
    }

    const subscription = selectCurrentSubscription(subscriptionResult.data ?? []);

    const { data: plan, error: planError } = await supabaseAdmin
      .from("plans")
      .select("id, name, price, type, active")
      .eq("id", planId)
      .eq("active", true)
      .maybeSingle();

    if (planError) {
      throw new HttpError(500, "Falha ao consultar plano.", planError);
    }

    if (!plan) {
      throw new HttpError(404, "Plano não encontrado ou inativo.");
    }

    const tenantDocument = digitsOnly((tenantResult.data as { cpf_cnpj?: string | null }).cpf_cnpj ?? null);
    const metadataDocument = digitsOnly(
      (user.user_metadata?.cpf_cnpj ?? user.user_metadata?.cpfCnpj ?? null) as string | null,
    );
    const documentSource = [tenantDocument, metadataDocument].find((value) => [11, 14].includes(value.length)) ?? "";
    const hasValidDocument = [11, 14].includes(documentSource.length);
    const document = hasValidDocument ? documentSource : "";

    // Reidrata tenants.cpf_cnpj com o documento já capturado no signup (metadata),
    // evitando perda do dado para os próximos pagamentos.
    if (hasValidDocument && tenantDocument !== document) {
      const { error: syncTenantDocumentError } = await supabaseAdmin
        .from("tenants")
        .update({ cpf_cnpj: document })
        .eq("id", tenantId);

      if (syncTenantDocumentError) {
        throw new HttpError(500, "Falha ao sincronizar CPF/CNPJ do tenant.", syncTenantDocumentError);
      }
    }

    let asaasCustomerId = tenantResult.data.asaas_customer_id;

    if (!asaasCustomerId) {
      const customer = await asaasRequest<AsaasCustomerResponse>(asaasBaseUrl, asaasConfig.apiKey, "/customers", {
        method: "POST",
        body: JSON.stringify({
          name: tenantResult.data.name,
          email: tenantResult.data.email,
          ...(hasValidDocument ? { cpfCnpj: document } : {}),
        }),
      });

      asaasCustomerId = customer.id;

      const { error: updateTenantError } = await supabaseAdmin
        .from("tenants")
        .update({ asaas_customer_id: asaasCustomerId })
        .eq("id", tenantId);

      if (updateTenantError) {
        throw new HttpError(500, "Falha ao salvar asaas_customer_id no tenant.", updateTenantError);
      }
    } else if (hasValidDocument) {
      // Garante que customers legados também recebam o documento já salvo no tenant.
      await asaasRequest<AsaasCustomerResponse>(asaasBaseUrl, asaasConfig.apiKey, `/customers/${asaasCustomerId}`, {
        method: "POST",
        body: JSON.stringify({
          name: tenantResult.data.name,
          email: tenantResult.data.email,
          cpfCnpj: document,
        }),
      });
    }

    const basePrice = Number(plan.price);
    const finalPrice = billingType === "CREDIT_CARD" ? Number((basePrice * 0.95).toFixed(2)) : basePrice;

    const subscriptionBody = {
      customer: asaasCustomerId,
      billingType,
      cycle: mapPlanCycle(plan.type),
      nextDueDate: getSaoPauloDate(),
      value: finalPrice,
      description: `Assinatura ${plan.name}`,
      externalReference: tenantId,
      ...(billingType === "CREDIT_CARD"
        ? {
            creditCard: {
              holderName: payload.creditCard?.holderName,
              number: digitsOnly(payload.creditCard?.number),
              expiryMonth: digitsOnly(payload.creditCard?.expiryMonth),
              expiryYear: digitsOnly(payload.creditCard?.expiryYear),
              ccv: digitsOnly(payload.creditCard?.ccv),
            },
            creditCardHolderInfo: {
              name: tenantResult.data.name,
              email: tenantResult.data.email,
              ...(hasValidDocument ? { cpfCnpj: document } : {}),
              postalCode: "01001-000",
              addressNumber: "1",
              addressComplement: "Checkout Transparente",
              phone: "11999999999",
              mobilePhone: "11999999999",
            },
            remoteIp: getClientIp(request),
          }
        : {}),
    };

    const asaasSubscription = await asaasRequest<AsaasSubscriptionResponse>(
      asaasBaseUrl,
      asaasConfig.apiKey,
      "/subscriptions",
      {
        method: "POST",
        body: JSON.stringify(subscriptionBody),
      },
    );

    const firstPayment = await getFirstSubscriptionPayment(asaasBaseUrl, asaasConfig.apiKey, asaasSubscription.id);

    const subscriptionPatch = {
      tenant_id: tenantId,
      plan_id: plan.id,
      status: normalizeSubscriptionStatus(asaasSubscription.status),
      asaas_subscription_id: asaasSubscription.id,
      asaas_payment_link: firstPayment?.invoiceUrl ?? null,
      billing_type: billingType,
    };

    if (subscription?.id) {
      const { error: updateSubscriptionError } = await supabaseAdmin
        .from("tenant_subscriptions")
        .update(subscriptionPatch)
        .eq("id", subscription.id);

      if (updateSubscriptionError) {
        throw new HttpError(500, "Falha ao atualizar tenant_subscriptions.", updateSubscriptionError);
      }
    } else {
      const { error: insertSubscriptionError } = await supabaseAdmin
        .from("tenant_subscriptions")
        .insert(subscriptionPatch);

      if (insertSubscriptionError) {
        throw new HttpError(500, "Falha ao criar tenant_subscriptions.", insertSubscriptionError);
      }
    }

    const tenantPatch: {
      plan_id: string;
    } = {
      plan_id: plan.id,
    };

    const { error: updateTenantError } = await supabaseAdmin
      .from("tenants")
      .update(tenantPatch)
      .eq("id", tenantId);

    if (updateTenantError) {
      throw new HttpError(500, "Falha ao atualizar plano/status do tenant.", updateTenantError);
    }

    if (billingType === "PIX") {
      if (!firstPayment?.id) {
        throw new HttpError(502, "Assinatura criada, mas o QR Code Pix ainda não está disponível.");
      }

      const pixQrCode = await asaasRequest<AsaasPixQrCodeResponse>(
        asaasBaseUrl,
        asaasConfig.apiKey,
        `/payments/${firstPayment.id}/pixQrCode`,
        { method: "GET" },
      );

      return jsonResponse({
        billingType,
        subscriptionId: asaasSubscription.id,
        status: firstPayment.status ?? asaasSubscription.status ?? "PENDING",
        amount: finalPrice,
        paymentId: firstPayment.id,
        encodedImage: pixQrCode.encodedImage,
        payload: pixQrCode.payload,
        expirationDate: pixQrCode.expirationDate ?? null,
      });
    }

    const last4 = digitsOnly(payload.creditCard?.number).slice(-4);

    return jsonResponse({
      billingType,
      subscriptionId: asaasSubscription.id,
      status: firstPayment?.status ?? asaasSubscription.status ?? "CONFIRMED",
      amount: finalPrice,
      cardLast4: last4,
      approved: true,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(
        {
          error: error.message,
          details: error.body,
        },
        error.status,
      );
    }

    console.error("create-asaas-subscription unexpected error", error);
    return jsonResponse({ error: "Erro interno ao criar a assinatura no Asaas." }, 500);
  }
});



