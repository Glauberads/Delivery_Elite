import { loadAsaasConfig } from "../_shared/platform-settings.ts";
import {
  HttpError,
  corsHeaders,
  createSupabaseAdminClient,
  getSupabaseEnv,
  jsonResponse,
} from "../_shared/http.ts";

type HealthCheckPayload = {
  accessToken?: string;
};

type AuthUserResponse = {
  id: string;
  email: string;
};

const ASAAS_SANDBOX_CUSTOMERS_URL = "https://sandbox.asaas.com/api/v3/customers?limit=1";
const supabaseAdmin = createSupabaseAdminClient();

function getBearerToken(request: Request, payload?: HealthCheckPayload) {
  const bodyToken = String(payload?.accessToken ?? "").trim();

  if (bodyToken) {
    return bodyToken;
  }

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
    throw new HttpError(401, "Sessão inválida para validar a integração do Asaas.");
  }

  return (await response.json()) as AuthUserResponse;
}

async function ensureSuperadmin(userId: string) {
  const { data: superadmin, error } = await supabaseAdmin
    .from("superadmin_users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Falha ao validar o superadmin autenticado.");
  }

  if (!superadmin) {
    throw new HttpError(403, "Apenas superadmins podem validar a integração do Asaas.");
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
    const payload = (await request.json().catch(() => ({}))) as HealthCheckPayload;
    const accessToken = getBearerToken(request, payload);
    const user = await getAuthenticatedUser(accessToken);

    if (!user?.id) {
      throw new HttpError(401, "Usuário autenticado inválido.");
    }

    await ensureSuperadmin(user.id);

    const asaasConfig = await loadAsaasConfig(supabaseAdmin);
    const response = await fetch(ASAAS_SANDBOX_CUSTOMERS_URL, {
      method: "GET",
      headers: {
        accept: "application/json",
        access_token: asaasConfig.apiKey,
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      return jsonResponse(
        {
          connected: false,
          status: response.status,
          error: errorBody,
        },
        200,
      );
    }

    return jsonResponse({
      connected: true,
      status: response.status,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ connected: false, error: error.message }, error.status);
    }

    console.error("check-asaas-health unexpected error", error);
    return jsonResponse({ connected: false, error: "Erro interno ao validar a integração do Asaas." }, 500);
  }
});



