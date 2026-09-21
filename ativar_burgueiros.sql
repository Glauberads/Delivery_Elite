-- Ativar Burgueiros na Brasa no Plano Anual
DO $$ 
DECLARE
  v_plan_id UUID;
  v_tenant_id UUID;
BEGIN
  -- 1. Pegar o ID do Plano Anual (procura por planos que contenham 'anual' no nome)
  SELECT id INTO v_plan_id FROM plans WHERE name ILIKE '%anual%' LIMIT 1;
  
  -- Se não achar plano anual, pega qualquer plano pago (só pra garantir que funciona)
  IF v_plan_id IS NULL THEN
      SELECT id INTO v_plan_id FROM plans WHERE price > 0 LIMIT 1;
  END IF;
  
  -- 2. Pegar o ID do restaurante (pelo nome em vez de slug, para evitar erro de hífens)
  SELECT id INTO v_tenant_id FROM tenants WHERE name ILIKE '%burgueiro%' LIMIT 1;

  IF v_tenant_id IS NOT NULL AND v_plan_id IS NOT NULL THEN
    -- Atualizar o cadastro principal do restaurante
    UPDATE tenants 
    SET status = 'active',
        plan_id = v_plan_id,
        trial_ends_at = CURRENT_DATE + INTERVAL '1 year'
    WHERE id = v_tenant_id;
    
    -- Atualizar ou inserir a assinatura sem causar erro de Constraint
    IF EXISTS (SELECT 1 FROM tenant_subscriptions WHERE tenant_id = v_tenant_id) THEN
        UPDATE tenant_subscriptions 
        SET plan_id = v_plan_id, 
            status = 'active', 
            current_period_end = CURRENT_DATE + INTERVAL '1 year'
        WHERE tenant_id = v_tenant_id;
    ELSE
        INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, current_period_end)
        VALUES (v_tenant_id, v_plan_id, 'active', CURRENT_DATE + INTERVAL '1 year');
    END IF;
    
  END IF;
END $$;
