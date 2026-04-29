DELETE FROM public.platform_settings
WHERE key IN (
    'system_name',
    'support_whatsapp',
    'split_main_percent'
);



