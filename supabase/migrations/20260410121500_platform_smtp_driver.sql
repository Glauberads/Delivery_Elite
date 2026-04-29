INSERT INTO public.platform_settings (key, value, description, is_secret)
VALUES
    ('smtp_driver', NULL, 'Driver ou provedor de e-mail usado pelo SMTP configurado', false)
ON CONFLICT (key) DO UPDATE
SET
    description = EXCLUDED.description,
    is_secret = EXCLUDED.is_secret,
    updated_at = now();



