CREATE TABLE IF NOT EXISTS public.tenant_email_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_key TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tenant_email_dispatches_unique_event UNIQUE (tenant_id, event_type, event_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_email_dispatches_tenant_id
    ON public.tenant_email_dispatches(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_email_dispatches_event_type
    ON public.tenant_email_dispatches(event_type);

ALTER TABLE public.tenant_email_dispatches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_email_dispatches_superadmin_select" ON public.tenant_email_dispatches;

CREATE POLICY "tenant_email_dispatches_superadmin_select"
    ON public.tenant_email_dispatches
    FOR SELECT
    TO authenticated
    USING (public.is_superadmin());



