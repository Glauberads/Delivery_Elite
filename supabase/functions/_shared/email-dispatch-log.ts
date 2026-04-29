import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";

type EmailDispatchInput = {
  tenantId: string;
  recipientEmail: string;
  eventType: string;
  eventKey: string;
  metadata?: Record<string, unknown>;
};

export async function hasEmailDispatch(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  eventType: string,
  eventKey: string,
) {
  const { data, error } = await supabaseAdmin
    .from("tenant_email_dispatches")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("event_type", eventType)
    .eq("event_key", eventKey)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Falha ao consultar o log de e-mails do tenant.");
  }

  return Boolean(data?.id);
}

export async function createEmailDispatch(
  supabaseAdmin: SupabaseClient,
  payload: EmailDispatchInput,
) {
  const { error } = await supabaseAdmin
    .from("tenant_email_dispatches")
    .upsert(
      {
        tenant_id: payload.tenantId,
        recipient_email: payload.recipientEmail,
        event_type: payload.eventType,
        event_key: payload.eventKey,
        metadata: payload.metadata ?? {},
      },
      {
        onConflict: "tenant_id,event_type,event_key",
      },
    );

  if (error) {
    throw new HttpError(500, "Falha ao registrar o disparo de e-mail do tenant.");
  }
}

export async function hasRecentEmailDispatch(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  eventType: string,
  withinMinutes: number,
) {
  const threshold = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("tenant_email_dispatches")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("event_type", eventType)
    .gte("created_at", threshold)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Falha ao consultar o histórico recente de e-mails do tenant.");
  }

  return Boolean(data?.id);
}



