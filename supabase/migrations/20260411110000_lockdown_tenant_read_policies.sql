ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_addon_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_times ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_superadmin" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_own_tenant" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_public_read" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_tenant_select" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_tenant_insert" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_tenant_update" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_tenant_delete" ON public.restaurants;

CREATE POLICY "restaurants_tenant_select" ON public.restaurants
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "restaurants_tenant_insert" ON public.restaurants
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "restaurants_tenant_update" ON public.restaurants
    FOR UPDATE TO authenticated
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "restaurants_tenant_delete" ON public.restaurants
    FOR DELETE TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS "Allow all operations on business_hours" ON public.business_hours;
DROP POLICY IF EXISTS "business_hours_superadmin" ON public.business_hours;
DROP POLICY IF EXISTS "business_hours_own_tenant" ON public.business_hours;
DROP POLICY IF EXISTS "business_hours_public_read" ON public.business_hours;
DROP POLICY IF EXISTS "business_hours_tenant_select" ON public.business_hours;
DROP POLICY IF EXISTS "business_hours_tenant_insert" ON public.business_hours;
DROP POLICY IF EXISTS "business_hours_tenant_update" ON public.business_hours;
DROP POLICY IF EXISTS "business_hours_tenant_delete" ON public.business_hours;

CREATE POLICY "business_hours_tenant_select" ON public.business_hours
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "business_hours_tenant_insert" ON public.business_hours
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "business_hours_tenant_update" ON public.business_hours
    FOR UPDATE TO authenticated
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "business_hours_tenant_delete" ON public.business_hours
    FOR DELETE TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS "Allow all operations on categories" ON public.categories;
DROP POLICY IF EXISTS "categories_superadmin" ON public.categories;
DROP POLICY IF EXISTS "categories_own_tenant" ON public.categories;
DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
DROP POLICY IF EXISTS "categories_tenant_select" ON public.categories;
DROP POLICY IF EXISTS "categories_tenant_insert" ON public.categories;
DROP POLICY IF EXISTS "categories_tenant_update" ON public.categories;
DROP POLICY IF EXISTS "categories_tenant_delete" ON public.categories;

CREATE POLICY "categories_tenant_select" ON public.categories
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "categories_tenant_insert" ON public.categories
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "categories_tenant_update" ON public.categories
    FOR UPDATE TO authenticated
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "categories_tenant_delete" ON public.categories
    FOR DELETE TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS "Allow all operations on products" ON public.products;
DROP POLICY IF EXISTS "products_superadmin" ON public.products;
DROP POLICY IF EXISTS "products_own_tenant" ON public.products;
DROP POLICY IF EXISTS "products_public_read" ON public.products;
DROP POLICY IF EXISTS "products_tenant_select" ON public.products;
DROP POLICY IF EXISTS "products_tenant_insert" ON public.products;
DROP POLICY IF EXISTS "products_tenant_update" ON public.products;
DROP POLICY IF EXISTS "products_tenant_delete" ON public.products;

CREATE POLICY "products_tenant_select" ON public.products
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "products_tenant_insert" ON public.products
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "products_tenant_update" ON public.products
    FOR UPDATE TO authenticated
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "products_tenant_delete" ON public.products
    FOR DELETE TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

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

DROP POLICY IF EXISTS "Allow all operations on product_addon_relations" ON public.product_addon_relations;
DROP POLICY IF EXISTS "product_addon_rel_superadmin" ON public.product_addon_relations;
DROP POLICY IF EXISTS "product_addon_rel_own_tenant" ON public.product_addon_relations;
DROP POLICY IF EXISTS "product_addon_rel_public_read" ON public.product_addon_relations;
DROP POLICY IF EXISTS "product_addon_rel_tenant_select" ON public.product_addon_relations;
DROP POLICY IF EXISTS "product_addon_rel_tenant_insert" ON public.product_addon_relations;
DROP POLICY IF EXISTS "product_addon_rel_tenant_update" ON public.product_addon_relations;
DROP POLICY IF EXISTS "product_addon_rel_tenant_delete" ON public.product_addon_relations;

CREATE POLICY "product_addon_rel_tenant_select" ON public.product_addon_relations
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "product_addon_rel_tenant_insert" ON public.product_addon_relations
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "product_addon_rel_tenant_update" ON public.product_addon_relations
    FOR UPDATE TO authenticated
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "product_addon_rel_tenant_delete" ON public.product_addon_relations
    FOR DELETE TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS "Allow all operations on payment_methods" ON public.payment_methods;
DROP POLICY IF EXISTS "payment_methods_superadmin" ON public.payment_methods;
DROP POLICY IF EXISTS "payment_methods_own_tenant" ON public.payment_methods;
DROP POLICY IF EXISTS "payment_methods_public_read" ON public.payment_methods;
DROP POLICY IF EXISTS "payment_methods_tenant_select" ON public.payment_methods;
DROP POLICY IF EXISTS "payment_methods_tenant_insert" ON public.payment_methods;
DROP POLICY IF EXISTS "payment_methods_tenant_update" ON public.payment_methods;
DROP POLICY IF EXISTS "payment_methods_tenant_delete" ON public.payment_methods;

CREATE POLICY "payment_methods_tenant_select" ON public.payment_methods
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "payment_methods_tenant_insert" ON public.payment_methods
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "payment_methods_tenant_update" ON public.payment_methods
    FOR UPDATE TO authenticated
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "payment_methods_tenant_delete" ON public.payment_methods
    FOR DELETE TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

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

DROP POLICY IF EXISTS "Allow all operations on delivery_times" ON public.delivery_times;
DROP POLICY IF EXISTS "delivery_times_superadmin" ON public.delivery_times;
DROP POLICY IF EXISTS "delivery_times_own_tenant" ON public.delivery_times;
DROP POLICY IF EXISTS "delivery_times_public_read" ON public.delivery_times;
DROP POLICY IF EXISTS "delivery_times_tenant_select" ON public.delivery_times;
DROP POLICY IF EXISTS "delivery_times_tenant_insert" ON public.delivery_times;
DROP POLICY IF EXISTS "delivery_times_tenant_update" ON public.delivery_times;
DROP POLICY IF EXISTS "delivery_times_tenant_delete" ON public.delivery_times;

CREATE POLICY "delivery_times_tenant_select" ON public.delivery_times
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "delivery_times_tenant_insert" ON public.delivery_times
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "delivery_times_tenant_update" ON public.delivery_times
    FOR UPDATE TO authenticated
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "delivery_times_tenant_delete" ON public.delivery_times
    FOR DELETE TO authenticated
    USING (tenant_id = public.get_my_tenant_id());



