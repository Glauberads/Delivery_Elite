ALTER TABLE public.tenant_billing_history
ADD COLUMN IF NOT EXISTS gateway_payload JSONB NOT NULL DEFAULT '{}'::jsonb;



