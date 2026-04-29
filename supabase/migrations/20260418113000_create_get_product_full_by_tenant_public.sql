-- Public read RPC for storefront/home flow (slug -> tenant_id)
-- Keeps multi-tenant isolation by requiring explicit p_tenant_id
-- and reusing the unified product contract from get_product_full(p_tenant_id)

DROP FUNCTION IF EXISTS public.get_product_full_by_tenant(uuid);

CREATE OR REPLACE FUNCTION public.get_product_full_by_tenant(p_tenant_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    price DECIMAL(10,2),
    image_url TEXT,
    category_id UUID,
    category_name TEXT,
    available BOOLEAN,
    featured BOOLEAN,
    created_at TIMESTAMPTZ,
    has_variations BOOLEAN,
    extras_group_id UUID,
    sides_group_id UUID,
    variations JSONB,
    groups JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant não identificado';
    END IF;

    RETURN QUERY
    SELECT *
    FROM public.get_product_full(p_tenant_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_full_by_tenant(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_product_full_by_tenant(UUID) TO authenticated;



