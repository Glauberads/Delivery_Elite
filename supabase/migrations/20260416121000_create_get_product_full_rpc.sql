-- Migration: Create get_product_full RPC function
-- Date: 2026-04-16
-- Purpose: Unified contract for PDV, Home, and Modal to read products with groups/variations

-- Drop existing functions if they conflict
DROP FUNCTION IF EXISTS public.get_product_full();
DROP FUNCTION IF EXISTS public.get_product_full(uuid);

-- Create unified function that returns products with variations and groups
CREATE OR REPLACE FUNCTION public.get_product_full(p_tenant_id UUID DEFAULT NULL)
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
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Use provided tenant_id or get from auth context
    v_tenant_id := COALESCE(p_tenant_id, public.get_my_tenant_id());
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant não identificado';
    END IF;

    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.image_url,
        p.category_id,
        c.name::TEXT AS category_name,
        p.available,
        p.featured,
        p.created_at,
        p.has_variations,
        p.extras_group_id,
        p.sides_group_id,
        
        -- Variations as JSONB
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', v.id,
                    'name', v.name,
                    'price', v.price,
                    'sort_order', v.sort_order
                )
            ) FILTER (WHERE v.id IS NOT NULL),
            '[]'::jsonb
        ) AS variations,
        
        -- Groups (from category inheritance + direct product links)
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', mg.id,
                        'name', mg.name,
                        'behavior_type', mg.behavior_type,
                        'min_options', mg.min_options,
                        'max_options', mg.max_options,
                        'pricing_rule', mg.pricing_rule,
                        'items', COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'id', ga.addon_id,
                                        'name', pa.name,
                                        'price', pa.price,
                                        'display_order', ga.display_order
                                    )
                                ) FILTER (WHERE ga.addon_id IS NOT NULL),
                                '[]'::jsonb
                            )
                        )
                    )
                )
                FROM public.modifier_groups mg
                LEFT JOIN public.group_attributes ga ON ga.group_id = mg.id
                LEFT JOIN public.product_addons pa ON pa.id = ga.addon_id
                WHERE mg.id IN (
                    -- Direct groups from product
                    SELECT p.extras_group_id FROM public.products p WHERE p.id = products.id
                    UNION
                    SELECT p.sides_group_id FROM public.products p WHERE p.id = products.id
                    UNION
                    -- Inherited from category
                    SELECT cmg.group_id 
                    FROM public.category_modifier_groups cmg 
                    WHERE cmg.category_id = products.category_id
                )
            ),
            '[]'::jsonb
        ) AS groups
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN public.product_variations v ON v.product_id = p.id AND v.tenant_id = v_tenant_id
    WHERE p.tenant_id = v_tenant_id
    GROUP BY p.id, c.name
    ORDER BY p.name ASC;
END;
$$;

-- Create simpler version without tenant_id (uses auth context)
CREATE OR REPLACE FUNCTION public.get_product_full()
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
    RETURN QUERY SELECT * FROM public.get_product_full(NULL);
END;
$$;

-- Create function to get product by ID with full details
CREATE OR REPLACE FUNCTION public.get_product_by_id(p_product_id UUID)
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
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := public.get_my_tenant_id();
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant não identificado';
    END IF;

    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.image_url,
        p.category_id,
        c.name::TEXT AS category_name,
        p.available,
        p.featured,
        p.created_at,
        p.has_variations,
        p.extras_group_id,
        p.sides_group_id,
        
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', v.id,
                    'name', v.name,
                    'price', v.price,
                    'sort_order', v.sort_order
                )
            ) FILTER (WHERE v.id IS NOT NULL),
            '[]'::jsonb
        ) AS variations,
        
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', mg.id,
                        'name', mg.name,
                        'behavior_type', mg.behavior_type,
                        'min_options', mg.min_options,
                        'max_options', mg.max_options,
                        'pricing_rule', mg.pricing_rule,
                        'items', COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'id', ga.addon_id,
                                        'name', pa.name,
                                        'price', pa.price,
                                        'display_order', ga.display_order
                                    )
                                ) FILTER (WHERE ga.addon_id IS NOT NULL),
                                '[]'::jsonb
                            )
                        )
                    )
                )
                FROM public.modifier_groups mg
                LEFT JOIN public.group_attributes ga ON ga.group_id = mg.id
                LEFT JOIN public.product_addons pa ON pa.id = ga.addon_id
                WHERE mg.id IN (
                    SELECT p.extras_group_id FROM public.products p WHERE p.id = products.id
                    UNION
                    SELECT p.sides_group_id FROM public.products p WHERE p.id = products.id
                    UNION
                    SELECT cmg.group_id 
                    FROM public.category_modifier_groups cmg 
                    WHERE cmg.category_id = products.category_id
                )
            ),
            '[]'::jsonb
        ) AS groups
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN public.product_variations v ON v.product_id = p.id AND v.tenant_id = v_tenant_id
    WHERE p.id = p_product_id AND p.tenant_id = v_tenant_id
    GROUP BY p.id, c.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_full() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_full(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_by_id(uuid) TO authenticated;


