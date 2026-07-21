-- Otimização massiva de Índices Compostos para a função get_product_full_internal
-- Esses índices cobrem as cláusulas WHERE exatas usadas nos sub-selects da função de cardápio.

-- 1. Tabela product_variations
CREATE INDEX IF NOT EXISTS idx_product_variations_tenant_product 
ON public.product_variations (tenant_id, product_id);

-- 2. Tabela product_addon_selections
CREATE INDEX IF NOT EXISTS idx_pas_tenant_product_addon 
ON public.product_addon_selections (tenant_id, product_id, addon_id);

-- 3. Tabela group_attributes
CREATE INDEX IF NOT EXISTS idx_group_attributes_tenant_group_addon 
ON public.group_attributes (tenant_id, group_id, addon_id);

-- 4. Tabela category_modifier_groups
CREATE INDEX IF NOT EXISTS idx_category_modifier_groups_tenant_cat_group 
ON public.category_modifier_groups (tenant_id, category_id, group_id);

-- 5. Tabela products
-- Um índice para otimizar o JOIN com categories e filtro por tenant_id
CREATE INDEX IF NOT EXISTS idx_products_tenant_category_name
ON public.products (tenant_id, category_id, name);
