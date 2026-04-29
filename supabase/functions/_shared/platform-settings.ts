import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";

type PlatformSettingRow = {
  key: string;
  value: string | null;
};

export type AsaasConfig = {
  environment: "sandbox" | "production";
  apiKey: string;
  webhookToken: string;
  split: {
    partnerAWallet: string;
    partnerAPercent: string;
    partnerBWallet: string;
    partnerBPercent: string;
  };
};

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getSettingRow(supabaseAdmin: SupabaseClient, key: string) {
  const { data, error } = await supabaseAdmin
    .from("platform_settings")
    .select("key, value")
    .eq("key", key)
    .maybeSingle<PlatformSettingRow>();

  if (error) {
    throw new HttpError(500, `Falha ao carregar ${key} em platform_settings.`);
  }

  if (!data?.value) {
    throw new HttpError(400, `Configuração ausente em platform_settings: ${key}.`);
  }

  return data;
}

export async function loadTextPlatformSetting(supabaseAdmin: SupabaseClient, key: string) {
  const row = await getSettingRow(supabaseAdmin, key);
  return String(row.value ?? "").trim();
}

export async function loadJsonPlatformSetting(supabaseAdmin: SupabaseClient, key: string) {
  const row = await getSettingRow(supabaseAdmin, key);

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(row.value);
  } catch {
    throw new HttpError(500, `O valor de ${key} em platform_settings não é um JSON válido.`);
  }

  if (!isJsonRecord(parsedValue)) {
    throw new HttpError(500, `O valor de ${key} em platform_settings não é um objeto JSON válido.`);
  }

  return parsedValue;
}

export async function loadAsaasConfig(supabaseAdmin: SupabaseClient) {
  const parsed = await loadJsonPlatformSetting(supabaseAdmin, "asaas_config");
  const split = isJsonRecord(parsed.split) ? parsed.split : {};
  const environment = String(parsed.environment ?? "sandbox").trim().toLowerCase();

  const config: AsaasConfig = {
    environment: environment === "production" ? "production" : "sandbox",
    apiKey: String(parsed.apiKey ?? "").trim(),
    webhookToken: String(parsed.webhookToken ?? "").trim(),
    split: {
      partnerAWallet: String(split.partnerAWallet ?? "").trim(),
      partnerAPercent: String(split.partnerAPercent ?? "").trim(),
      partnerBWallet: String(split.partnerBWallet ?? "").trim(),
      partnerBPercent: String(split.partnerBPercent ?? "").trim(),
    },
  };

  if (!config.apiKey) {
    throw new HttpError(400, "Configuração Asaas inválida: apiKey não informada.");
  }

  return config;
}



