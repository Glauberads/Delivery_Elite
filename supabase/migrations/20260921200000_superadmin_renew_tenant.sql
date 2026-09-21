CREATE OR REPLACE FUNCTION public.superadmin_renew_tenant(
    p_tenant_id UUID,
    p_plan_id UUID,
    p_new_end_date TIMESTAMPTZ,
    p_price DECIMAL DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_subscription_exists BOOLEAN;
BEGIN
    -- 1. Verifica permissões
    IF NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    -- 2. Atualiza ou insere na tenant_subscriptions
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_subscriptions WHERE tenant_id = p_tenant_id
    ) INTO v_subscription_exists;

    IF v_subscription_exists THEN
        UPDATE public.tenant_subscriptions
        SET
            plan_id = p_plan_id,
            status = 'active',
            current_period_end = p_new_end_date,
            updated_at = now()
        WHERE tenant_id = p_tenant_id;
    ELSE
        INSERT INTO public.tenant_subscriptions (
            tenant_id,
            plan_id,
            status,
            current_period_start,
            current_period_end,
            billing_type
        ) VALUES (
            p_tenant_id,
            p_plan_id,
            'active',
            now(),
            p_new_end_date,
            NULL
        );
    END IF;

    -- 3. Atualiza na tenants
    UPDATE public.tenants
    SET
        status = 'active',
        plan_id = p_plan_id,
        trial_ends_at = p_new_end_date,
        updated_at = now()
    WHERE id = p_tenant_id;

    -- 4. Insere histórico financeiro
    INSERT INTO public.tenant_billing_history (
        tenant_id,
        plan_id,
        amount,
        status,
        payment_method,
        paid_at,
        description
    ) VALUES (
        p_tenant_id,
        p_plan_id,
        p_price,
        'paid',
        'manual_superadmin',
        now(),
        'Renovação manual pelo painel Super Admin'
    );

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.superadmin_renew_tenant(UUID, UUID, TIMESTAMPTZ, DECIMAL)
IS 'Função usada pelo painel Super Admin para realizar uma renovação explícita de assinatura, atualizando status, vencimento e gerando histórico de cobrança pago.';
