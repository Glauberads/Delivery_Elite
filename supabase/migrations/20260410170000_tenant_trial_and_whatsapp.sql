ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS whatsapp TEXT,
    ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

UPDATE public.tenants
SET whatsapp = regexp_replace(COALESCE(phone, ''), '\D', '', 'g')
WHERE COALESCE(whatsapp, '') = ''
  AND COALESCE(phone, '') <> '';

ALTER TABLE public.tenants
    ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.tenants
    ALTER COLUMN status TYPE TEXT
    USING CASE
        WHEN status::text = 'trial' THEN 'trialing'
        ELSE status::text
    END;

ALTER TABLE public.tenants
    ALTER COLUMN status SET DEFAULT 'trialing';

UPDATE public.tenants
SET
    status = CASE
        WHEN COALESCE(status, '') = 'trial' THEN 'trialing'
        WHEN COALESCE(status, '') = '' THEN 'trialing'
        ELSE status
    END,
    trial_ends_at = COALESCE(trial_ends_at, created_at + interval '15 days', now() + interval '15 days');

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
        tenant_id,
        name
    ) VALUES (
        v_tenant_id,
        v_store_name
    )
    ON CONFLICT (tenant_id) DO UPDATE
    SET
        name = EXCLUDED.name,
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



