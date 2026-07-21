-- =================================================================================
-- Migration de Segurança Crítica: Contenção de Vazamento de Pedidos (RLS)
-- Remove as políticas "Allow all operações" remanescentes das tabelas de pedidos
-- =================================================================================

-- 1. Remoção de políticas superpermissivas herdadas da migration inicial
DROP POLICY IF EXISTS "Allow all operations on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow all operations on order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow all operations on order_item_addons" ON public.order_item_addons;

-- (As políticas corretas baseadas em tenant, como "orders_own_tenant", 
--  já foram criadas em saas_migration.sql e agora finalmente terão efeito sem 
--  serem sobrepostas por uma política USING (true) global)
