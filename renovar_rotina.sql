-- Renovar cliente Rotina Lanches por mais 30 dias
DO $$ 
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Pegar o ID do restaurante (pelo nome)
  SELECT id INTO v_tenant_id FROM tenants WHERE name ILIKE '%rotina lanches%' LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    -- Atualizar o cadastro principal do restaurante
    UPDATE tenants 
    SET status = 'active',
        trial_ends_at = CURRENT_DATE + INTERVAL '30 days'
    WHERE id = v_tenant_id;
    
    -- Atualizar a assinatura, se existir
    IF EXISTS (SELECT 1 FROM tenant_subscriptions WHERE tenant_id = v_tenant_id) THEN
        UPDATE tenant_subscriptions 
        SET status = 'active', 
            current_period_end = CURRENT_DATE + INTERVAL '30 days'
        WHERE tenant_id = v_tenant_id;
    END IF;
    
  END IF;
END $$;
