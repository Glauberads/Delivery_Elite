-- Tabela de idempotência e auditoria de webhooks
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  payment_id text,
  event_type text NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error_message text,
  next_retry_at timestamptz,
  retry_count integer DEFAULT 0,
  UNIQUE (provider, provider_event_id)
);

-- Ativar RLS, mas permitir acesso total via Service Role nas Edge Functions
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
