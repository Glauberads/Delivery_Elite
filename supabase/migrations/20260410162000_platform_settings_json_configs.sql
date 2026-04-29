INSERT INTO public.platform_settings (key, value, description, is_secret)
VALUES
    ('asaas_config', NULL, 'Configuração JSON consolidada do Asaas e split', true),
    ('smtp_config', NULL, 'Configuração JSON consolidada do SMTP transacional', true)
ON CONFLICT (key) DO UPDATE
SET
    description = EXCLUDED.description,
    is_secret = EXCLUDED.is_secret;

UPDATE public.platform_settings
SET value = jsonb_build_object(
    'environment', COALESCE((SELECT value FROM public.platform_settings WHERE key = 'asaas_environment'), 'sandbox'),
    'apiKey', COALESCE((SELECT value FROM public.platform_settings WHERE key = 'asaas_api_key'), ''),
    'webhookToken', COALESCE((SELECT value FROM public.platform_settings WHERE key = 'asaas_webhook_token'), ''),
    'split', jsonb_build_object(
        'partnerAWallet', COALESCE((SELECT value FROM public.platform_settings WHERE key = 'split_partner_a_wallet'), ''),
        'partnerAPercent', COALESCE((SELECT value FROM public.platform_settings WHERE key = 'split_partner_a_percent'), ''),
        'partnerBWallet', COALESCE((SELECT value FROM public.platform_settings WHERE key = 'split_partner_b_wallet'), ''),
        'partnerBPercent', COALESCE((SELECT value FROM public.platform_settings WHERE key = 'split_partner_b_percent'), '')
    )
)::text
WHERE key = 'asaas_config'
  AND (value IS NULL OR value = '');

UPDATE public.platform_settings
SET value = jsonb_build_object(
    'host', COALESCE((SELECT value FROM public.platform_settings WHERE key = 'smtp_host'), ''),
    'port', COALESCE((SELECT value FROM public.platform_settings WHERE key = 'smtp_port'), '587'),
    'secure', COALESCE((SELECT value FROM public.platform_settings WHERE key = 'smtp_secure'), 'false'),
    'username', COALESCE((SELECT value FROM public.platform_settings WHERE key = 'smtp_username'), ''),
    'password', COALESCE((SELECT value FROM public.platform_settings WHERE key = 'smtp_password'), ''),
    'fromName', COALESCE((SELECT value FROM public.platform_settings WHERE key = 'smtp_from_name'), 'Delivery MAX')
)::text
WHERE key = 'smtp_config'
  AND (value IS NULL OR value = '');



