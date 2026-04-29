import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";
import { loadTextPlatformSetting } from "./platform-settings.ts";

export type PlatformResendConfig = {
  apiKey: string;
  senderEmail: string;
  senderName: string;
};

const DEFAULT_SENDER_NAME = "Delivery MAX";
const DEFAULT_SENDER_EMAIL = "contato@overflex.cloud";
const FIXED_FROM = "Delivery MAX <contato@overflex.cloud>";

type PlatformEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type ResendEmailRequest = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
};

function parseResendResponseBody(rawText: string) {
  if (!rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

function buildResendErrorMessage(status: number, payload: unknown) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = String((payload as { message?: unknown }).message ?? "").trim();
    if (message) {
      return `Falha no envio pelo Resend: ${message}`;
    }
  }

  return `Falha no envio pelo Resend (HTTP ${status}).`;
}

function buildResendErrorBody(status: number, payload: unknown) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload;
  }

  return {
    message: buildResendErrorMessage(status, payload),
  };
}

export async function loadResendConfig(supabaseAdmin: SupabaseClient) {
  const apiKey = await loadTextPlatformSetting(supabaseAdmin, "resend_api_key");

  if (!apiKey) {
    throw new HttpError(400, "Configuração Resend inválida: resend_api_key não informada.");
  }

  return {
    apiKey,
    senderEmail: DEFAULT_SENDER_EMAIL,
    senderName: DEFAULT_SENDER_NAME,
  } satisfies PlatformResendConfig;
}

function formatResendFrom(senderName: string, senderEmail: string) {
  const normalizedSenderName = senderName.trim() || DEFAULT_SENDER_NAME;
  const normalizedSenderEmail = senderEmail.trim() || DEFAULT_SENDER_EMAIL;
  const computedFrom = `${normalizedSenderName} <${normalizedSenderEmail}>`;

  if (computedFrom !== FIXED_FROM) {
    console.error("resend sender mismatch detected", {
      expected: FIXED_FROM,
      actual: computedFrom,
    });
  }

  return FIXED_FROM.trim();
}

export async function sendPlatformEmail(config: PlatformResendConfig, payload: PlatformEmailInput) {
  const requestBody: ResendEmailRequest = {
    from: formatResendFrom(config.senderName, config.senderEmail),
    to: [payload.to],
    subject: payload.subject,
    html: payload.html,
    text: payload.text?.trim() ? payload.text.trim() : undefined,
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (response.ok) {
    return;
  }

  const rawResponseBody = await response.text().catch(() => "");
  const payloadBody = parseResendResponseBody(rawResponseBody);
  console.error("resend send failed", {
    status: response.status,
    body: payloadBody,
    rawBody: rawResponseBody,
    from: requestBody.from,
    to: payload.to,
    senderName: config.senderName,
    senderEmail: config.senderEmail,
  });

  const errorBody = buildResendErrorBody(response.status, payloadBody);
  const errorMessage =
    typeof errorBody === "object" &&
    errorBody !== null &&
    "message" in errorBody &&
    typeof (errorBody as { message?: unknown }).message === "string"
      ? String((errorBody as { message?: unknown }).message)
      : buildResendErrorMessage(response.status, payloadBody);

  throw new HttpError(
    response.status >= 400 && response.status < 500 ? response.status : 502,
    errorMessage,
    errorBody,
  );
}



