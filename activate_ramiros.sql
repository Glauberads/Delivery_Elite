-- Script para ativar a loja Ramiros Lanchonete e Açaí por 30 dias
UPDATE tenants 
SET status = 'active',
    trial_ends_at = CURRENT_DATE + INTERVAL '30 days'
WHERE slug = 'ramiros-lanchonete-e-acai';
