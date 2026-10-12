-- ═══════════════════════════════════════════════════════════════════
-- Migração: Restaurar leitura pública (anon) para vitrine
-- ═══════════════════════════════════════════════════════════════════
-- A migração 20260411110000_lockdown_tenant_read_policies.sql removeu
-- as políticas public_read de restaurants, business_hours, categories
-- e products. A tabela tenants nunca teve policy para anon.
-- Sem essas policies, visitantes anônimos não conseguem acessar a
-- loja pública (/r/:slug), causando "Erro ao carregar a loja".
-- ═══════════════════════════════════════════════════════════════════

-- 1. TENANTS — leitura pública por slug (necessário para resolver o tenant)
DROP POLICY IF EXISTS "tenants_public_read" ON public.tenants;
CREATE POLICY "tenants_public_read" ON public.tenants
    FOR SELECT
    TO anon
    USING (true);

-- 2. RESTAURANTS — leitura pública (vitrine: logo, banner, endereço, etc.)
DROP POLICY IF EXISTS "restaurants_public_read_v2" ON public.restaurants;
CREATE POLICY "restaurants_public_read_v2" ON public.restaurants
    FOR SELECT
    TO anon
    USING (true);

-- 3. BUSINESS_HOURS — leitura pública (exibir horários de funcionamento)
DROP POLICY IF EXISTS "business_hours_public_read_v2" ON public.business_hours;
CREATE POLICY "business_hours_public_read_v2" ON public.business_hours
    FOR SELECT
    TO anon
    USING (true);

-- 4. CATEGORIES — leitura pública (filtrar produtos por categoria)
DROP POLICY IF EXISTS "categories_public_read_v2" ON public.categories;
CREATE POLICY "categories_public_read_v2" ON public.categories
    FOR SELECT
    TO anon
    USING (true);

-- 5. PRODUCTS — leitura pública (listagem de produtos na vitrine)
DROP POLICY IF EXISTS "products_public_read_v2" ON public.products;
CREATE POLICY "products_public_read_v2" ON public.products
    FOR SELECT
    TO anon
    USING (true);

-- 6. TENANT_SUBSCRIPTIONS — leitura pública (verificar se loja está ativa)
DROP POLICY IF EXISTS "tenant_subscriptions_public_read" ON public.tenant_subscriptions;
CREATE POLICY "tenant_subscriptions_public_read" ON public.tenant_subscriptions
    FOR SELECT
    TO anon
    USING (true);

-- 7. Garantir que a RPC de produtos tem permissão para anon
GRANT EXECUTE ON FUNCTION public.get_product_full_by_tenant(UUID) TO anon;
