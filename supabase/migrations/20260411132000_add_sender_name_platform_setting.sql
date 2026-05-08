INSERT INTO public.platform_settings (key, value, description, is_secret)
VALUES
    ('smtp_sender_name', 'VIP Delivery', 'Nome exibido como remetente nos envios transacionais', false)
ON CONFLICT (key) DO UPDATE
SET
    value = COALESCE(public.platform_settings.value, EXCLUDED.value),
    description = EXCLUDED.description,
    is_secret = EXCLUDED.is_secret;



