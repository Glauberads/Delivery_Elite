DELETE FROM public.platform_settings
WHERE key IN (
    'smtp_from_email',
    'smtp_driver'
);



