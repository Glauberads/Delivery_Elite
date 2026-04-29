GRANT SELECT, INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.platform_settings TO service_role;

DROP POLICY IF EXISTS "platform_settings_superadmin" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_select_superadmin" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_insert_superadmin" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_update_superadmin" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_delete_superadmin" ON public.platform_settings;

CREATE POLICY "platform_settings_select_superadmin" ON public.platform_settings
    FOR SELECT TO authenticated
    USING (public.is_superadmin());

CREATE POLICY "platform_settings_insert_superadmin" ON public.platform_settings
    FOR INSERT TO authenticated
    WITH CHECK (public.is_superadmin());

CREATE POLICY "platform_settings_update_superadmin" ON public.platform_settings
    FOR UPDATE TO authenticated
    USING (public.is_superadmin())
    WITH CHECK (public.is_superadmin());

CREATE POLICY "platform_settings_delete_superadmin" ON public.platform_settings
    FOR DELETE TO authenticated
    USING (public.is_superadmin());



