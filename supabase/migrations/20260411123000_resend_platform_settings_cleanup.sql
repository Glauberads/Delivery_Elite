INSERT INTO public.platform_settings (key, value, description, is_secret)
VALUES
    ('resend_from_email', NULL, 'E-mail remetente usado nos envios via Resend', false),
    ('resend_api_key', NULL, 'Chave da API do Resend usada nos envios transacionais', true)
ON CONFLICT (key) DO UPDATE
SET
    description = EXCLUDED.description,
    is_secret = EXCLUDED.is_secret;

DELETE FROM public.platform_settings
WHERE key IN (
    'smtp_host',
    'smtp_port',
    'smtp_secure',
    'smtp_username',
    'smtp_password',
    'smtp_from_name',
    'smtp_from_email',
    'smtp_driver',
    'smtp_config'
);



