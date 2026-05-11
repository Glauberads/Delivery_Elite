import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-jwt",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

export class HttpError extends Error {
  status: number;
  body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

const ALLOWED_REDIRECT_ORIGINS = new Set([
  "https://delivery.overflex.cloud",
  "https://vipdelivery.com.br",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

export function getSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(500, "Secrets obrigatórios ausentes na Edge Function.");
  }

  return {
    url: SUPABASE_URL,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseEnv();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function resolveAllowedRedirectUrl(
  redirectTo: string | null | undefined,
  fallback: string,
) {
  const normalized = String(redirectTo ?? "").trim();

  if (!normalized) {
    return fallback;
  }

  try {
    const parsed = new URL(normalized);
    if (ALLOWED_REDIRECT_ORIGINS.has(parsed.origin)) {
      return parsed.toString();
    }
  } catch (_) {
    return fallback;
  }

  return fallback;
}



