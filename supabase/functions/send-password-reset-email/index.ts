import { buildPasswordRecoveryEmail } from "../_shared/email-templates.ts";
import { createEmailDispatch, hasRecentEmailDispatch } from "../_shared/email-dispatch-log.ts";
import {
  HttpError,
  corsHeaders,
  createSupabaseAdminClient,
  getSupabaseEnv,
  isValidEmail,
  jsonResponse,
  resolveAllowedRedirectUrl,
} from "../_shared/http.ts";
import { loadResendConfig, sendPlatformEmail } from "../_shared/platform-email.ts";

type PasswordRecoveryPayload = {
  email?: string;
  redirectTo?: string;
};

const supabaseAdmin = createSupabaseAdminClient();

function getResetUrl(redirectTo?: string | null) {
  return resolveAllowedRedirectUrl(redirectTo, "https://delivery.overflex.cloud/reset-password");
}

async function generateRecoveryUrl(email: string, redirectTo?: string | null) {
  const { url, serviceRoleKey } = getSupabaseEnv();
  const response = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "recovery",
      email,
      redirect_to: getResetUrl(redirectTo),
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new HttpError(
      response.status >= 400 && response.status < 500 ? response.status : 502,
      "Nao foi possivel gerar o link de recuperacao no Supabase.",
      payload,
    );
  }

  const actionLink =
    payload && typeof payload === "object" && "action_link" in payload
      ? String((payload as { action_link?: unknown }).action_link ?? "").trim()
      : "";

  if (!actionLink) {
    throw new HttpError(500, "O Supabase nao retornou um link de recuperacao valido.");
  }

  return actionLink;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  try {
    const payload = (await request.json().catch(() => ({}))) as PasswordRecoveryPayload;
    const email = String(payload.email ?? "").trim().toLowerCase();

    if (!isValidEmail(email)) {
      throw new HttpError(400, "Informe um e-mail válido para continuar.");
    }

    const { data: tenantUser, error: tenantUserError } = await supabaseAdmin
      .from("tenant_users")
      .select("id, tenant_id, email, active")
      .eq("email", email)
      .eq("active", true)
      .maybeSingle();

    if (tenantUserError) {
      throw new HttpError(500, "Falha ao localizar o usuário para recuperação de senha.");
    }

    if (!tenantUser?.tenant_id) {
      return jsonResponse({
        success: true,
        message: "Se existir uma conta vinculada a este e-mail, enviaremos as instruções em instantes.",
      });
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, name, email")
      .eq("id", tenantUser.tenant_id)
      .maybeSingle();

    if (tenantError) {
      throw new HttpError(500, "Falha ao localizar o tenant para recuperação de senha.");
    }

    if (!tenant) {
      return jsonResponse({
        success: true,
        message: "Se existir uma conta vinculada a este e-mail, enviaremos as instruções em instantes.",
      });
    }

    const isThrottled = await hasRecentEmailDispatch(
      supabaseAdmin,
      tenant.id,
      "password_recovery",
      15,
    );

    if (isThrottled) {
      return jsonResponse({
        success: true,
        message: "Se existir uma conta vinculada a este e-mail, enviaremos as instruções em instantes.",
      });
    }

    const recoveryLink = await generateRecoveryUrl(email, payload.redirectTo);
    const resendConfig = await loadResendConfig(supabaseAdmin);
    const recoveryEmail = buildPasswordRecoveryEmail({
      storeName: tenant.name ?? "sua loja",
      recoveryUrl: recoveryLink,
    });

    console.log("Enviando para:", email, "Link:", recoveryLink);

    await sendPlatformEmail(resendConfig, {
      to: email,
      subject: recoveryEmail.subject,
      html: recoveryEmail.html,
      text: recoveryEmail.text,
    });

    await createEmailDispatch(supabaseAdmin, {
      tenantId: tenant.id,
      recipientEmail: email,
      eventType: "password_recovery",
      eventKey: `password_recovery:${new Date().toISOString()}`,
      metadata: {
        requestedEmail: email,
      },
    });

    return jsonResponse({
      success: true,
      message: "Se existir uma conta vinculada a este e-mail, enviaremos as instruções em instantes.",
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.body ?? { error: error.message }, error.status);
    }

    console.error("send-password-reset-email unexpected error", error);
    return jsonResponse({ error: "Erro interno ao processar a recuperação de senha." }, 500);
  }
});



