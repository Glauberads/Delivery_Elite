import {
  loadResendConfig,
  sendPlatformEmail,
} from "../_shared/platform-email.ts";
import {
  HttpError,
  corsHeaders,
  createSupabaseAdminClient,
  getSupabaseEnv,
  isValidEmail,
  jsonResponse,
} from "../_shared/http.ts";

type TestEmailPayload = {
  targetEmail?: string;
  accessToken?: string;
};

type AuthUserResponse = {
  id: string;
  email: string;
};

const supabaseAdmin = createSupabaseAdminClient();

function getBearerToken(request: Request, payload?: TestEmailPayload) {
  const bodyToken = String(payload?.accessToken ?? "").trim();

  if (bodyToken) {
    return bodyToken;
  }

  const customToken = request.headers.get("x-user-jwt");

  if (customToken && customToken.trim().length > 0) {
    return customToken.trim();
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
    throw new HttpError(401, "Sessão inválida para testar o envio de e-mail.");
  }

  return (await response.json()) as AuthUserResponse;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }
  try {
    const payload = (await request.json().catch(() => ({}))) as TestEmailPayload;
    const accessToken = getBearerToken(request, payload);
    const user = await getAuthenticatedUser(accessToken);

    if (!user?.id || !user.email) {
      throw new HttpError(401, "Usuário autenticado sem e-mail disponível.");
    }

    const targetEmail = String(payload.targetEmail ?? user.email).trim().toLowerCase();

    if (!isValidEmail(targetEmail)) {
      throw new HttpError(400, "E-mail de destino inválido para o teste.");
    }

    const { data: superadmin, error: superadminError } = await supabaseAdmin
      .from("superadmin_users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (superadminError) {
      throw new HttpError(500, "Falha ao validar o superadmin autenticado.");
    }

    if (!superadmin) {
      throw new HttpError(403, "Apenas superadmins podem testar o envio de e-mail.");
    }

    const resendConfig = await loadResendConfig(supabaseAdmin);

    await sendPlatformEmail(resendConfig, {
      to: targetEmail,
      subject: "Teste de Email - VipDelivery",
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <h2 style="margin-bottom: 8px;">Teste de envio concluído</h2>
          <p>Este é um e-mail de teste do <strong>VipDelivery</strong>.</p>
          <p>Se você recebeu esta mensagem, a configuração do Resend está funcionando corretamente.</p>
        </div>
      `,
      text: "Teste de envio concluido.\n\nEste e-mail confirma que a configuracao do Resend do VipDelivery esta funcionando corretamente.",
    });

    return jsonResponse({
      success: true,
      message: `E-mail enviado com sucesso para ${targetEmail}!`,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(
        error.body ?? { error: error.message },
        error.status,
      );
    }

    console.error("send-test-email unexpected error", error);
    return jsonResponse({ error: "Erro interno ao testar o envio de e-mail." }, 500);
  }
});



