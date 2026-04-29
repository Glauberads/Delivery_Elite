CREATE OR REPLACE FUNCTION public.superadmin_save_restaurant_with_owner(
    p_tenant_id UUID DEFAULT NULL,
    p_restaurant_name TEXT DEFAULT NULL,
    p_slug TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_status public.tenant_status DEFAULT 'trial',
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
    v_existing_address TEXT;
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

    IF p_tenant_id IS NULL AND v_password IS NULL THEN
        RAISE EXCEPTION 'Senha obrigatória para novo restaurante.';
    END IF;

    IF v_password IS NOT NULL AND char_length(v_password) < 6 THEN
        RAISE EXCEPTION 'A senha precisa ter pelo menos 6 caracteres.';
    END IF;

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
            p_status,
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
            status = p_status,
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
        name,
        address,
        phone
    ) VALUES (
        v_tenant_id,
        v_name,
        v_existing_address,
        v_phone
    )
    ON CONFLICT (tenant_id) DO UPDATE
    SET
        name = EXCLUDED.name,
        address = COALESCE(public.restaurants.address, EXCLUDED.address),
        phone = EXCLUDED.phone,
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
            status = CASE
                WHEN p_status = 'trial' THEN 'trialing'::public.subscription_status
                ELSE 'active'::public.subscription_status
            END,
            updated_at = now()
        WHERE tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            INSERT INTO public.tenant_subscriptions (
                tenant_id,
                plan_id,
                status,
                current_period_start,
                current_period_end
            ) VALUES (
                v_tenant_id,
                p_plan_id,
                'trialing'::public.subscription_status,
                now(),
                now() + interval '1 month'
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

        UPDATE public.tenant_users
        SET
            tenant_id = v_tenant_id,
            role = 'admin',
            active = true
        WHERE id = v_owner_user_id;
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

COMMENT ON FUNCTION public.superadmin_save_restaurant_with_owner(UUID, TEXT, TEXT, TEXT, TEXT, public.tenant_status, UUID, TEXT)
IS 'Cria ou atualiza tenant/restaurante e provisiona o usuário admin do tenant com login por email e senha.';



