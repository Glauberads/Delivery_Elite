DELETE FROM public.tenant_billing_history a
USING public.tenant_billing_history b
WHERE a.tenant_id = b.tenant_id
  AND a.asaas_payment_id = b.asaas_payment_id
  AND a.asaas_payment_id IS NOT NULL
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_billing_history_tenant_payment_unique
ON public.tenant_billing_history (tenant_id, asaas_payment_id)
WHERE asaas_payment_id IS NOT NULL;



