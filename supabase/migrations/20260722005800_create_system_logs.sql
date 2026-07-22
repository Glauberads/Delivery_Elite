-- Tabela para armazenar logs gerais do sistema
CREATE TABLE public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Criando índices para facilitar a busca e filtro no painel Superadmin
CREATE INDEX idx_system_logs_action ON public.system_logs(action);
CREATE INDEX idx_system_logs_tenant_id ON public.system_logs(tenant_id);
CREATE INDEX idx_system_logs_created_at ON public.system_logs(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- Apenas Superadmins podem ler os logs
CREATE POLICY "Superadmins can view all system logs"
    ON public.system_logs
    FOR SELECT
    USING (public.is_superadmin());

-- Qualquer um logado (ou sistema) pode inserir logs, para podermos auditar o que os usuários fazem
CREATE POLICY "Anyone can insert system logs"
    ON public.system_logs
    FOR INSERT
    WITH CHECK (true);
