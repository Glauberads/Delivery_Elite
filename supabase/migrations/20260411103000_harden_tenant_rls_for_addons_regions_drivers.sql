ALTER TABLE public.product_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on product_addons" ON public.product_addons;
DROP POLICY IF EXISTS "product_addons_superadmin" ON public.product_addons;
DROP POLICY IF EXISTS "product_addons_own_tenant" ON public.product_addons;
DROP POLICY IF EXISTS "product_addons_public_read" ON public.product_addons;
DROP POLICY IF EXISTS "product_addons_superadmin_select" ON public.product_addons;
DROP POLICY IF EXISTS "product_addons_superadmin_insert" ON public.product_addons;
DROP POLICY IF EXISTS "product_addons_superadmin_update" ON public.product_addons;
DROP POLICY IF EXISTS "product_addons_superadmin_delete" ON public.product_addons;
DROP POLICY IF EXISTS "product_addons_tenant_select" ON public.product_addons;
DROP POLICY IF EXISTS "product_addons_tenant_insert" ON public.product_addons;
DROP POLICY IF EXISTS "product_addons_tenant_update" ON public.product_addons;
DROP POLICY IF EXISTS "product_addons_tenant_delete" ON public.product_addons;

CREATE POLICY "product_addons_superadmin_select" ON public.product_addons
    FOR SELECT TO authenticated
    USING (public.is_superadmin());

CREATE POLICY "product_addons_superadmin_insert" ON public.product_addons
    FOR INSERT TO authenticated
    WITH CHECK (public.is_superadmin());

CREATE POLICY "product_addons_superadmin_update" ON public.product_addons
    FOR UPDATE TO authenticated
    USING (public.is_superadmin())
    WITH CHECK (public.is_superadmin());

CREATE POLICY "product_addons_superadmin_delete" ON public.product_addons
    FOR DELETE TO authenticated
    USING (public.is_superadmin());

CREATE POLICY "product_addons_tenant_select" ON public.product_addons
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "product_addons_tenant_insert" ON public.product_addons
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "product_addons_tenant_update" ON public.product_addons
    FOR UPDATE TO authenticated
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "product_addons_tenant_delete" ON public.product_addons
    FOR DELETE TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "product_addons_public_read" ON public.product_addons
    FOR SELECT
    USING (available = true);

DROP POLICY IF EXISTS "Allow all operations on delivery_regions" ON public.delivery_regions;
DROP POLICY IF EXISTS "delivery_regions_superadmin" ON public.delivery_regions;
DROP POLICY IF EXISTS "delivery_regions_own_tenant" ON public.delivery_regions;
DROP POLICY IF EXISTS "delivery_regions_public_read" ON public.delivery_regions;
DROP POLICY IF EXISTS "delivery_regions_superadmin_select" ON public.delivery_regions;
DROP POLICY IF EXISTS "delivery_regions_superadmin_insert" ON public.delivery_regions;
DROP POLICY IF EXISTS "delivery_regions_superadmin_update" ON public.delivery_regions;
DROP POLICY IF EXISTS "delivery_regions_superadmin_delete" ON public.delivery_regions;
DROP POLICY IF EXISTS "delivery_regions_tenant_select" ON public.delivery_regions;
DROP POLICY IF EXISTS "delivery_regions_tenant_insert" ON public.delivery_regions;
DROP POLICY IF EXISTS "delivery_regions_tenant_update" ON public.delivery_regions;
DROP POLICY IF EXISTS "delivery_regions_tenant_delete" ON public.delivery_regions;

CREATE POLICY "delivery_regions_superadmin_select" ON public.delivery_regions
    FOR SELECT TO authenticated
    USING (public.is_superadmin());

CREATE POLICY "delivery_regions_superadmin_insert" ON public.delivery_regions
    FOR INSERT TO authenticated
    WITH CHECK (public.is_superadmin());

CREATE POLICY "delivery_regions_superadmin_update" ON public.delivery_regions
    FOR UPDATE TO authenticated
    USING (public.is_superadmin())
    WITH CHECK (public.is_superadmin());

CREATE POLICY "delivery_regions_superadmin_delete" ON public.delivery_regions
    FOR DELETE TO authenticated
    USING (public.is_superadmin());

CREATE POLICY "delivery_regions_tenant_select" ON public.delivery_regions
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "delivery_regions_tenant_insert" ON public.delivery_regions
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "delivery_regions_tenant_update" ON public.delivery_regions
    FOR UPDATE TO authenticated
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "delivery_regions_tenant_delete" ON public.delivery_regions
    FOR DELETE TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "delivery_regions_public_read" ON public.delivery_regions
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow all operations on drivers" ON public.drivers;
DROP POLICY IF EXISTS "drivers_superadmin" ON public.drivers;
DROP POLICY IF EXISTS "drivers_own_tenant" ON public.drivers;
DROP POLICY IF EXISTS "drivers_superadmin_select" ON public.drivers;
DROP POLICY IF EXISTS "drivers_superadmin_insert" ON public.drivers;
DROP POLICY IF EXISTS "drivers_superadmin_update" ON public.drivers;
DROP POLICY IF EXISTS "drivers_superadmin_delete" ON public.drivers;
DROP POLICY IF EXISTS "drivers_tenant_select" ON public.drivers;
DROP POLICY IF EXISTS "drivers_tenant_insert" ON public.drivers;
DROP POLICY IF EXISTS "drivers_tenant_update" ON public.drivers;
DROP POLICY IF EXISTS "drivers_tenant_delete" ON public.drivers;

CREATE POLICY "drivers_superadmin_select" ON public.drivers
    FOR SELECT TO authenticated
    USING (public.is_superadmin());

CREATE POLICY "drivers_superadmin_insert" ON public.drivers
    FOR INSERT TO authenticated
    WITH CHECK (public.is_superadmin());

CREATE POLICY "drivers_superadmin_update" ON public.drivers
    FOR UPDATE TO authenticated
    USING (public.is_superadmin())
    WITH CHECK (public.is_superadmin());

CREATE POLICY "drivers_superadmin_delete" ON public.drivers
    FOR DELETE TO authenticated
    USING (public.is_superadmin());

CREATE POLICY "drivers_tenant_select" ON public.drivers
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "drivers_tenant_insert" ON public.drivers
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "drivers_tenant_update" ON public.drivers
    FOR UPDATE TO authenticated
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "drivers_tenant_delete" ON public.drivers
    FOR DELETE TO authenticated
    USING (tenant_id = public.get_my_tenant_id());



