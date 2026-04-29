-- 1. Criar a nova tabela de Grupos de Adicionais (Modifier Groups)
CREATE TABLE public.product_modifier_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    min_options INTEGER DEFAULT 0 NOT NULL,
    max_options INTEGER NULL, -- NULL significa infinito
    pricing_rule VARCHAR(50) DEFAULT 'sum' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT check_min_options CHECK (min_options >= 0),
    CONSTRAINT check_max_options CHECK (max_options IS NULL OR max_options >= min_options),
    CONSTRAINT check_pricing_rule CHECK (pricing_rule IN ('sum', 'highest'))
);

-- 2. Habilitar RLS (Row Level Security) básica no padrão SaaS Single/Multi-Tenant
ALTER TABLE public.product_modifier_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojista visualiza e edita os próprios grupos de adicionais" 
    ON public.product_modifier_groups 
    FOR ALL 
    USING (auth.uid() = tenant_id);

-- 3. Alterar a tabela atual de adicionais (product_addons) para se vincular aos grupos
-- Assume que product_addons existe
ALTER TABLE public.product_addons
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.product_modifier_groups(id) ON DELETE CASCADE;

-- Criar índices de performance
CREATE INDEX idx_modifier_groups_product_id ON public.product_modifier_groups(product_id);
CREATE INDEX idx_product_addons_group_id ON public.product_addons(group_id);



