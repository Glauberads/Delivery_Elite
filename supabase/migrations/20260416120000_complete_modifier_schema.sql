-- Migration: Complete schema for Modifier Groups, Variations, and Product Selections
-- Date: 2026-04-16
-- Purpose: Create missing tables and fix RLS to enable unified contract

-- 1. Modifier Groups (master table for groups)
CREATE TABLE IF NOT EXISTS public.modifier_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    min_options INTEGER DEFAULT 0 NOT NULL,
    max_options INTEGER,
    pricing_rule VARCHAR(50) DEFAULT 'sum' NOT NULL,
    behavior_type VARCHAR(50) DEFAULT 'checkbox' NOT NULL,
    max_per_item INTEGER DEFAULT 1 NOT NULL,
    display_order INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT check_min_options CHECK (min_options >= 0),
    CONSTRAINT check_max_options CHECK (max_options IS NULL OR max_options >= min_options),
    CONSTRAINT check_pricing_rule CHECK (pricing_rule IN ('sum', 'highest', 'average')),
    CONSTRAINT check_behavior_type CHECK (behavior_type IN ('checkbox', 'stepper', 'fractional'))
);

-- RLS for modifier_groups
ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant can manage modifier_groups" ON public.modifier_groups;
CREATE POLICY "Tenant can manage modifier_groups" ON public.modifier_groups
    FOR ALL USING (tenant_id = public.get_my_tenant_id());

-- 2. Group Attributes (items within groups)
CREATE TABLE IF NOT EXISTS public.group_attributes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
    addon_id UUID NOT NULL REFERENCES public.product_addons(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    UNIQUE(group_id, addon_id)
);

-- RLS for group_attributes
ALTER TABLE public.group_attributes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant can manage group_attributes" ON public.group_attributes;
CREATE POLICY "Tenant can manage group_attributes" ON public.group_attributes
    FOR ALL USING (tenant_id = public.get_my_tenant_id());

-- 3. Product Variations
CREATE TABLE IF NOT EXISTS public.product_variations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for product_variations
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant can manage product_variations" ON public.product_variations;
CREATE POLICY "Tenant can manage product_variations" ON public.product_variations
    FOR ALL USING (tenant_id = public.get_my_tenant_id());

-- 4. Product Addon Selections (product-to-addon links for extras/sides)
CREATE TABLE IF NOT EXISTS public.product_addon_selections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    addon_id UUID NOT NULL REFERENCES public.product_addons(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('extras', 'sides')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    UNIQUE(product_id, addon_id, type)
);

-- RLS for product_addon_selections
ALTER TABLE public.product_addon_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant can manage product_addon_selections" ON public.product_addon_selections;
CREATE POLICY "Tenant can manage product_addon_selections" ON public.product_addon_selections
    FOR ALL USING (tenant_id = public.get_my_tenant_id());

-- 5. Category Modifier Groups (category-to-group links)
CREATE TABLE IF NOT EXISTS public.category_modifier_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    UNIQUE(category_id, group_id)
);

-- RLS for category_modifier_groups
ALTER TABLE public.category_modifier_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant can manage category_modifier_groups" ON public.category_modifier_groups;
CREATE POLICY "Tenant can manage category_modifier_groups" ON public.category_modifier_groups
    FOR ALL USING (tenant_id = public.get_my_tenant_id());

-- 6. Fractional Exclusions (for fractional/mezcla behavior)
CREATE TABLE IF NOT EXISTS public.fractional_exclusions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
    excluded_group_id UUID NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    UNIQUE(group_id, excluded_group_id)
);

-- RLS for fractional_exclusions
ALTER TABLE public.fractional_exclusions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant can manage fractional_exclusions" ON public.fractional_exclusions;
CREATE POLICY "Tenant can manage fractional_exclusions" ON public.fractional_exclusions
    FOR ALL USING (tenant_id = public.get_my_tenant_id());

-- 7. Add columns to products table for groups tracking (if not exist)
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS extras_group_id UUID REFERENCES public.modifier_groups(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS sides_group_id UUID REFERENCES public.modifier_groups(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS has_variations BOOLEAN DEFAULT false;

-- 8. Add group_id to product_addons (if not exist from previous migration)
ALTER TABLE public.product_addons
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.modifier_groups(id) ON DELETE SET NULL;

-- 9. Add tenant_id to category_modifier_groups if needed
ALTER TABLE public.category_modifier_groups
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.modifier_groups(id) ON DELETE CASCADE;

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_modifier_groups_tenant ON public.modifier_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_group_attributes_group ON public.group_attributes(group_id);
CREATE INDEX IF NOT EXISTS idx_group_attributes_addon ON public.group_attributes(addon_id);
CREATE INDEX IF NOT EXISTS idx_product_variations_product ON public.product_variations(product_id);
CREATE INDEX IF NOT EXISTS idx_product_addon_selections_product ON public.product_addon_selections(product_id);
CREATE INDEX IF NOT EXISTS idx_category_modifier_groups_category ON public.category_modifier_groups(category_id);
CREATE INDEX IF NOT EXISTS idx_category_modifier_groups_group ON public.category_modifier_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_fractional_exclusions_group ON public.fractional_exclusions(group_id);

-- 11. Update existing product_modifier_groups RLS (fix the incorrect policy)
DROP POLICY IF EXISTS "Lojista visualiza e edita os próprios grupos de adicionais" ON public.product_modifier_groups;
CREATE POLICY "Tenant can manage product_modifier_groups" ON public.product_modifier_groups
    FOR ALL USING (tenant_id = public.get_my_tenant_id());


