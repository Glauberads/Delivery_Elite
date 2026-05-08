INSERT INTO public.platform_settings (key, value, description, is_secret)
VALUES
    ('smtp_host', NULL, 'Servidor SMTP usado para envios transacionais da plataforma', false),
    ('smtp_port', '587', 'Porta do servidor SMTP', false),
    ('smtp_secure', 'false', 'Define se a conexão SMTP usa SSL/TLS direto (true) ou STARTTLS/automático (false)', false),
    ('smtp_username', NULL, 'Usuário de autenticação SMTP', false),
    ('smtp_password', NULL, 'Senha de autenticação SMTP', true),
    ('smtp_from_email', NULL, 'E-mail remetente padrão usado nos envios SMTP', false),
    ('smtp_from_name', 'VIP Delivery', 'Nome exibido como remetente dos e-mails SMTP', false)
ON CONFLICT (key) DO UPDATE
SET
    description = EXCLUDED.description,
    is_secret = EXCLUDED.is_secret,
    updated_at = now();



