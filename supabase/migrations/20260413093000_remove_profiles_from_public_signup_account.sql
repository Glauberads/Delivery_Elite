CREATE OR REPLACE FUNCTION public.ensure_public_signup_account(
    p_user_id UUID,
    p_email TEXT,
    p_full_name TEXT DEFAULT NULL,
    p_store_name TEXT DEFAULT NULL,
    p_cpf_cnpj TEXT DEFAULT NULL,
    p_whatsapp TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_email TEXT := lower(btrim(COALESCE(p_email, '')));
    v_full_name TEXT := btrim(COALESCE(p_full_name, ''));
    v_store_name TEXT := btrim(COALESCE(p_store_name, ''));
    v_cpf_cnpj TEXT := regexp_replace(COALESCE(p_cpf_cnpj, ''), '\D', '', 'g');
    v_whatsapp TEXT := regexp_replace(COALESCE(p_whatsapp, ''), '\D', '', 'g');
    v_first_name TEXT;
    v_last_name TEXT;
    v_base_slug TEXT;
    v_slug TEXT;
    v_slug_suffix TEXT := substr(replace(p_user_id::text, '-', ''), 1, 6);
    v_tenant_id UUID;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario obrigatorio para provisionar o cadastro publico.';
    END IF;

    IF v_email = '' THEN
        RAISE EXCEPTION 'Email obrigatorio para cadastro publico.';
    END IF;

    SELECT tu.tenant_id
    INTO v_tenant_id
    FROM public.tenant_users tu
    WHERE tu.id = p_user_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        SELECT t.id
        INTO v_tenant_id
        FROM public.tenants t
        WHERE t.created_by = p_user_id
        LIMIT 1;
    END IF;

    IF v_tenant_id IS NULL THEN
        IF v_full_name = '' THEN
            RAISE EXCEPTION 'Nome completo obrigatorio para cadastro publico.';
        END IF;

        IF v_store_name = '' THEN
            RAISE EXCEPTION 'Nome da loja obrigatorio para cadastro publico.';
        END IF;

        IF v_cpf_cnpj !~ '^(?:[0-9]{11}|[0-9]{14})$' THEN
            RAISE EXCEPTION 'CPF ou CNPJ invalido para cadastro publico.';
        END IF;

        IF v_whatsapp !~ '^[0-9]{10,11}$' THEN
            RAISE EXCEPTION 'WhatsApp invalido para cadastro publico.';
        END IF;
    END IF;

    IF v_full_name <> '' THEN
        v_first_name := split_part(v_full_name, ' ', 1);
        v_last_name := NULLIF(btrim(substr(v_full_name, char_length(v_first_name) + 1)), '');
    END IF;

    IF v_tenant_id IS NULL THEN
        v_base_slug := lower(regexp_replace(v_store_name, '[^a-z0-9]+', '-', 'g'));
        v_base_slug := regexp_replace(v_base_slug, '(^-+|-+$)', '', 'g');

        IF v_base_slug = '' THEN
            v_base_slug := lower(regexp_replace(split_part(v_email, '@', 1), '[^a-z0-9]+', '-', 'g'));
            v_base_slug := regexp_replace(v_base_slug, '(^-+|-+$)', '', 'g');
        END IF;

        IF v_base_slug = '' THEN
            v_base_slug := 'tenant';
        END IF;

        v_base_slug := left(v_base_slug, 40);
        v_slug := v_base_slug;

        IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug) THEN
            v_slug := left(v_base_slug, 33) || '-' || v_slug_suffix;
        END IF;

        INSERT INTO public.tenants (
            name,
            slug,
            email,
            status,
            created_by,
            full_name,
            cpf_cnpj,
            whatsapp,
            phone,
            trial_ends_at
        ) VALUES (
            v_store_name,
            v_slug,
            v_email,
            'trialing',
            p_user_id,
            v_full_name,
            v_cpf_cnpj,
            v_whatsapp,
            v_whatsapp,
            now() + interval '15 days'
        )
        RETURNING id INTO v_tenant_id;
    ELSE
        UPDATE public.tenants
        SET
            name = COALESCE(NULLIF(v_store_name, ''), name),
            email = v_email,
            full_name = COALESCE(NULLIF(v_full_name, ''), full_name),
            cpf_cnpj = COALESCE(NULLIF(v_cpf_cnpj, ''), cpf_cnpj),
            whatsapp = COALESCE(NULLIF(v_whatsapp, ''), whatsapp),
            phone = COALESCE(NULLIF(v_whatsapp, ''), phone),
            created_by = COALESCE(created_by, p_user_id),
            status = COALESCE(status, 'trialing'),
            trial_ends_at = COALESCE(trial_ends_at, now() + interval '15 days'),
            updated_at = now()
        WHERE id = v_tenant_id;
    END IF;

    INSERT INTO public.restaurants (
        tenant_id
    ) VALUES (
        v_tenant_id
    )
    ON CONFLICT (tenant_id) DO UPDATE
    SET
        updated_at = now();

    INSERT INTO public.tenant_settings (
        tenant_id,
        allow_signup
    ) VALUES (
        v_tenant_id,
        false
    )
    ON CONFLICT (tenant_id) DO UPDATE
    SET
        updated_at = now();

    INSERT INTO public.tenant_users (
        id,
        tenant_id,
        email,
        first_name,
        last_name,
        role,
        active
    ) VALUES (
        p_user_id,
        v_tenant_id,
        v_email,
        v_first_name,
        v_last_name,
        'admin',
        true
    )
    ON CONFLICT (id) DO UPDATE
    SET
        tenant_id = EXCLUDED.tenant_id,
        email = EXCLUDED.email,
        first_name = COALESCE(EXCLUDED.first_name, public.tenant_users.first_name),
        last_name = COALESCE(EXCLUDED.last_name, public.tenant_users.last_name),
        role = 'admin',
        active = true,
        updated_at = now();

    UPDATE auth.users
    SET
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
            'tenant_id', v_tenant_id,
            'tenant_role', 'admin',
            'full_name', NULLIF(v_full_name, ''),
            'store_name', NULLIF(v_store_name, ''),
            'storeName', NULLIF(v_store_name, ''),
            'cpf_cnpj', NULLIF(v_cpf_cnpj, ''),
            'whatsapp', NULLIF(v_whatsapp, '')
        )),
        updated_at = now()
    WHERE id = p_user_id;

    RETURN v_tenant_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_public_signup_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
IS 'Provisiona tenant, tenant_user, restaurant e tenant_settings de forma idempotente para cadastros publicos.';



