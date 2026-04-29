import { createClient } from "npm:@supabase/supabase-js@2";
import { loadAsaasConfig } from "../_shared/platform-settings.ts";
import { selectCurrentSubscription } from "../_shared/subscription-period.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ASAAS_BASE_URL = "https://api.asaas.com/v3";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type BillingType = "PIX" | "CREDIT_CARD";

type CustomerData = {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
};

type CreditCard = {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
};

type CreditCardHolderInfo = {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode?: string;
  addressNumber?: string;
  addressComplement?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
};

type CheckoutPayload = {
  tenant_id: string;
  plan_id: string;
  billingType: BillingType;
  customerData: CustomerData;
  creditCard?: CreditCard;
  creditCardHolderInfo?: CreditCardHolderInfo;
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
  status?: string;
};

type AsaasPayment = {
  id: string;
  status?: string;
  invoiceUrl?: string | null;
  dueDate?: string | null;
};

type AsaasListResponse<T> = {
  data?: T[];
};

type AsaasPixQrCodeResponse = {
  encodedImage: string;
  payload: string;
  expirationDate?: string;
};

class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function digitsOnly(value?: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

  return request.headers.get("x-real-ip") ?? undefined;
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
    return "Falha ao processar pagamento no Asaas.";
  }

  const candidate = payload as { errors?: AsaasErrorItem[]; message?: string };

  if (Array.isArray(candidate.errors) && candidate.errors.length > 0) {
    return candidate.errors.map((item) => item.description || item.code || "Erro no Asaas").join(" | ");
  }

  return candidate.message || "Falha ao processar pagamento no Asaas.";
}

async function asaasRequest<T>(apiKey: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${ASAAS_BASE_URL}${path}`, {
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

async function getFirstSubscriptionPayment(apiKey: string, subscriptionId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const payments = await asaasRequest<AsaasListResponse<AsaasPayment>>(
      apiKey,
      `/subscriptions/${subscriptionId}/payments`,
      { method: "GET" },
    );

    const firstPayment = (payments.data ?? [])
      .slice()
      .sort((a, b) => String(a.dueDate ?? "").localeCompare(String(b.dueDate ?? "")))[0];

    if (firstPayment?.id) {
      return firstPayment;
    }

    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  return null;
}

function validatePayload(payload: CheckoutPayload) {
  if (!isUuid(payload.tenant_id)) {
    throw new HttpError(400, "tenant_id inválido.");
  }

  if (!isUuid(payload.plan_id)) {
    throw new HttpError(400, "plan_id inválido.");
  }

  if (!["PIX", "CREDIT_CARD"].includes(payload.billingType)) {
    throw new HttpError(400, "billingType inválido.");
  }

  if (!payload.customerData?.name || !payload.customerData?.email || !payload.customerData?.cpfCnpj) {
    throw new HttpError(400, "customerData precisa conter name, email e cpfCnpj.");
  }

  if (![11, 14].includes(digitsOnly(payload.customerData.cpfCnpj).length)) {
    throw new HttpError(400, "cpfCnpj inválido.");
  }

  if (payload.billingType === "CREDIT_CARD") {
    if (!payload.creditCard || !payload.creditCardHolderInfo) {
      throw new HttpError(400, "Dados de cartão obrigatórios para billingType CREDIT_CARD.");
    }

    if (
      !payload.creditCard.holderName ||
      !payload.creditCard.number ||
      !payload.creditCard.expiryMonth ||
      !payload.creditCard.expiryYear ||
      !payload.creditCard.ccv
    ) {
      throw new HttpError(400, "creditCard incompleto.");
    }

    if (
      !payload.creditCardHolderInfo.name ||
      !payload.creditCardHolderInfo.email ||
      !payload.creditCardHolderInfo.cpfCnpj
    ) {
      throw new HttpError(400, "creditCardHolderInfo incompleto.");
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

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Secrets obrigatórios ausentes na Edge Function." }, 500);
  }

  try {
    const asaasConfig = await loadAsaasConfig(supabaseAdmin);
    const payload = (await request.json()) as CheckoutPayload;
    validatePayload(payload);

    const { tenant_id, plan_id, billingType, customerData, creditCard, creditCardHolderInfo } = payload;

    const [tenantResult, planResult, subscriptionResult] = await Promise.all([
      supabaseAdmin
        .from("tenants")
        .select("id, name, email, phone, asaas_customer_id")
        .eq("id", tenant_id)
        .maybeSingle(),
      supabaseAdmin
        .from("plans")
        .select("id, name, price, active")
        .eq("id", plan_id)
        .eq("active", true)
        .maybeSingle(),
      supabaseAdmin
        .from("tenant_subscriptions")
        .select("id, status, current_period_start, current_period_end, created_at, updated_at")
        .eq("tenant_id", tenant_id)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false }),
    ]);

    if (tenantResult.error) {
      throw new HttpError(500, "Falha ao consultar tenant.", tenantResult.error);
    }

    if (!tenantResult.data) {
      throw new HttpError(404, "Tenant não encontrado.");
    }

    if (planResult.error) {
      throw new HttpError(500, "Falha ao consultar plano.", planResult.error);
    }

    if (!planResult.data) {
      throw new HttpError(404, "Plano não encontrado ou inativo.");
    }

    if (subscriptionResult.error) {
      throw new HttpError(500, "Falha ao consultar assinatura local.", subscriptionResult.error);
    }

    const subscription = selectCurrentSubscription(subscriptionResult.data ?? []);

    let asaasCustomerId = tenantResult.data.asaas_customer_id;

    if (!asaasCustomerId) {
      const customer = await asaasRequest<AsaasCustomerResponse>(asaasConfig.apiKey, "/customers", {
        method: "POST",
        body: JSON.stringify({
          name: customerData.name,
          email: customerData.email,
          cpfCnpj: digitsOnly(customerData.cpfCnpj),
          mobilePhone: digitsOnly(customerData.mobilePhone || customerData.phone || tenantResult.data.phone),
        }),
      });

      asaasCustomerId = customer.id;

      const { error: tenantUpdateError } = await supabaseAdmin
        .from("tenants")
        .update({ asaas_customer_id: asaasCustomerId })
        .eq("id", tenant_id);

      if (tenantUpdateError) {
        throw new HttpError(500, "Falha ao salvar asaas_customer_id no tenant.", tenantUpdateError);
      }
    }

    const asaasSubscription = await asaasRequest<AsaasSubscriptionResponse>(asaasConfig.apiKey, "/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType,
        cycle: "MONTHLY",
        nextDueDate: getSaoPauloDate(),
        value: Number(planResult.data.price),
        description: `Assinatura ${planResult.data.name}`,
        externalReference: tenant_id,
        ...(billingType === "CREDIT_CARD"
          ? {
              creditCard,
              creditCardHolderInfo: {
                ...creditCardHolderInfo,
                cpfCnpj: digitsOnly(creditCardHolderInfo?.cpfCnpj),
                postalCode: digitsOnly(creditCardHolderInfo?.postalCode),
                phone: digitsOnly(creditCardHolderInfo?.phone),
                mobilePhone: digitsOnly(creditCardHolderInfo?.mobilePhone),
              },
              remoteIp: getClientIp(request),
            }
          : {}),
      }),
    });

    const subscriptionPatch = {
      tenant_id,
      plan_id,
      status: normalizeSubscriptionStatus(asaasSubscription.status),
      asaas_subscription_id: asaasSubscription.id,
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

    const firstPayment = await getFirstSubscriptionPayment(asaasConfig.apiKey, asaasSubscription.id);

    if (billingType === "PIX") {
      if (!firstPayment?.id) {
        throw new HttpError(502, "Assinatura criada, mas o QR Code Pix ainda não está disponível.");
      }

      const pixQrCode = await asaasRequest<AsaasPixQrCodeResponse>(asaasConfig.apiKey, `/payments/${firstPayment.id}/pixQrCode`, {
        method: "GET",
      });

      return jsonResponse({
        subscriptionId: asaasSubscription.id,
        status: firstPayment.status ?? asaasSubscription.status ?? "PENDING",
        encodedImage: pixQrCode.encodedImage,
        payload: pixQrCode.payload,
        expirationDate: pixQrCode.expirationDate ?? null,
      });
    }

    const last4 = digitsOnly(creditCard?.number).slice(-4);

    return jsonResponse({
      subscriptionId: asaasSubscription.id,
      status: firstPayment?.status ?? asaasSubscription.status ?? "ACTIVE",
      cardLast4: last4,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(
        {
          error: error.message,
          details: error.details,
        },
        error.status,
      );
    }

    console.error("create-checkout unexpected error", error);

    return jsonResponse({ error: "Erro interno ao criar checkout." }, 500);
  }
});



