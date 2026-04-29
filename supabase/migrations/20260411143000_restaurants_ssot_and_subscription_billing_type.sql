ALTER TABLE public.tenant_subscriptions
    ADD COLUMN IF NOT EXISTS billing_type TEXT;

DROP FUNCTION IF EXISTS public.superadmin_save_restaurant_with_owner(UUID, TEXT, TEXT, TEXT, TEXT, public.tenant_status, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.superadmin_save_restaurant_with_owner(
    p_tenant_id UUID DEFAULT NULL,
    p_restaurant_name TEXT DEFAULT NULL,
    p_slug TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'trialing',
    p_plan_id UUID DEFAULT NULL,
    p_password TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_tenant_id UUID;
    v_owner_user_id UUID;
    v_name TEXT := btrim(COALESCE(p_restaurant_name, ''));
    v_slug TEXT := lower(btrim(COALESCE(p_slug, '')));
    v_email TEXT := lower(btrim(COALESCE(p_email, '')));
    v_phone TEXT := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
    v_password TEXT := NULLIF(COALESCE(p_password, ''), '');
    v_status TEXT := lower(btrim(COALESCE(p_status, 'trialing')));
    v_existing_address TEXT;
    v_subscription_status public.subscription_status;
BEGIN
    IF NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    IF char_length(v_name) < 2 THEN
        RAISE EXCEPTION 'Nome do restaurante inválido.';
    END IF;

    IF v_slug = '' OR v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
        RAISE EXCEPTION 'Slug inválido.';
    END IF;

    IF v_email = '' OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
        RAISE EXCEPTION 'Email inválido.';
    END IF;

    IF v_phone !~ '^55[0-9]{11}$' THEN
        RAISE EXCEPTION 'WhatsApp inválido. Use 55 DDD + número com 9 dígitos.';
    END IF;

    IF v_status NOT IN ('trialing', 'active', 'suspended', 'cancelled') THEN
        RAISE EXCEPTION 'Status inválido.';
    END IF;

    IF p_tenant_id IS NULL AND v_password IS NULL THEN
        RAISE EXCEPTION 'Senha obrigatória para novo restaurante.';
    END IF;

    IF v_password IS NOT NULL AND char_length(v_password) < 6 THEN
        RAISE EXCEPTION 'A senha precisa ter pelo menos 6 caracteres.';
    END IF;

    v_subscription_status := CASE
        WHEN v_status = 'active' THEN 'active'::public.subscription_status
        ELSE 'trialing'::public.subscription_status
    END;

    IF p_tenant_id IS NULL THEN
        INSERT INTO public.tenants (
            name,
            slug,
            email,
            phone,
            status,
            plan_id,
            created_by
        ) VALUES (
            v_name,
            v_slug,
            v_email,
            v_phone,
            v_status,
            p_plan_id,
            auth.uid()
        )
        RETURNING id INTO v_tenant_id;
    ELSE
        SELECT address
        INTO v_existing_address
        FROM public.restaurants
        WHERE tenant_id = p_tenant_id;

        UPDATE public.tenants
        SET
            name = v_name,
            slug = v_slug,
            email = v_email,
            phone = v_phone,
            status = v_status,
            plan_id = p_plan_id,
            updated_at = now()
        WHERE id = p_tenant_id
        RETURNING id INTO v_tenant_id;

        IF v_tenant_id IS NULL THEN
            RAISE EXCEPTION 'Tenant não encontrado.';
        END IF;
    END IF;

    INSERT INTO public.restaurants (
        tenant_id,
        address
    ) VALUES (
        v_tenant_id,
        v_existing_address
    )
    ON CONFLICT (tenant_id) DO UPDATE
    SET
        address = COALESCE(public.restaurants.address, EXCLUDED.address),
        updated_at = now();

    INSERT INTO public.tenant_settings (tenant_id, allow_signup)
    VALUES (v_tenant_id, false)
    ON CONFLICT (tenant_id) DO UPDATE
    SET
        allow_signup = EXCLUDED.allow_signup,
        updated_at = now();

    IF p_plan_id IS NULL THEN
        DELETE FROM public.tenant_subscriptions
        WHERE tenant_id = v_tenant_id;
    ELSE
        UPDATE public.tenant_subscriptions
        SET
            plan_id = p_plan_id,
            status = v_subscription_status,
            updated_at = now()
        WHERE tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            INSERT INTO public.tenant_subscriptions (
                tenant_id,
                plan_id,
                status,
                current_period_start,
                current_period_end,
                billing_type
            ) VALUES (
                v_tenant_id,
                p_plan_id,
                v_subscription_status,
                now(),
                now() + interval '1 month',
                NULL
            );
        END IF;
    END IF;

    SELECT tu.id
    INTO v_owner_user_id
    FROM public.tenant_users tu
    WHERE tu.tenant_id = v_tenant_id
      AND tu.role = 'admin'
    ORDER BY tu.created_at ASC
    LIMIT 1;

    IF v_owner_user_id IS NULL THEN
        IF v_password IS NULL THEN
            RAISE EXCEPTION 'Senha obrigatória para criar o acesso do restaurante.';
        END IF;

        v_owner_user_id := gen_random_uuid();

        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            created_at,
            updated_at,
            aud,
            role,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change
        ) VALUES (
            v_owner_user_id,
            '00000000-0000-0000-0000-000000000000'::uuid,
            v_email,
            extensions.crypt(v_password, extensions.gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object(
                'tenant_id', v_tenant_id,
                'tenant_role', 'admin',
                'restaurant_name', v_name
            ),
            false,
            now(),
            now(),
            'authenticated',
            'authenticated',
            '',
            '',
            '',
            ''
        );

        INSERT INTO auth.identities (
            id,
            user_id,
            provider_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_owner_user_id,
            v_email,
            jsonb_build_object(
                'sub', v_owner_user_id::text,
                'email', v_email,
                'email_verified', true
            ),
            'email',
            now(),
            now(),
            now()
        );

        INSERT INTO public.tenant_users (
            id,
            tenant_id,
            email,
            role,
            active
        ) VALUES (
            v_owner_user_id,
            v_tenant_id,
            v_email,
            'admin',
            true
        );
    ELSE
        UPDATE auth.users
        SET
            email = v_email,
            encrypted_password = CASE
                WHEN v_password IS NOT NULL THEN extensions.crypt(v_password, extensions.gen_salt('bf'))
                ELSE encrypted_password
            END,
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
                'tenant_id', v_tenant_id,
                'tenant_role', 'admin',
                'restaurant_name', v_name
            ),
            updated_at = now()
        WHERE id = v_owner_user_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Usuário de acesso do restaurante não encontrado.';
        END IF;

        UPDATE public.tenant_users
        SET
            tenant_id = v_tenant_id,
            email = v_email,
            role = 'admin',
            active = true,
            updated_at = now()
        WHERE id = v_owner_user_id;

        UPDATE auth.identities
        SET
            provider_id = v_email,
            identity_data = jsonb_build_object(
                'sub', v_owner_user_id::text,
                'email', v_email,
                'email_verified', true
            ),
            updated_at = now()
        WHERE user_id = v_owner_user_id
          AND provider = 'email';

        IF NOT FOUND THEN
            INSERT INTO auth.identities (
                id,
                user_id,
                provider_id,
                identity_data,
                provider,
                last_sign_in_at,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                v_owner_user_id,
                v_email,
                jsonb_build_object(
                    'sub', v_owner_user_id::text,
                    'email', v_email,
                    'email_verified', true
                ),
                'email',
                now(),
                now(),
                now()
            );
        END IF;
    END IF;

    RETURN v_tenant_id;
END;
$$;

COMMENT ON FUNCTION public.superadmin_save_restaurant_with_owner(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
IS 'Cria ou atualiza tenant/restaurante, cria a assinatura inicial com ciclo financeiro e provisiona o usuário admin do tenant com login por email e senha.';

CREATE OR REPLACE FUNCTION public.handle_public_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_full_name TEXT := btrim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
    v_store_name TEXT := btrim(COALESCE(NEW.raw_user_meta_data ->> 'store_name', ''));
    v_cpf_cnpj TEXT := regexp_replace(COALESCE(NEW.raw_user_meta_data ->> 'cpf_cnpj', ''), '\D', '', 'g');
    v_whatsapp TEXT := regexp_replace(COALESCE(NEW.raw_user_meta_data ->> 'whatsapp', ''), '\D', '', 'g');
    v_email TEXT := lower(btrim(COALESCE(NEW.email, '')));
    v_first_name TEXT;
    v_last_name TEXT;
    v_base_name TEXT;
    v_base_slug TEXT;
    v_slug TEXT;
    v_tenant_id UUID;
    v_slug_suffix TEXT := substr(replace(NEW.id::text, '-', ''), 1, 6);
BEGIN
    IF COALESCE(NEW.raw_user_meta_data ->> 'signup_source', '') <> 'public_register' THEN
        RETURN NEW;
    END IF;

    IF v_email = '' THEN
        RAISE EXCEPTION 'Email obrigatorio para cadastro publico.';
    END IF;

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

    v_first_name := split_part(v_full_name, ' ', 1);
    v_last_name := NULLIF(btrim(substr(v_full_name, char_length(v_first_name) + 1)), '');
    v_base_name := v_store_name;
    v_base_slug := lower(regexp_replace(v_base_name, '[^a-z0-9]+', '-', 'g'));
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
        NEW.id,
        v_full_name,
        v_cpf_cnpj,
        v_whatsapp,
        v_whatsapp,
        now() + interval '15 days'
    )
    RETURNING id INTO v_tenant_id;

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
        NEW.id,
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
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        active = EXCLUDED.active,
        updated_at = now();

    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'tenant_id', v_tenant_id,
        'tenant_role', 'admin'
    )
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$;

ALTER TABLE public.restaurants
    DROP COLUMN IF EXISTS name,
    DROP COLUMN IF EXISTS phone;



