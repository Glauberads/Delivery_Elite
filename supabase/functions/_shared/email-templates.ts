function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const EMAIL_LOGO_URL = "https://delivery.overflex.cloud/logo-w.png";
const EMAIL_OUTER_BG = "#f4f4f7";
const EMAIL_BG = "#1a1f2e";
const EMAIL_CARD = "#23293b";
const EMAIL_BORDER = "rgba(255,255,255,0.10)";
const EMAIL_TEXT = "#f8fafc";
const EMAIL_MUTED = "#cbd5e1";
const EMAIL_SUBTLE = "#94a3b8";

type BuiltEmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

type EmailFrameInput = {
  eyebrow: string;
  title: string;
  subtitle: string;
  bodyHtml: string;
  accentColor?: string;
  badgeColor?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerText?: string;
};

function renderEmailFrame({
  eyebrow,
  title,
  subtitle,
  bodyHtml,
  accentColor = "#ef4444",
  badgeColor = "rgba(255,255,255,0.08)",
  ctaLabel,
  ctaUrl,
  footerText,
}: EmailFrameInput) {
  const ctaBlock =
    ctaLabel && ctaUrl
      ? `
        <div style="margin-top: 28px;">
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:${accentColor};color:#ffffff;text-decoration:none;font-weight:700;">
            ${escapeHtml(ctaLabel)}
          </a>
        </div>
      `
      : "";

  return `
    <div style="margin:0;padding:32px;background:${EMAIL_OUTER_BG};font-family:Inter,Segoe UI,Arial,sans-serif;color:${EMAIL_TEXT};">
      <div style="max-width:640px;margin:0 auto;border-radius:32px;overflow:hidden;background:${EMAIL_BG};box-shadow:0 28px 64px rgba(15,23,42,0.30);border:1px solid ${EMAIL_BORDER};">
        <div style="padding:36px 32px 18px;background:${EMAIL_BG};text-align:center;">
          <img src="${EMAIL_LOGO_URL}" alt="Delivery MAX" style="display:block;width:100%;max-width:160px;height:auto;margin:0 auto 22px;" />
          <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:${badgeColor};color:#ffffff;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">
            ${escapeHtml(eyebrow)}
          </div>
          <h1 style="margin:18px 0 10px;font-size:32px;line-height:1.15;color:${EMAIL_TEXT};font-weight:800;">
            ${escapeHtml(title)}
          </h1>
          <p style="margin:0;color:${EMAIL_MUTED};font-size:15px;line-height:1.7;">
            ${escapeHtml(subtitle)}
          </p>
        </div>
        <div style="padding:0 32px 32px;background:${EMAIL_BG};">
          <div style="padding:28px;border-radius:24px;background:${EMAIL_CARD};border:1px solid ${EMAIL_BORDER};color:${EMAIL_TEXT};font-size:15px;line-height:1.75;">
            ${bodyHtml}
            ${ctaBlock}
          </div>
          <p style="margin:18px 0 0;color:${EMAIL_SUBTLE};font-size:12px;line-height:1.6;text-align:center;">
            ${escapeHtml(footerText ?? "Delivery MAX · comunicação automatizada da sua operação SaaS.")}
          </p>
        </div>
      </div>
    </div>
  `;
}

function normalizeTextBlock(value: string) {
  return value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export function buildSignupWelcomeEmail(input: {
  fullName: string;
  storeName: string;
  confirmationUrl: string;
}): BuiltEmailTemplate {
  const subject = "Bem-vindo ao Delivery MAX";
  return {
    subject,
    html: renderEmailFrame({
      eyebrow: "Boas-vindas",
      title: "Confirme seu acesso ao Delivery MAX",
      subtitle: "Seu painel premium já está provisionado. Falta apenas validar o e-mail para liberar o primeiro acesso.",
      accentColor: "#ef4444",
      badgeColor: "#475569",
      ctaLabel: "Confirmar e acessar",
      ctaUrl: input.confirmationUrl,
      bodyHtml: `
        <p style="margin:0 0 16px;">Olá, <strong>${escapeHtml(input.fullName)}</strong>.</p>
        <p style="margin:0 0 16px;">A loja <strong>${escapeHtml(input.storeName)}</strong> foi criada com sucesso no Delivery MAX.</p>
        <p style="margin:0;">Clique no botão abaixo para confirmar seu e-mail com segurança via Supabase Auth. Somente após esse clique sua conta será validada no login.</p>
      `,
    }),
    text: normalizeTextBlock(`
      ${subject}

      Olá, ${input.fullName}.
      A loja ${input.storeName} foi criada com sucesso no Delivery MAX.
      Confirme seu e-mail para liberar o primeiro acesso:
      ${input.confirmationUrl}

      Delivery MAX
    `),
  };
}

export function buildPasswordRecoveryEmail(input: {
  storeName: string;
  recoveryUrl: string;
}): BuiltEmailTemplate {
  const subject = "Recupere sua senha no Delivery MAX";
  return {
    subject,
    html: renderEmailFrame({
      eyebrow: "Recuperação de acesso",
      title: "Defina uma nova senha com segurança",
      subtitle: "Recebemos uma solicitação para redefinir a senha da sua conta no Delivery MAX.",
      accentColor: "#ef4444",
      badgeColor: "#475569",
      ctaLabel: "Criar nova senha",
      ctaUrl: input.recoveryUrl,
      bodyHtml: `
        <p style="margin:0 0 16px;">A solicitação foi registrada para a loja <strong>${escapeHtml(input.storeName || "sua loja")}</strong>.</p>
        <p style="margin:0;">Clique no botão acima para abrir a página segura de redefinição. Se você não fez esse pedido, ignore este e-mail.</p>
      `,
    }),
    text: normalizeTextBlock(`
      ${subject}

      Recebemos uma solicitação para redefinir a senha da loja ${input.storeName || "sua loja"}.
      Para criar uma nova senha com segurança, acesse:
      ${input.recoveryUrl}

      Se você não fez esse pedido, ignore este e-mail.
      Delivery MAX
    `),
  };
}

export type BillingEmailVariant =
  | "reminder_3d"
  | "reminder_1d"
  | "renewal_completed"
  | "access_suspended";

export function buildBillingLifecycleEmail(input: {
  variant: BillingEmailVariant;
  storeName: string;
  renewalUrl: string;
}): BuiltEmailTemplate {
  const storeName = escapeHtml(input.storeName || "sua loja");
  const plainStoreName = input.storeName || "sua loja";

  switch (input.variant) {
    case "reminder_3d":
      return {
        subject: "Sua assinatura expira em 72h",
        html: renderEmailFrame({
          eyebrow: "Aviso de cobrança",
          title: "Sua assinatura expira em 72h",
          subtitle: "Evite o bloqueio do seu PDV e mantenha a operação ativa.",
          accentColor: "#f97316",
          badgeColor: "#f97316",
          ctaLabel: "Regularizar assinatura",
          ctaUrl: input.renewalUrl,
          bodyHtml: `
            <p style="margin:0 0 16px;">A operação da loja <strong>${storeName}</strong> entrou na janela crítica de renovação.</p>
            <p style="margin:0;">Se o pagamento não for regularizado nas próximas 72 horas, o painel administrativo e o PDV podem ser pausados.</p>
          `,
        }),
        text: normalizeTextBlock(`
          Sua assinatura expira em 72h

          A operação da loja ${plainStoreName} entrou na janela crítica de renovação.
          Regularize a assinatura para evitar bloqueio do painel e do PDV:
          ${input.renewalUrl}

          Delivery MAX
        `),
      };
    case "reminder_1d":
      return {
        subject: "Atenção: seu acesso será pausado amanhã",
        html: renderEmailFrame({
          eyebrow: "Aviso de cobrança",
          title: "Atenção: seu acesso será pausado amanhã",
          subtitle: "Último aviso antes da pausa automática do painel.",
          accentColor: "#ef4444",
          badgeColor: "#f97316",
          ctaLabel: "Pagar agora",
          ctaUrl: input.renewalUrl,
          bodyHtml: `
            <p style="margin:0 0 16px;">A assinatura da loja <strong>${storeName}</strong> vence amanhã.</p>
            <p style="margin:0;">Regularize agora para evitar interrupção de vendas, atendimento e operação do PDV.</p>
          `,
        }),
        text: normalizeTextBlock(`
          Atenção: seu acesso será pausado amanhã

          A assinatura da loja ${plainStoreName} vence amanhã.
          Regularize agora para evitar interrupção de vendas, atendimento e operação do PDV:
          ${input.renewalUrl}

          Delivery MAX
        `),
      };
    case "renewal_completed":
      return {
        subject: "Tudo certo! Sua assinatura foi renovada",
        html: renderEmailFrame({
          eyebrow: "Pagamento confirmado",
          title: "Tudo certo! Sua assinatura foi renovada",
          subtitle: "Seu painel segue liberado e a operação continua protegida.",
          accentColor: "#10b981",
          badgeColor: "#10b981",
          ctaLabel: "Abrir painel",
          ctaUrl: input.renewalUrl.replace("?billing=renew", ""),
          bodyHtml: `
            <p style="margin:0 0 16px;">Recebemos a renovação da loja <strong>${storeName}</strong>.</p>
            <p style="margin:0;">O acesso premium foi mantido com sucesso e seu novo ciclo já está refletido no sistema.</p>
          `,
        }),
        text: normalizeTextBlock(`
          Tudo certo! Sua assinatura foi renovada

          Recebemos a renovação da loja ${plainStoreName}.
          O acesso premium foi mantido com sucesso.
          Abra o painel:
          ${input.renewalUrl.replace("?billing=renew", "")}

          Delivery MAX
        `),
      };
    case "access_suspended":
      return {
        subject: "Seu painel foi pausado por falta de pagamento",
        html: renderEmailFrame({
          eyebrow: "Acesso suspenso",
          title: "Seu painel foi pausado por falta de pagamento",
          subtitle: "Regularize agora para reativar painel, PDV e operação administrativa.",
          accentColor: "#ef4444",
          badgeColor: "#ef4444",
          ctaLabel: "Regularizar agora",
          ctaUrl: input.renewalUrl,
          bodyHtml: `
            <p style="margin:0 0 16px;">A assinatura da loja <strong>${storeName}</strong> não foi regularizada a tempo.</p>
            <p style="margin:0;">Assim que o pagamento for confirmado, o acesso será liberado novamente de forma automática.</p>
          `,
        }),
        text: normalizeTextBlock(`
          Seu painel foi pausado por falta de pagamento

          A assinatura da loja ${plainStoreName} não foi regularizada a tempo.
          Regularize agora para reativar painel, PDV e operação administrativa:
          ${input.renewalUrl}

          Delivery MAX
        `),
      };
  }
}



