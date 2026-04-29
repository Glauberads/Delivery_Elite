-- ============================================
-- Função SEM PARÂMETRO (chamada pelo frontend)
-- public.get_product_full()
-- ============================================

DROP FUNCTION IF EXISTS public.get_product_full();

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
        COALESCE(c.name, '')::TEXT AS category_name,
        p.available,
        p.featured,
        p.created_at,
        COALESCE(p.has_variations, false) AS has_variations,
        p.extras_group_id,
        p.sides_group_id,
        
        -- Variations - DISTINCT para evitar duplicação
        COALESCE(
            (
                SELECT jsonb_agg(DISTINCT jsonb_build_object(
                    'id', v.id,
                    'name', v.name,
                    'price', v.price,
                    'sort_order', v.sort_order
                ))
                FROM public.product_variations v
                WHERE v.product_id = p.id AND v.tenant_id = v_tenant_id
            ),
            '[]'::jsonb
        ) AS variations,
        
        -- Groups - limitar items pela seleção real do produto (product_addon_selections)
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
                        'items',
                        CASE
                            WHEN mg.behavior_type IN ('fractional', 'flavor_mix') THEN
                                COALESCE(
                                    (
                                        SELECT jsonb_agg(
                                            jsonb_build_object(
                                                'id', fp.id,
                                                'name', fp.name,
                                                'price', fp.price,
                                                'display_order', 0
                                            )
                                            ORDER BY fp.name
                                        )
                                        FROM public.category_modifier_groups cmg_items
                                        JOIN public.products fp
                                          ON fp.category_id = cmg_items.category_id
                                         AND fp.tenant_id = v_tenant_id
                                        WHERE cmg_items.group_id = mg.id
                                          AND cmg_items.tenant_id = v_tenant_id
                                          AND COALESCE(fp.available, true) = true
                                    ),
                                    '[]'::jsonb
                                )
                            ELSE
                                COALESCE(
                                    (
                                        SELECT jsonb_agg(
                                            jsonb_build_object(
                                                'id', ga.addon_id,
                                                'name', pa.name,
                                                'price', pa.price,
                                                'display_order', ga.display_order
                                            )
                                            ORDER BY ga.display_order
                                        )
                                        FROM public.group_attributes ga
                                        JOIN public.product_addons pa ON pa.id = ga.addon_id
                                        WHERE ga.group_id = mg.id
                                          AND ga.tenant_id = v_tenant_id
                                          AND pa.tenant_id = v_tenant_id
                                          AND (
                                              (
                                                  mg.behavior_type IN ('checkbox', 'extras')
                                                  AND EXISTS (
                                                      SELECT 1
                                                      FROM public.product_addon_selections pas
                                                      WHERE pas.tenant_id = v_tenant_id
                                                        AND pas.product_id = p.id
                                                        AND pas.addon_id = ga.addon_id
                                                        AND pas.type = 'extras'
                                                  )
                                              )
                                              OR (
                                                  mg.behavior_type IN ('stepper', 'side_items')
                                                  AND EXISTS (
                                                      SELECT 1
                                                      FROM public.product_addon_selections pas
                                                      WHERE pas.tenant_id = v_tenant_id
                                                        AND pas.product_id = p.id
                                                        AND pas.addon_id = ga.addon_id
                                                        AND pas.type = 'sides'
                                                  )
                                              )
                                          )
                                    ),
                                    '[]'::jsonb
                                )
                        END
                    )
                    ORDER BY mg.display_order, mg.name
                )
                FROM public.modifier_groups mg
                WHERE mg.tenant_id = v_tenant_id
                  AND (
                    mg.id = p.extras_group_id
                    OR mg.id = p.sides_group_id
                    OR EXISTS (
                    SELECT 1 FROM public.category_modifier_groups cmg 
                    WHERE cmg.tenant_id = v_tenant_id
                      AND cmg.category_id = p.category_id
                      AND cmg.group_id = mg.id
                    )
                  )
                  AND EXISTS (
                    SELECT 1
                    FROM public.group_attributes ga
                    JOIN public.product_addons pa
                      ON pa.id = ga.addon_id
                     AND pa.tenant_id = v_tenant_id
                    LEFT JOIN public.product_addon_selections pas
                      ON pas.addon_id = ga.addon_id
                     AND pas.product_id = p.id
                     AND pas.tenant_id = v_tenant_id
                    WHERE ga.group_id = mg.id
                      AND ga.tenant_id = v_tenant_id
                      AND (
                        (mg.behavior_type IN ('checkbox', 'extras') AND pas.type = 'extras')
                        OR
                        (mg.behavior_type IN ('stepper', 'side_items') AND pas.type = 'sides')
                      )
                    UNION ALL
                    SELECT 1
                    FROM public.category_modifier_groups cmg_fx
                    JOIN public.products fp
                      ON fp.category_id = cmg_fx.category_id
                     AND fp.tenant_id = v_tenant_id
                    WHERE cmg_fx.group_id = mg.id
                      AND cmg_fx.tenant_id = v_tenant_id
                      AND mg.behavior_type IN ('fractional', 'flavor_mix')
                      AND COALESCE(fp.available, true) = true
                  )
            ),
            '[]'::jsonb
        ) AS groups
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE p.tenant_id = v_tenant_id
    ORDER BY p.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_full() TO authenticated;


-- ============================================
-- Função COM PARÂMETRO (para uso administrativo)
-- public.get_product_full_by_tenant(p_tenant_id uuid)
-- ============================================

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
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.image_url,
        p.category_id,
        COALESCE(c.name, '')::TEXT AS category_name,
        p.available,
        p.featured,
        p.created_at,
        COALESCE(p.has_variations, false) AS has_variations,
        p.extras_group_id,
        p.sides_group_id,
        
        COALESCE(
            (
                SELECT jsonb_agg(DISTINCT jsonb_build_object(
                    'id', v.id,
                    'name', v.name,
                    'price', v.price,
                    'sort_order', v.sort_order
                ))
                FROM public.product_variations v
                WHERE v.product_id = p.id AND v.tenant_id = p_tenant_id
            ),
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
                        'items',
                        CASE
                            WHEN mg.behavior_type IN ('fractional', 'flavor_mix') THEN
                                COALESCE(
                                    (
                                        SELECT jsonb_agg(
                                            jsonb_build_object(
                                                'id', fp.id,
                                                'name', fp.name,
                                                'price', fp.price,
                                                'display_order', 0
                                            )
                                            ORDER BY fp.name
                                        )
                                        FROM public.category_modifier_groups cmg_items
                                        JOIN public.products fp
                                          ON fp.category_id = cmg_items.category_id
                                         AND fp.tenant_id = p_tenant_id
                                        WHERE cmg_items.group_id = mg.id
                                          AND cmg_items.tenant_id = p_tenant_id
                                          AND COALESCE(fp.available, true) = true
                                    ),
                                    '[]'::jsonb
                                )
                            ELSE
                                COALESCE(
                                    (
                                        SELECT jsonb_agg(
                                            jsonb_build_object(
                                                'id', ga.addon_id,
                                                'name', pa.name,
                                                'price', pa.price,
                                                'display_order', ga.display_order
                                            )
                                            ORDER BY ga.display_order
                                        )
                                        FROM public.group_attributes ga
                                        JOIN public.product_addons pa ON pa.id = ga.addon_id
                                        WHERE ga.group_id = mg.id
                                          AND ga.tenant_id = p_tenant_id
                                          AND pa.tenant_id = p_tenant_id
                                          AND (
                                              (
                                                  mg.behavior_type IN ('checkbox', 'extras')
                                                  AND EXISTS (
                                                      SELECT 1
                                                      FROM public.product_addon_selections pas
                                                      WHERE pas.tenant_id = p_tenant_id
                                                        AND pas.product_id = p.id
                                                        AND pas.addon_id = ga.addon_id
                                                        AND pas.type = 'extras'
                                                  )
                                              )
                                              OR (
                                                  mg.behavior_type IN ('stepper', 'side_items')
                                                  AND EXISTS (
                                                      SELECT 1
                                                      FROM public.product_addon_selections pas
                                                      WHERE pas.tenant_id = p_tenant_id
                                                        AND pas.product_id = p.id
                                                        AND pas.addon_id = ga.addon_id
                                                        AND pas.type = 'sides'
                                                  )
                                              )
                                          )
                                    ),
                                    '[]'::jsonb
                                )
                        END
                    )
                    ORDER BY mg.display_order, mg.name
                )
                FROM public.modifier_groups mg
                WHERE mg.tenant_id = p_tenant_id
                  AND (
                    mg.id = p.extras_group_id
                    OR mg.id = p.sides_group_id
                    OR EXISTS (
                    SELECT 1 FROM public.category_modifier_groups cmg 
                    WHERE cmg.tenant_id = p_tenant_id
                      AND cmg.category_id = p.category_id
                      AND cmg.group_id = mg.id
                    )
                  )
                  AND EXISTS (
                    SELECT 1
                    FROM public.group_attributes ga
                    JOIN public.product_addons pa
                      ON pa.id = ga.addon_id
                     AND pa.tenant_id = p_tenant_id
                    LEFT JOIN public.product_addon_selections pas
                      ON pas.addon_id = ga.addon_id
                     AND pas.product_id = p.id
                     AND pas.tenant_id = p_tenant_id
                    WHERE ga.group_id = mg.id
                      AND ga.tenant_id = p_tenant_id
                      AND (
                        (mg.behavior_type IN ('checkbox', 'extras') AND pas.type = 'extras')
                        OR
                        (mg.behavior_type IN ('stepper', 'side_items') AND pas.type = 'sides')
                      )
                    UNION ALL
                    SELECT 1
                    FROM public.category_modifier_groups cmg_fx
                    JOIN public.products fp
                      ON fp.category_id = cmg_fx.category_id
                     AND fp.tenant_id = p_tenant_id
                    WHERE cmg_fx.group_id = mg.id
                      AND cmg_fx.tenant_id = p_tenant_id
                      AND mg.behavior_type IN ('fractional', 'flavor_mix')
                      AND COALESCE(fp.available, true) = true
                  )
            ),
            '[]'::jsonb
        ) AS groups
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE p.tenant_id = p_tenant_id
    ORDER BY p.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_full_by_tenant(UUID) TO authenticated;



