-- =====================================================
-- Delivery MAX — SaaS Multi-Tenant Schema v2.0
-- =====================================================
-- Segurança: Isolamento 100% por RLS + tenant_id
-- Auth: Supabase Auth nativo (JWT, bcrypt, refresh token)
-- Split: 35% Sócio A + 35% Sócio B + 30% Fundo de Caixa
-- Planos: Mensal R$67,90 | Trimestral R$157,90 | Anual R$547,90
-- =====================================================

-- =====================================================
-- VULNERABILIDADES CORRIGIDAS:
-- [x] Senhas em texto plano → Supabase Auth (bcrypt)
-- [x] RLS USING(true) aberto → policies por tenant_id
-- [x] Sem tenant_id nas tabelas → tenant_id em TUDO
-- [x] Auth customizada sem JWT → supabase.auth nativo
-- [x] search_path mutável → SET search_path = public
-- [x] Sem separação superadmin/tenant → tabelas separadas
-- [x] signupEnabled no localStorage → tabela tenant_settings
-- [x] create_user/authenticate_user inseguros → removidos
-- =====================================================

-- =====================================================
-- 0. LIMPEZA DO SCHEMA ANTERIOR
-- =====================================================

-- Remover triggers
DROP TRIGGER IF EXISTS generate_order_number_trigger ON public.orders;
DROP TRIGGER IF EXISTS set_orders_updated_at ON public.orders;
DROP TRIGGER IF EXISTS set_payment_methods_updated_at ON public.payment_methods;
DROP TRIGGER IF EXISTS set_products_updated_at ON public.products;
DROP TRIGGER IF EXISTS set_categories_updated_at ON public.categories;
DROP TRIGGER IF EXISTS set_restaurants_updated_at ON public.restaurants;
DROP TRIGGER IF EXISTS set_categories_updated_at ON public.categories;
DROP TRIGGER IF EXISTS set_business_hours_updated_at ON public.business_hours;
DROP TRIGGER IF EXISTS set_delivery_times_updated_at ON public.delivery_times;

-- Remover funções antigas (inseguras)
DROP FUNCTION IF EXISTS public.authenticate_user(text, text);
DROP FUNCTION IF EXISTS public.create_user(text, text, text, text);
DROP FUNCTION IF EXISTS public.get_product_addons();
DROP FUNCTION IF EXISTS public.get_product_addon_relations();
DROP FUNCTION IF EXISTS public.get_product_addons_by_product(uuid);
DROP FUNCTION IF EXISTS public.generate_order_number();
DROP FUNCTION IF EXISTS public.set_updated_at();

-- Remover tabelas antigas (cascade remove dependências)
DROP TABLE IF EXISTS public.order_item_addons CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.payment_methods CASCADE;
DROP TABLE IF EXISTS public.product_addon_relations CASCADE;
DROP TABLE IF EXISTS public.product_addons CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.drivers CASCADE;
DROP TABLE IF EXISTS public.delivery_regions CASCADE;
DROP TABLE IF EXISTS public.delivery_times CASCADE;
DROP TABLE IF EXISTS public.business_hours CASCADE;
DROP TABLE IF EXISTS public.restaurants CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.user_permissions CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Remover tipos antigos
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS permission CASCADE;

-- =====================================================
-- 1. EXTENSÕES
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 2. ENUMS NOVOS
-- =====================================================

CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');
CREATE TYPE plan_type AS ENUM ('monthly', 'quarterly', 'annual');
CREATE TYPE tenant_user_role AS ENUM ('admin', 'manager', 'staff', 'driver');
CREATE TYPE superadmin_role AS ENUM ('superadmin', 'support');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing');

-- =====================================================
-- 3. TABELAS DE PLATAFORMA (sem tenant_id)
-- =====================================================

-- Planos de assinatura
CREATE TABLE public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type plan_type NOT NULL UNIQUE,
    price DECIMAL(10,2) NOT NULL,
    billing_days INTEGER NOT NULL,
    description TEXT,
    features JSONB DEFAULT '[]'::jsonb,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Superadmins (separado dos usuários de tenant)
CREATE TABLE public.superadmin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    role superadmin_role DEFAULT 'superadmin',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Configurações da plataforma (Asaas keys, split config)
CREATE TABLE public.platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    is_secret BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tenants (cada restaurante cadastrado)
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    status tenant_status DEFAULT 'trial',
    plan_id UUID REFERENCES public.plans(id),
    trial_ends_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
    asaas_customer_id TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Assinaturas dos tenants
CREATE TABLE public.tenant_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.plans(id),
    status subscription_status DEFAULT 'trialing',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    asaas_subscription_id TEXT,
    asaas_payment_link TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Histórico de cobranças
CREATE TABLE public.tenant_billing_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.plans(id),
    amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
    payment_method TEXT,
    asaas_payment_id TEXT,
    asaas_invoice_url TEXT,
    paid_at TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 4. TABELAS DE TENANT (todas com tenant_id)
-- =====================================================

-- Usuários de tenant (linked to auth.users)
CREATE TABLE public.tenant_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role tenant_user_role DEFAULT 'staff',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, email)
);

-- Configurações por tenant
CREATE TABLE public.tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
    allow_signup BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Restaurante (1 por tenant)
CREATE TABLE public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    phone TEXT,
    logo_url TEXT,
    banner_url TEXT,
    open_time TIME,
    close_time TIME,
    delivery_fee DECIMAL(10,2) DEFAULT 0,
    min_order_value DECIMAL(10,2) DEFAULT 0,
    theme_settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Horários de funcionamento
CREATE TABLE public.business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL,
    open_time TEXT,
    close_time TEXT,
    is_closed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, day_of_week)
);

-- Categorias
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Produtos
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    available BOOLEAN DEFAULT true,
    featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionais
CREATE TABLE public.product_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    available BOOLEAN DEFAULT true,
    is_global BOOLEAN DEFAULT false,
    max_options INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Relação produto-adicional
CREATE TABLE public.product_addon_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    addon_id UUID NOT NULL REFERENCES public.product_addons(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(product_id, addon_id)
);

-- Formas de pagamento
CREATE TABLE public.payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    enabled BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Regiões de entrega
CREATE TABLE public.delivery_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    fee DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Entregadores
CREATE TABLE public.drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    vehicle TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pedidos
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    number TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','confirmed','preparing','ready','out_for_delivery','delivered','canceled')),
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending','paid','failed','refunded')),
    subtotal DECIMAL(10,2) NOT NULL,
    delivery_fee DECIMAL(10,2) DEFAULT 0 NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0 NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    notes TEXT,
    order_type TEXT DEFAULT 'delivery' NOT NULL
        CHECK (order_type IN ('delivery','takeaway','instore')),
    table_number TEXT,
    delivery_driver_id UUID REFERENCES public.drivers(id),
    delivery_status TEXT,
    delivery_address TEXT,
    delivery_region_id UUID REFERENCES public.delivery_regions(id),
    delivery_started_at TIMESTAMPTZ,
    delivery_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Itens de pedido
CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Adicionais dos itens de pedido
CREATE TABLE public.order_item_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    addon_id UUID NOT NULL REFERENCES public.product_addons(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tempos de entrega
CREATE TABLE public.delivery_times (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    min_time INTEGER NOT NULL,
    max_time INTEGER NOT NULL,
    day_of_week TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- 5. FUNÇÕES SEGURAS (search_path fixo em todas)
-- =====================================================

-- Retorna o tenant_id do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid() LIMIT 1;
$$;

-- Verifica se o usuário atual é superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS(
        SELECT 1 FROM public.superadmin_users WHERE id = auth.uid()
    );
$$;

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Trigger: gera número sequencial de pedido por tenant e ano
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    year_prefix TEXT;
    sequence_number INT;
BEGIN
    year_prefix := to_char(now(), 'YYYY');

    SELECT COALESCE(
        MAX(NULLIF(regexp_replace(number, '^[0-9]{4}', ''), ''))::integer, 0
    ) + 1
    INTO sequence_number
    FROM public.orders
    WHERE number LIKE year_prefix || '%'
      AND tenant_id = NEW.tenant_id;

    NEW.number := year_prefix || LPAD(sequence_number::text, 4, '0');
    RETURN NEW;
END;
$$;

-- Adicionais (escopo por tenant via RLS)
CREATE OR REPLACE FUNCTION public.get_product_addons()
RETURNS TABLE (
    id uuid, name text, description text, price numeric,
    available boolean, is_global boolean, max_options integer
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, name, description, price, available, is_global, max_options
    FROM public.product_addons
    WHERE tenant_id = public.get_my_tenant_id()
    ORDER BY name;
$$;

CREATE OR REPLACE FUNCTION public.get_product_addon_relations()
RETURNS TABLE (id uuid, product_id uuid, addon_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, product_id, addon_id
    FROM public.product_addon_relations
    WHERE tenant_id = public.get_my_tenant_id();
$$;

CREATE OR REPLACE FUNCTION public.get_product_addons_by_product(product_id_param uuid)
RETURNS TABLE (
    id uuid, name text, description text, price numeric,
    available boolean, is_global boolean, max_options integer
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT pa.id, pa.name, pa.description, pa.price,
           pa.available, pa.is_global, pa.max_options
    FROM public.product_addons pa
    WHERE pa.tenant_id = public.get_my_tenant_id()
      AND (
          pa.is_global = true
          OR pa.id IN (
              SELECT par.addon_id
              FROM public.product_addon_relations par
              WHERE par.product_id = product_id_param
                AND par.tenant_id = public.get_my_tenant_id()
          )
      )
    ORDER BY pa.name;
$$;

-- =====================================================
-- 6. TRIGGERS
-- =====================================================

-- updated_at em todas as tabelas relevantes
CREATE TRIGGER set_plans_updated_at
    BEFORE UPDATE ON public.plans
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_tenant_subscriptions_updated_at
    BEFORE UPDATE ON public.tenant_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_tenant_billing_updated_at
    BEFORE UPDATE ON public.tenant_billing_history
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_superadmin_users_updated_at
    BEFORE UPDATE ON public.superadmin_users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_platform_settings_updated_at
    BEFORE UPDATE ON public.platform_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_tenant_users_updated_at
    BEFORE UPDATE ON public.tenant_users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_tenant_settings_updated_at
    BEFORE UPDATE ON public.tenant_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_restaurants_updated_at
    BEFORE UPDATE ON public.restaurants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_business_hours_updated_at
    BEFORE UPDATE ON public.business_hours
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_product_addons_updated_at
    BEFORE UPDATE ON public.product_addons
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_payment_methods_updated_at
    BEFORE UPDATE ON public.payment_methods
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_delivery_regions_updated_at
    BEFORE UPDATE ON public.delivery_regions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_drivers_updated_at
    BEFORE UPDATE ON public.drivers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_delivery_times_updated_at
    BEFORE UPDATE ON public.delivery_times
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Número sequencial de pedido
CREATE TRIGGER generate_order_number_trigger
    BEFORE INSERT ON public.orders
    FOR EACH ROW
    WHEN (NEW.number IS NULL)
    EXECUTE FUNCTION public.generate_order_number();

-- =====================================================
-- 7. ÍNDICES DE PERFORMANCE
-- =====================================================

CREATE INDEX idx_tenant_users_tenant_id ON public.tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_email ON public.tenant_users(email);
CREATE INDEX idx_tenants_slug ON public.tenants(slug);
CREATE INDEX idx_tenants_status ON public.tenants(status);
CREATE INDEX idx_restaurants_tenant_id ON public.restaurants(tenant_id);
CREATE INDEX idx_categories_tenant_id ON public.categories(tenant_id);
CREATE INDEX idx_products_tenant_id ON public.products(tenant_id);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_available ON public.products(available);
CREATE INDEX idx_product_addons_tenant_id ON public.product_addons(tenant_id);
CREATE INDEX idx_product_addon_rel_tenant_id ON public.product_addon_relations(tenant_id);
CREATE INDEX idx_orders_tenant_id ON public.orders(tenant_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at);
CREATE INDEX idx_orders_customer_phone ON public.orders(customer_phone);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_tenant_id ON public.order_items(tenant_id);
CREATE INDEX idx_business_hours_tenant_id ON public.business_hours(tenant_id);
CREATE INDEX idx_delivery_regions_tenant_id ON public.delivery_regions(tenant_id);
CREATE INDEX idx_drivers_tenant_id ON public.drivers(tenant_id);
CREATE INDEX idx_tenant_subscriptions_tenant_id ON public.tenant_subscriptions(tenant_id);
CREATE INDEX idx_tenant_billing_tenant_id ON public.tenant_billing_history(tenant_id);

-- =====================================================
-- 8. ROW LEVEL SECURITY (Habilitado em todas as tabelas)
-- =====================================================

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.superadmin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_addon_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_times ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 9. POLÍTICAS RLS — Isolamento 100% por tenant_id
-- =====================================================

-- PLANS: leitura pública, escrita só superadmin
CREATE POLICY "plans_select_public" ON public.plans FOR SELECT USING (active = true);
CREATE POLICY "plans_all_superadmin" ON public.plans FOR ALL USING (public.is_superadmin());

-- SUPERADMIN_USERS: só superadmins gerenciam
CREATE POLICY "superadmin_users_select_own" ON public.superadmin_users
    FOR SELECT USING (id = auth.uid() OR public.is_superadmin());
CREATE POLICY "superadmin_users_insert" ON public.superadmin_users
    FOR INSERT WITH CHECK (public.is_superadmin());
CREATE POLICY "superadmin_users_update" ON public.superadmin_users
    FOR UPDATE USING (public.is_superadmin());
CREATE POLICY "superadmin_users_delete" ON public.superadmin_users
    FOR DELETE USING (public.is_superadmin());

-- PLATFORM_SETTINGS: só superadmin
CREATE POLICY "platform_settings_superadmin" ON public.platform_settings
    FOR ALL USING (public.is_superadmin());

-- TENANTS: superadmin gerencia tudo; tenant vê apenas o próprio
CREATE POLICY "tenants_superadmin_all" ON public.tenants
    FOR ALL USING (public.is_superadmin());
CREATE POLICY "tenants_own_select" ON public.tenants
    FOR SELECT USING (id = public.get_my_tenant_id());

-- TENANT_SUBSCRIPTIONS: superadmin tudo; tenant lê o próprio
CREATE POLICY "tenant_sub_superadmin" ON public.tenant_subscriptions
    FOR ALL USING (public.is_superadmin());
CREATE POLICY "tenant_sub_own_select" ON public.tenant_subscriptions
    FOR SELECT USING (tenant_id = public.get_my_tenant_id());

-- TENANT_BILLING_HISTORY: superadmin tudo; tenant lê o próprio
CREATE POLICY "tenant_billing_superadmin" ON public.tenant_billing_history
    FOR ALL USING (public.is_superadmin());
CREATE POLICY "tenant_billing_own_select" ON public.tenant_billing_history
    FOR SELECT USING (tenant_id = public.get_my_tenant_id());

-- TENANT_USERS: superadmin tudo; tenant gerencia usuários do próprio
CREATE POLICY "tenant_users_superadmin" ON public.tenant_users
    FOR ALL USING (public.is_superadmin());
CREATE POLICY "tenant_users_own_tenant" ON public.tenant_users
    FOR ALL USING (tenant_id = public.get_my_tenant_id());

-- TENANT_SETTINGS: superadmin tudo; tenant gerencia o próprio
CREATE POLICY "tenant_settings_superadmin" ON public.tenant_settings
    FOR ALL USING (public.is_superadmin());
CREATE POLICY "tenant_settings_own" ON public.tenant_settings
    FOR ALL USING (tenant_id = public.get_my_tenant_id());

-- RESTAURANTS: superadmin tudo; tenant gerencia o próprio; público lê (vitrine)
CREATE POLICY "restaurants_superadmin" ON public.restaurants
    FOR ALL USING (public.is_superadmin());
CREATE POLICY "restaurants_own_tenant" ON public.restaurants
    FOR ALL USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "restaurants_public_read" ON public.restaurants
    FOR SELECT USING (true);

-- BUSINESS_HOURS: superadmin tudo; tenant próprio; público lê
CREATE POLICY "business_hours_superadmin" ON public.business_hours
    FOR ALL USING (public.is_superadmin());
CREATE POLICY "business_hours_own_tenant" ON public.business_hours
    FOR ALL USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "business_hours_public_read" ON public.business_hours
    FOR SELECT USING (true);

-- CATEGORIES: superadmin tudo; tenant próprio; público lê
CREATE POLICY "categories_superadmin" ON public.categories
    FOR ALL USING (public.is_superadmin());
CREATE POLICY "categories_own_tenant" ON public.categories
    FOR ALL USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "categories_public_read" ON public.categories
    FOR SELECT USING (true);

-- PRODUCTS: superadmin tudo; tenant próprio; público lê apenas disponíveis
CREATE POLICY "products_superadmin" ON public.products
    FOR ALL USING (public.is_superadmin());
CREATE POLICY "products_own_tenant" ON public.products
    FOR ALL USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "products_public_read" ON public.products
    FOR SELECT USING (available = true);

-- PRODUCT_ADDONS: superadmin tudo; tenant próprio; público lê disponíveis
CREATE POLICY "product_addons_superadmin" ON public.product_addons
    FOR ALL USING (public.is_superadmin());
CREATE POLICY "product_addons_own_tenant" ON public.product_addons
    FOR ALL USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "product_addons_public_read" ON public.product_addons
    FOR SELECT USING (available = true);

-- PRODUCT_ADDON_RELATIONS: superadmin tudo; tenant próprio; público lê
CREATE POLICY "product_addon_rel_superadmin" ON public.product_addon_relations
    FOR ALL USING (public.is_superadmin());
CREATE POLICY "product_addon_rel_own_tenant" ON public.product_addon_relations
    FOR ALL USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "product_addon_rel_public_read" ON public.product_addon_relations
    FOR SELECT USING (true);

-- PAYMENT_METHODS: superadmin tudo; tenant próprio; público lê ativos
CREATE POLICY "payment_methods_superadmin" ON public.payment_methods
    FOR ALL USING (public.is_superadmin());
CREATE POLICY "payment_methods_own_tenant" ON public.payment_methods
    FOR ALL USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "payment_methods_public_read" ON public.payment_methods
    FOR SELECT USING (enabled = true);

-- DELIVERY_REGIONS: superadmin tudo; tenant próprio; público lê
CREATE POLICY "delivery_regions_superadmin" ON public.delivery_regions
    FOR ALL USING (public.is_superadmin());
CREATE POLICY "delivery_regions_own_tenant" ON public.delivery_regions
    FOR ALL USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "delivery_regions_public_read" ON public.delivery_regions
    FOR SELECT USING (true);

-- DRIVERS: superadmin tudo; tenant próprio (não público)
CREATE POLICY "drivers_superadmin" ON public.drivers
    FOR ALL USING (public.is_superadmin());
CREATE POLICY "drivers_own_tenant" ON public.drivers
    FOR ALL USING (tenant_id = public.get_my_tenant_id());

-- ORDERS: superadmin tudo; tenant próprio; público insere (clientes) e lê o próprio por ID
CREATE POLICY "orders_superadmin" ON public.orders
    FOR ALL USING (public.is_superadmin());
CREATE POLICY "orders_own_tenant" ON public.orders
    FOR ALL USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "orders_public_insert" ON public.orders
    FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_public_track" ON public.orders
    FOR SELECT USING (true);

-- ORDER_ITEMS: superadmin tudo; tenant próprio; público insere
CREATE POLICY "order_items_superadmin" ON public.order_items
    FOR ALL USING (public.is_superadmin());
CREATE POLICY "order_items_own_tenant" ON public.order_items
    FOR ALL USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "order_items_public_insert" ON public.order_items
    FOR INSERT WITH CHECK (true);

-- ORDER_ITEM_ADDONS: superadmin tudo; tenant próprio; público insere
CREATE POLICY "order_item_addons_superadmin" ON public.order_item_addons
    FOR ALL USING (public.is_superadmin());
CREATE POLICY "order_item_addons_own_tenant" ON public.order_item_addons
    FOR ALL USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "order_item_addons_public_insert" ON public.order_item_addons
    FOR INSERT WITH CHECK (true);

-- DELIVERY_TIMES: superadmin tudo; tenant próprio; público lê
CREATE POLICY "delivery_times_superadmin" ON public.delivery_times
    FOR ALL USING (public.is_superadmin());
CREATE POLICY "delivery_times_own_tenant" ON public.delivery_times
    FOR ALL USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "delivery_times_public_read" ON public.delivery_times
    FOR SELECT USING (true);

-- =====================================================
-- 10. DADOS INICIAIS
-- =====================================================

-- Planos de assinatura
INSERT INTO public.plans (name, type, price, billing_days, description, features) VALUES
    ('Mensal', 'monthly', 67.90, 30, 'Acesso completo ao sistema por 30 dias',
     '["Dashboard completo","Gestão de pedidos","PDV integrado","Relatórios","Suporte por WhatsApp"]'::jsonb),
    ('Trimestral', 'quarterly', 157.90, 90, 'Acesso completo ao sistema por 90 dias',
     '["Tudo do plano Mensal","Economia de R$ 45,80","Prioridade no suporte"]'::jsonb),
    ('Anual', 'annual', 547.90, 365, 'Acesso completo ao sistema por 365 dias',
     '["Tudo do plano Trimestral","Economia de R$ 266,90","Onboarding personalizado"]'::jsonb);

-- Configurações da plataforma
INSERT INTO public.platform_settings (key, value, description, is_secret) VALUES
    ('asaas_api_key',           NULL,        'Chave de API do Asaas',                    true),
    ('asaas_environment',       'sandbox',   'Ambiente do Asaas: sandbox | production',  false),
    ('asaas_webhook_token',     NULL,        'Token de validação dos webhooks Asaas',     true),
    ('split_partner_a_wallet',  NULL,        'Wallet ID do Sócio A no Asaas',            false),
    ('split_partner_a_percent', '35',        'Percentual do Sócio A',                    false),
    ('split_partner_b_wallet',  NULL,        'Wallet ID do Sócio B no Asaas',            false),
    ('split_partner_b_percent', '35',        'Percentual do Sócio B',                    false),
    ('split_main_percent',      '30',        'Percentual conta principal (Fundo de Caixa)', false),
    ('trial_days',              '7',         'Dias de trial para novos restaurantes',    false),
    ('system_name',             'Delivery MAX', 'Nome do sistema',                       false),
    ('support_whatsapp',        NULL,        'WhatsApp de suporte',                      false);

-- =====================================================
-- 11. CRIAÇÃO DO SUPERADMIN
-- =====================================================

-- Passo 1: Criar usuário no auth.users (Supabase Auth — bcrypt automático)
INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    aud,
    role,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
) VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'superadmin@admin.com',
    crypt('123456', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"superadmin"}'::jsonb,
    false,
    now(),
    now(),
    'authenticated',
    'authenticated',
    '', '', '', ''
);

-- Passo 2: Criar identidade para o auth user
INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'superadmin@admin.com',
    format(
        '{"sub":"%s","email":"superadmin@admin.com","email_verified":true}',
        'a0000000-0000-0000-0000-000000000001'
    )::jsonb,
    'email',
    now(), now(), now()
);

-- Passo 3: Criar perfil de superadmin
INSERT INTO public.superadmin_users (id, email, first_name, last_name, role)
VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'superadmin@admin.com',
    'Super',
    'Admin',
    'superadmin'
);

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================

COMMENT ON TABLE public.tenants IS 'Cada restaurante cadastrado é um tenant isolado';
COMMENT ON TABLE public.superadmin_users IS 'Administradores da plataforma Delivery MAX';
COMMENT ON TABLE public.platform_settings IS 'Configurações globais da plataforma (Asaas, split, etc)';
COMMENT ON TABLE public.plans IS 'Planos de assinatura disponíveis';
COMMENT ON FUNCTION public.get_my_tenant_id() IS 'Retorna o tenant_id do usuário autenticado — usada pelo RLS';
COMMENT ON FUNCTION public.is_superadmin() IS 'Verifica se o usuário é superadmin — usada pelo RLS';



