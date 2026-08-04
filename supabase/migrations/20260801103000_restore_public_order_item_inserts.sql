CREATE OR REPLACE FUNCTION public.can_insert_public_order_item(
    p_order_id UUID,
    p_product_id UUID,
    p_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.orders AS orders
        JOIN public.products AS products
          ON products.id = p_product_id
         AND products.tenant_id = p_tenant_id
        WHERE orders.id = p_order_id
          AND orders.tenant_id = p_tenant_id
          AND orders.status = 'pending'
          AND orders.created_at >= NOW() - INTERVAL '15 minutes'
    );
$$;

CREATE OR REPLACE FUNCTION public.can_insert_public_order_item_addon(
    p_order_item_id UUID,
    p_addon_id UUID,
    p_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.order_items AS order_items
        JOIN public.orders AS orders
          ON orders.id = order_items.order_id
         AND orders.tenant_id = p_tenant_id
        JOIN public.product_addons AS addons
          ON addons.id = p_addon_id
         AND (addons.tenant_id = p_tenant_id OR addons.is_global = TRUE)
        WHERE order_items.id = p_order_item_id
          AND order_items.tenant_id = p_tenant_id
          AND orders.status = 'pending'
          AND orders.created_at >= NOW() - INTERVAL '15 minutes'
    );
$$;

REVOKE ALL ON FUNCTION public.can_insert_public_order_item(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_insert_public_order_item_addon(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_insert_public_order_item(UUID, UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.can_insert_public_order_item_addon(UUID, UUID, UUID) TO anon;

DROP POLICY IF EXISTS "order_items_public_insert" ON public.order_items;
CREATE POLICY "order_items_public_insert"
    ON public.order_items
    FOR INSERT
    TO anon
    WITH CHECK (
        tenant_id IS NOT NULL
        AND public.can_insert_public_order_item(order_id, product_id, tenant_id)
    );

DROP POLICY IF EXISTS "order_item_addons_public_insert" ON public.order_item_addons;
CREATE POLICY "order_item_addons_public_insert"
    ON public.order_item_addons
    FOR INSERT
    TO anon
    WITH CHECK (
        tenant_id IS NOT NULL
        AND public.can_insert_public_order_item_addon(order_item_id, addon_id, tenant_id)
    );
