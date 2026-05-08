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
  resolveAllowedRedirectUrl,
} from "../_shared/http.ts";

type SignupEmailPayload = {
  email?: string;
  password?: string;
  fullName?: string;
  storeName?: string;
  cpfCnpj?: string;
  whatsapp?: string;
  redirectTo?: string;
};

const supabaseAdmin = createSupabaseAdminClient();
const DEFAULT_SIGNUP_REDIRECT_URL = "https://delivery.overflex.cloud/admin/profile?tab=profile&onboarding=complete";
const EMAIL_LOGO_URL = "https://delivery.overflex.cloud/logo-w.png";

function getDisplayName(fullName?: string | null) {
  const normalized = String(fullName ?? "").trim();
  return normalized.length > 0 ? normalized : "sua loja";
}

function getStoreName(storeName?: string | null) {
  const normalized = String(storeName ?? "").trim();
  return normalized.length > 0 ? normalized : "sua loja";
}

function normalizeDigits(value?: string | null) {
  return String(value ?? "").replace(/\D/g, "");
}

function isValidPassword(value?: string | null) {
  return String(value ?? "").trim().length >= 6;
}

function extractSupabaseErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const candidateKeys = ["msg", "message", "error_description", "error"] as const;

  for (const key of candidateKeys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return fallback;
}

function isDuplicateSignupError(message: string) {
  return /already registered|already exists|user.*exists|duplicate/i.test(message);
}

function buildSignupMetadata(input: {
  fullName: string;
  storeName: string;
  cpfCnpj: string;
  whatsapp: string;
}) {
  return {
    signup_source: "public_register",
    full_name: input.fullName,
    cpf_cnpj: input.cpfCnpj,
    store_name: input.storeName,
    storeName: input.storeName,
    whatsapp: input.whatsapp,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildSignupEmail(input: {
  fullName: string;
  storeName: string;
  confirmationUrl: string;
}) {
  const subject = "Bem-vindo ao VIP Delivery";

  return {
    subject,
    html: `
      <div style="margin:0;padding:32px;background:#f4f4f7;font-family:Inter,Segoe UI,Arial,sans-serif;color:#f8fafc;">
        <div style="max-width:640px;margin:0 auto;border-radius:32px;overflow:hidden;background:#1a1f2e;box-shadow:0 28px 64px rgba(15,23,42,0.30);border:1px solid rgba(255,255,255,0.10);">
          <div style="padding:36px 32px 18px;background:#1a1f2e;text-align:center;">
            <img src="${EMAIL_LOGO_URL}" alt="VIP Delivery" style="display:block;width:100%;max-width:160px;height:auto;margin:0 auto 22px;" />
            <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:#475569;color:#ffffff;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">
              Boas-vindas
            </div>
            <h1 style="margin:18px 0 10px;font-size:32px;line-height:1.15;color:#f8fafc;font-weight:800;">
              Confirme seu acesso ao VIP Delivery
            </h1>
            <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.7;">
              Sua conta esta quase pronta. Falta apenas validar o acesso.
            </p>
          </div>
          <div style="padding:0 32px 32px;background:#1a1f2e;">
            <div style="padding:28px;border-radius:24px;background:#23293b;border:1px solid rgba(255,255,255,0.10);color:#f8fafc;font-size:15px;line-height:1.75;">
              <p style="margin:0 0 16px;">Ola, <strong>${escapeHtml(input.fullName)}</strong>.</p>
              <p style="margin:0 0 16px;">O cadastro da loja <strong>${escapeHtml(input.storeName)}</strong> foi iniciado com sucesso.</p>
              <p style="margin:0;">Clique no botao abaixo para validar sua conta e acessar o painel do VIP Delivery.</p>
              <div style="margin-top:28px;">
                <a href="${escapeHtml(input.confirmationUrl)}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#ef4444;color:#ffffff;text-decoration:none;font-weight:700;">
                  Validar conta e acessar
                </a>
              </div>
            </div>
            <p style="margin:18px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;text-align:center;">
              VIP Delivery · comunicacao automatizada da sua operacao SaaS.
            </p>
          </div>
        </div>
      </div>
    `,
    text: [
      subject,
      "",
      `Ola, ${input.fullName}.`,
      `O cadastro da loja ${input.storeName} foi iniciado com sucesso.`,
      "Clique no link abaixo para validar sua conta e acessar o painel do VIP Delivery:",
      input.confirmationUrl,
      "",
      "VIP Delivery",
    ].join("\n"),
  };
}

async function generateSupabaseMagicLink(input: {
  email: string;
  redirectTo?: string | null;
}): Promise<string> {
  const normalizedRedirectTo = getAccessUrl(input.redirectTo);
  const { url, serviceRoleKey } = getSupabaseEnv();
  const response = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "magiclink",
      email: input.email,
      redirect_to: normalizedRedirectTo,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const supabaseMessage = extractSupabaseErrorMessage(
      payload,
      "Nao foi possivel gerar o acesso do cadastro no Supabase.",
    );

    throw new HttpError(
      response.status >= 400 && response.status < 500 ? response.status : 502,
      supabaseMessage,
      payload,
    );
  }

  const actionLink =
    payload && typeof payload === "object" && "action_link" in payload
      ? String((payload as { action_link?: unknown }).action_link ?? "").trim()
      : "";

  if (!actionLink) {
    throw new HttpError(500, "Nao foi possivel gerar um link de confirmacao valido.");
  }

  return actionLink;
}

async function findAuthUserByEmail(email: string) {
  let page = 1;

  while (page <= 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new HttpError(500, "Falha ao listar usuarios do Auth.", error);
    }

    const users = data?.users ?? [];
    const existingUser = users.find((user) => String(user.email ?? "").trim().toLowerCase() === email);

    if (existingUser) {
      return existingUser;
    }

    if (users.length < 1000) {
      break;
    }

    page += 1;
  }

  return null;
}

async function isSignupProvisioned(userId: string) {
  const [tenantUserResult, tenantResult] = await Promise.all([
    supabaseAdmin.from("tenant_users").select("id").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("tenants").select("id").eq("created_by", userId).maybeSingle(),
  ]);

  if (tenantUserResult.error) {
    throw new HttpError(500, "Falha ao verificar tenant_users do cadastro.", tenantUserResult.error);
  }

  if (tenantResult.error) {
    throw new HttpError(500, "Falha ao verificar tenants do cadastro.", tenantResult.error);
  }

  return Boolean(tenantUserResult.data?.id || tenantResult.data?.id);
}

async function ensureSignupProvisioning(input: {
  userId: string;
  email: string;
  fullName: string;
  storeName: string;
  cpfCnpj: string;
  whatsapp: string;
}) {
  const { data, error } = await supabaseAdmin.rpc("ensure_public_signup_account", {
    p_user_id: input.userId,
    p_email: input.email,
    p_full_name: input.fullName,
    p_store_name: input.storeName,
    p_cpf_cnpj: input.cpfCnpj,
    p_whatsapp: input.whatsapp,
  });

  if (error) {
    throw new HttpError(500, "Falha ao provisionar o cadastro publico.", error);
  }

  return data;
}

async function upsertAuthUser(input: {
  email: string;
  password: string;
  fullName: string;
  storeName: string;
  cpfCnpj: string;
  whatsapp: string;
}) {
  const metadata = buildSignupMetadata(input);
  const existingUser = await findAuthUserByEmail(input.email);

  if (!existingUser) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: false,
      user_metadata: metadata,
    });

    if (error) {
      const message = extractSupabaseErrorMessage(error, "Nao foi possivel criar o usuario do cadastro.");
      if (isDuplicateSignupError(message)) {
        throw new HttpError(409, "Este e-mail ja possui cadastro. Faca login ou recupere a senha.", error);
      }

      throw new HttpError(500, message, error);
    }

    const userId = String(data.user?.id ?? "").trim();
    if (!userId) {
      throw new HttpError(500, "O Auth nao retornou um usuario valido para o cadastro.");
    }

    return userId;
  }

  const alreadyProvisioned = await isSignupProvisioned(existingUser.id);
  if (alreadyProvisioned) {
    throw new HttpError(409, "Este e-mail ja possui cadastro. Faca login ou recupere a senha.");
  }

  const mergedMetadata = {
    ...(existingUser.user_metadata ?? {}),
    ...metadata,
  };

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
    password: input.password,
    user_metadata: mergedMetadata,
  });

  if (error) {
    throw new HttpError(500, "Falha ao atualizar o usuario orfao do cadastro.", error);
  }

  const userId = String(data.user?.id ?? existingUser.id).trim();
  if (!userId) {
    throw new HttpError(500, "O Auth nao retornou um usuario valido para reparo do cadastro.");
  }

  return userId;
}

function getAccessUrl(redirectTo?: string | null) {
  return resolveAllowedRedirectUrl(redirectTo, DEFAULT_SIGNUP_REDIRECT_URL);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  let step = "parse_payload";

  try {
    const payload = (await request.json().catch(() => ({}))) as SignupEmailPayload;
    const email = String(payload.email ?? "").trim().toLowerCase();
    const password = String(payload.password ?? "");
    const fullName = getDisplayName(payload.fullName);
    const storeName = getStoreName(payload.storeName);
    const cpfCnpj = normalizeDigits(payload.cpfCnpj);
    const whatsapp = normalizeDigits(payload.whatsapp);

    if (!isValidEmail(email)) {
      throw new HttpError(400, "E-mail inválido para o envio do cadastro.");
    }

    if (!isValidPassword(password)) {
      throw new HttpError(400, "A senha precisa ter pelo menos 6 caracteres.");
    }

    if (fullName.trim().length < 3) {
      throw new HttpError(400, "Nome completo invalido para o cadastro.");
    }

    if (storeName.trim().length < 2) {
      throw new HttpError(400, "Nome da loja invalido para o cadastro.");
    }

    if (!/^(?:[0-9]{11}|[0-9]{14})$/.test(cpfCnpj)) {
      throw new HttpError(400, "CPF ou CNPJ invalido para o cadastro.");
    }

    if (!/^[0-9]{10,11}$/.test(whatsapp)) {
      throw new HttpError(400, "WhatsApp invalido para o cadastro.");
    }

    step = "upsert_auth_user";
    const userId = await upsertAuthUser({
      email,
      password,
      fullName,
      storeName,
      cpfCnpj,
      whatsapp,
    });
    step = "ensure_signup_provisioning";
    await ensureSignupProvisioning({
      userId,
      fullName,
      email,
      storeName,
      cpfCnpj,
      whatsapp,
    });
    step = "generate_magic_link";
    const actionLink = await generateSupabaseMagicLink({
      email,
      redirectTo: payload.redirectTo,
    });
    step = "load_resend_config";
    const resendConfig = await loadResendConfig(supabaseAdmin);
    step = "send_resend_email";
    const signupEmail = buildSignupEmail({
      fullName,
      storeName,
      confirmationUrl: actionLink,
    });
    await sendPlatformEmail(resendConfig, {
      to: email,
      subject: signupEmail.subject,
      html: signupEmail.html,
      text: signupEmail.text,
    });

    return jsonResponse({
      success: true,
      message: `E-mail de cadastro enviado com sucesso para ${email}!`,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      console.error("send-signup-email handled error", { step, message: error.message, status: error.status });
      return jsonResponse({ error: error.message, step, details: error.body }, error.status);
    }

    console.error("send-signup-email unexpected error", { step, error });
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro desconhecido.", step },
      500,
    );
  }
});



