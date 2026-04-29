-- =====================================================
-- Delivery Max - CONSOLIDATED MIGRATION
-- =====================================================
-- This file consolidates all migrations into a single file
-- Compatible with Supabase client and types
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. ENUMS AND TYPES
-- =====================================================

-- Create user role enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff', 'driver');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create permission enum
CREATE TYPE permission AS ENUM (
  'dashboard',
  'agenda',
  'services',
  'professionals',
  'clients',
  'loyalty',
  'reports',
  'settings',
  'evolution_api',
  'ai'
);

-- =====================================================
-- 2. CORE TABLES
-- =====================================================

-- Users table
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role user_role DEFAULT 'staff',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- System settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allow_registration BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User permissions table
CREATE TABLE public.user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    permission TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY,
    avatar_url TEXT,
    first_name TEXT,
    last_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- 3. RESTAURANT AND BUSINESS TABLES
-- =====================================================

-- Restaurant information table
CREATE TABLE public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    phone TEXT,
    logo_url TEXT,
    banner_url TEXT,
    open_time TIME,
    close_time TIME,
    delivery_fee DECIMAL(10, 2) DEFAULT 0,
    min_order_value DECIMAL(10, 2) DEFAULT 0,
    theme_settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Business hours table
CREATE TABLE IF NOT EXISTS public.business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week TEXT NOT NULL,
    open_time TEXT,
    close_time TEXT,
    is_closed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Delivery times table
CREATE TABLE public.delivery_times (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID REFERENCES public.restaurants(id) NOT NULL,
    min_time INTEGER NOT NULL,
    max_time INTEGER NOT NULL,
    day_of_week VARCHAR(20) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Delivery regions table
CREATE TABLE public.delivery_regions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    fee NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Drivers table
CREATE TABLE public.drivers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    vehicle TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- 4. PRODUCT CATALOG TABLES
-- =====================================================

-- Product categories table
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Products table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    category_id UUID REFERENCES public.categories(id),
    available BOOLEAN DEFAULT true,
    featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Product addons table
CREATE TABLE public.product_addons (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL,
    available BOOLEAN NOT NULL DEFAULT true,
    is_global BOOLEAN NOT NULL DEFAULT false,
    max_options INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Product addon relations table
CREATE TABLE public.product_addon_relations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    addon_id UUID NOT NULL REFERENCES public.product_addons(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- 5. ORDER MANAGEMENT TABLES
-- =====================================================

-- Payment methods table
CREATE TABLE public.payment_methods (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    restaurant_id UUID REFERENCES public.restaurants(id),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Orders table
CREATE TABLE public.orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    number TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'canceled')),
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    subtotal DECIMAL NOT NULL,
    delivery_fee DECIMAL NOT NULL DEFAULT 0,
    discount DECIMAL NOT NULL DEFAULT 0,
    total DECIMAL NOT NULL,
    notes TEXT,
    order_type TEXT CHECK (order_type IN ('delivery', 'takeaway', 'instore')) DEFAULT 'delivery' NOT NULL,
    table_number TEXT DEFAULT NULL,
    delivery_driver_id UUID REFERENCES public.drivers(id),
    delivery_status TEXT,
    delivery_address TEXT,
    delivery_region_id UUID REFERENCES public.delivery_regions(id),
    delivery_started_at TIMESTAMP WITH TIME ZONE,
    delivery_completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Order items table
CREATE TABLE public.order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL NOT NULL,
    total_price DECIMAL NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Order item addons table
CREATE TABLE public.order_item_addons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    addon_id UUID NOT NULL REFERENCES public.product_addons(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL NOT NULL,
    total_price DECIMAL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- =====================================================
-- 6. UTILITY FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate sequential order numbers
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    sequence_number INT;
BEGIN
    -- Get current year as prefix (e.g., '2024')
    year_prefix := to_char(now(), 'YYYY');
    
    -- Get the next sequence number for this year
    WITH sequence AS (
        SELECT COALESCE(
            MAX(NULLIF(regexp_replace(number, '^[0-9]{4}', ''), ''))::integer,
            0
        ) + 1 as next_number
        FROM orders
        WHERE number LIKE year_prefix || '%'
    )
    SELECT next_number INTO sequence_number FROM sequence;
    
    -- Format the new order number (e.g., '20240001')
    NEW.number := year_prefix || LPAD(sequence_number::text, 4, '0');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Authentication function
CREATE OR REPLACE FUNCTION authenticate_user(p_email TEXT, p_password TEXT)
RETURNS TABLE (
    id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    role user_role
) SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT users.id, users.email, users.first_name, users.last_name, users.role
    FROM users
    WHERE users.email = p_email
    AND users.password = p_password;
END;
$$ LANGUAGE plpgsql;

-- Create user function
CREATE OR REPLACE FUNCTION create_user(
    p_email TEXT,
    p_password TEXT,
    p_first_name TEXT,
    p_last_name TEXT
)
RETURNS UUID SECURITY DEFINER AS $$
DECLARE
    new_user_id UUID;
BEGIN
    INSERT INTO users (email, password, first_name, last_name)
    VALUES (p_email, p_password, p_first_name, p_last_name)
    RETURNING id INTO new_user_id;
    
    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql;

-- Product addons functions
CREATE OR REPLACE FUNCTION public.get_product_addons()
RETURNS TABLE (
    id uuid,
    name text,
    description text,
    price numeric,
    available boolean,
    is_global boolean,
    max_options integer
) 
LANGUAGE sql
AS $$
    SELECT 
        id, 
        name, 
        description, 
        price, 
        available, 
        is_global, 
        max_options
    FROM 
        public.product_addons
    ORDER BY 
        name;
$$;

CREATE OR REPLACE FUNCTION public.get_product_addon_relations()
RETURNS TABLE (
    id uuid,
    product_id uuid,
    addon_id uuid
) 
LANGUAGE sql
AS $$
    SELECT 
        id, 
        product_id, 
        addon_id
    FROM 
        public.product_addon_relations;
$$;

CREATE OR REPLACE FUNCTION public.get_product_addons_by_product(product_id_param uuid)
RETURNS TABLE (
    id uuid,
    name text,
    description text,
    price numeric,
    available boolean,
    is_global boolean,
    max_options integer
) 
LANGUAGE sql
AS $$
    SELECT 
        pa.id, 
        pa.name, 
        pa.description, 
        pa.price, 
        pa.available, 
        pa.is_global, 
        pa.max_options
    FROM 
        public.product_addons pa
    WHERE 
        pa.is_global = true
        OR pa.id IN (
            SELECT par.addon_id 
            FROM public.product_addon_relations par 
            WHERE par.product_id = product_id_param
        )
    ORDER BY 
        pa.name;
$$;

-- =====================================================
-- 7. TRIGGERS
-- =====================================================

-- Updated at triggers
CREATE TRIGGER set_restaurants_updated_at
    BEFORE UPDATE ON public.restaurants
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_payment_methods_updated_at
    BEFORE UPDATE ON public.payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Order number generation trigger
CREATE TRIGGER generate_order_number_trigger
    BEFORE INSERT ON public.orders
    FOR EACH ROW
    WHEN (NEW.number IS NULL)
    EXECUTE FUNCTION public.generate_order_number();

-- =====================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_addon_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_addons ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 9. RLS POLICIES
-- =====================================================

-- Users policies
CREATE POLICY "Users can view own user" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Anyone can register" ON public.users
    FOR INSERT WITH CHECK (true);

-- Allow all operations for public tables (can be refined later)
CREATE POLICY "Allow all operations on restaurants" ON public.restaurants FOR ALL USING (true);
CREATE POLICY "Allow all operations on categories" ON public.categories FOR ALL USING (true);
CREATE POLICY "Allow all operations on products" ON public.products FOR ALL USING (true);
CREATE POLICY "Allow all operations on product_addons" ON public.product_addons FOR ALL USING (true);
CREATE POLICY "Allow all operations on product_addon_relations" ON public.product_addon_relations FOR ALL USING (true);
CREATE POLICY "Allow all operations on payment_methods" ON public.payment_methods FOR ALL USING (true);
CREATE POLICY "Allow all operations on orders" ON public.orders FOR ALL USING (true);
CREATE POLICY "Allow all operations on order_items" ON public.order_items FOR ALL USING (true);
CREATE POLICY "Allow all operations on order_item_addons" ON public.order_item_addons FOR ALL USING (true);
CREATE POLICY "Allow all operations on delivery_regions" ON public.delivery_regions FOR ALL USING (true);
CREATE POLICY "Allow all operations on drivers" ON public.drivers FOR ALL USING (true);
CREATE POLICY "Allow all operations on business_hours" ON public.business_hours FOR ALL USING (true);
CREATE POLICY "Allow all operations on delivery_times" ON public.delivery_times FOR ALL USING (true);

-- =====================================================
-- 10. INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_available ON public.products(available);
CREATE INDEX idx_products_featured ON public.products(featured);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at);
CREATE INDEX idx_orders_customer_phone ON public.orders(customer_phone);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX idx_delivery_times_restaurant ON public.delivery_times(restaurant_id);
CREATE INDEX idx_delivery_times_day ON public.delivery_times(day_of_week);

-- =====================================================
-- 11. SAMPLE DATA
-- =====================================================

-- Insert default payment methods
INSERT INTO public.payment_methods (name, description, icon, enabled)
VALUES 
    ('Dinheiro', 'Pagamento em espécie', 'banknote', true),
    ('Cartão de Crédito', 'Visa, Mastercard, etc', 'credit-card', true),
    ('Cartão de Débito', 'Visa, Mastercard, etc', 'credit-card', true),
    ('PIX', 'Transferência instantânea', 'qr-code', true),
    ('Vale Refeição', 'Alelo, Sodexo, VR, etc', 'credit-card', true);

-- Insert sample delivery regions
INSERT INTO public.delivery_regions (name, fee) VALUES
    ('Centro', 5.00),
    ('Norte', 8.00),
    ('Sul', 10.00),
    ('Leste', 12.00),
    ('Oeste', 15.00);

-- Insert sample business hours
INSERT INTO public.business_hours (day_of_week, open_time, close_time, is_closed) VALUES
    ('Segunda-feira', '11:00:00', '23:00:00', false),
    ('Terça-feira', '11:00:00', '23:00:00', false),
    ('Quarta-feira', '11:00:00', '23:00:00', false),
    ('Quinta-feira', '11:00:00', '23:00:00', false),
    ('Sexta-feira', '11:00:00', '23:00:00', false),
    ('Sábado', '11:00:00', '23:00:00', false),
    ('Domingo', '11:00:00', '23:00:00', false);

-- Insert sample product addons
INSERT INTO public.product_addons (name, description, price, available, is_global, max_options)
VALUES 
    ('Bacon', 'Adicional de bacon', 3.00, true, true, 2),
    ('Cheddar', 'Extra de cheddar', 2.50, true, true, 2),
    ('Ovo', 'Ovo frito', 2.00, true, true, 1),
    ('Queijo Extra', 'Fatia adicional de queijo', 2.50, true, true, 2),
    ('Molho da Casa', 'Molho especial da casa', 1.50, true, true, 1),
    ('Molho BBQ', 'Molho barbecue', 1.50, true, true, 1),
    ('Molho Picante', 'Molho com pimenta', 1.50, true, true, 1),
    ('Guacamole', 'Pasta de abacate', 4.00, true, false, 1);

-- =====================================================
-- END OF CONSOLIDATED MIGRATION
-- =====================================================

-- Comments for documentation
COMMENT ON TABLE public.users IS 'Sistema de usuários com autenticação';
COMMENT ON TABLE public.restaurants IS 'Informações dos restaurantes';
COMMENT ON TABLE public.categories IS 'Categorias de produtos';
COMMENT ON TABLE public.products IS 'Catálogo de produtos';
COMMENT ON TABLE public.orders IS 'Pedidos do sistema';
COMMENT ON TABLE public.order_items IS 'Itens dos pedidos';
COMMENT ON TABLE public.product_addons IS 'Adicionais para produtos';
COMMENT ON TABLE public.delivery_times IS 'Tempos médios de entrega dos restaurantes';
COMMENT ON COLUMN public.delivery_times.min_time IS 'Tempo mínimo de entrega em minutos';
COMMENT ON COLUMN public.delivery_times.max_time IS 'Tempo máximo de entrega em minutos';
COMMENT ON COLUMN public.delivery_times.day_of_week IS 'Dia da semana (opcional)';


