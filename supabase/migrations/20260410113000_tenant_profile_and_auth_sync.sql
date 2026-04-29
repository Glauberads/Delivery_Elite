DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'tenants'
          AND policyname = 'tenants_own_update'
    ) THEN
        EXECUTE '
            CREATE POLICY "tenants_own_update" ON public.tenants
            FOR UPDATE
            USING (id = public.get_my_tenant_id())
            WITH CHECK (id = public.get_my_tenant_id())
        ';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_auth_user_email_to_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT := lower(btrim(COALESCE(NEW.email, '')));
    v_tenant_id UUID;
BEGIN
    IF v_email = '' OR NEW.email IS NOT DISTINCT FROM OLD.email THEN
        RETURN NEW;
    END IF;

    UPDATE public.superadmin_users
    SET
        email = v_email,
        updated_at = now()
    WHERE id = NEW.id;

    UPDATE public.tenant_users
    SET
        email = v_email,
        updated_at = now()
    WHERE id = NEW.id;

    SELECT tenant_id
    INTO v_tenant_id
    FROM public.tenant_users
    WHERE id = NEW.id
      AND role = 'admin'
    LIMIT 1;

    IF v_tenant_id IS NOT NULL THEN
        UPDATE public.tenants
        SET
            email = v_email,
            updated_at = now()
        WHERE id = v_tenant_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;

CREATE TRIGGER on_auth_user_email_updated
    AFTER UPDATE OF email ON auth.users
    FOR EACH ROW
    WHEN (OLD.email IS DISTINCT FROM NEW.email)
    EXECUTE FUNCTION public.sync_auth_user_email_to_profiles();



