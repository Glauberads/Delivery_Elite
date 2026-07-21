-- Migration para criar a estrutura de domínios personalizados (Custom Domains)
-- Tabela idempotente: verifica a existência antes de criar objetos

-- 1. Criar a tabela tenant_domains
CREATE TABLE IF NOT EXISTS public.tenant_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_dns' CHECK (status IN ('pending_dns', 'active', 'error', 'pending_verification')),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    vercel_domain_id TEXT, -- ID retornado pela API da Vercel
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uk_tenant_domain UNIQUE (domain)
);

-- 2. Índice para acelerar a busca pelo domínio no roteamento (que será altíssima)
CREATE INDEX IF NOT EXISTS idx_tenant_domains_domain ON public.tenant_domains(domain);
CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant_id ON public.tenant_domains(tenant_id);

-- 3. Habilitar RLS
ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas RLS (Idempotentes usando bloco DO)
DO $$ 
BEGIN
    -- Política de Leitura Pública: O domínio é usado antes do usuário logar, 
    -- então a resolução (SELECT) deve ser pública, mas limitamos o que pode ser visto.
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tenant_domains' 
        AND policyname = 'Public read access for domain resolution'
    ) THEN
        CREATE POLICY "Public read access for domain resolution" 
            ON public.tenant_domains 
            FOR SELECT 
            USING (true);
    END IF;

    -- Política de Inserção: Lojista pode inserir para seu próprio tenant
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tenant_domains' 
        AND policyname = 'Users can insert domains for their tenants'
    ) THEN
        CREATE POLICY "Users can insert domains for their tenants" 
            ON public.tenant_domains 
            FOR INSERT 
            WITH CHECK (
                tenant_id IN (
                    SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()
                )
            );
    END IF;

    -- Política de Atualização: Lojista pode atualizar (ex: setar primário)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tenant_domains' 
        AND policyname = 'Users can update domains for their tenants'
    ) THEN
        CREATE POLICY "Users can update domains for their tenants" 
            ON public.tenant_domains 
            FOR UPDATE 
            USING (
                tenant_id IN (
                    SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()
                )
            );
    END IF;

    -- Política de Deleção: Lojista pode excluir seus domínios
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tenant_domains' 
        AND policyname = 'Users can delete domains for their tenants'
    ) THEN
        CREATE POLICY "Users can delete domains for their tenants" 
            ON public.tenant_domains 
            FOR DELETE 
            USING (
                tenant_id IN (
                    SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid()
                )
            );
    END IF;
END $$;

-- 5. Trigger de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at_tenant_domains()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'set_updated_at_tenant_domains'
    ) THEN
        CREATE TRIGGER set_updated_at_tenant_domains
            BEFORE UPDATE ON public.tenant_domains
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_updated_at_tenant_domains();
    END IF;
END $$;

-- 6. RPC para a Edge Function poder resolver o tenant_id de forma otimizada
-- e retornar a slug que o frontend precisa
CREATE OR REPLACE FUNCTION public.resolve_tenant_domain(p_domain TEXT)
RETURNS TABLE (
    tenant_id UUID,
    tenant_slug TEXT,
    domain_status TEXT
) 
SECURITY DEFINER -- Roda com privilégios de owner
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        td.tenant_id,
        t.slug AS tenant_slug,
        td.status AS domain_status
    FROM public.tenant_domains td
    JOIN public.tenants t ON t.id = td.tenant_id
    WHERE td.domain = p_domain;
END;
$$ LANGUAGE plpgsql;
