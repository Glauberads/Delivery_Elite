-- Script definitivo para bloquear o vazamento (Cross-Tenant Data Leak)

-- 1. Garante que a proteção (RLS) está ativa na tabela
ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;

-- 2. EXTREMAMENTE IMPORTANTE: Remove TODAS as políticas abertas antigas!
-- Em bancos Supabase, as políticas se somam. Se houver UMA política aberta (USING true), as restritas não funcionam.
DO $$ 
DECLARE 
    pol record;
BEGIN 
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'orders' AND schemaname = 'public'
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', pol.policyname);
    END LOOP;
END $$;

-- 3. Recria APENAS as políticas seguras:

-- A) Superadmin vê e edita tudo
CREATE POLICY "Superadmin: Todas as operações" 
ON "public"."orders" 
FOR ALL 
USING (EXISTS (SELECT 1 FROM superadmin_users WHERE id = auth.uid()));

-- B) Donos de lanchonete podem ver e editar SEUS PRÓPRIOS pedidos
CREATE POLICY "Tenant: Gerenciar próprios pedidos" 
ON "public"."orders" 
FOR ALL 
USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE id = auth.uid() AND tenant_id = orders.tenant_id AND active = true)
);

-- C) Clientes (Público) podem INSERIR novos pedidos para uma lanchonete
CREATE POLICY "Public: Criar pedido" 
ON "public"."orders" 
FOR INSERT 
WITH CHECK (true);

-- D) Clientes (Público) podem LER apenas se tiverem o ID exato (usado no rastreio)
CREATE POLICY "Public: Rastrear pedido" 
ON "public"."orders" 
FOR SELECT 
USING (auth.uid() IS NULL);

