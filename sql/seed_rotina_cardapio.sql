-- Script para cadastrar o cardápio da "Rotina Açais e Lanches Artesanais"

DO $$
DECLARE
    v_tenant_id uuid;
    v_cat_lanches uuid;
    v_cat_especiais uuid;
    v_cat_batatas uuid;
    v_cat_combos uuid;
    v_cat_salgados uuid;
    v_cat_acai_cupuacu uuid;
    v_cat_cupuacu uuid;
    v_cat_bebidas uuid;
BEGIN
    -- 1. Verificar se o tenant 'rotina' já existe, caso contrário, cria
    SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'rotina' LIMIT 1;
    
    IF v_tenant_id IS NULL THEN
        INSERT INTO public.tenants (name, slug, email, phone, status) 
        VALUES ('Rotina Açais e Lanches Artesanais', 'rotina', 'contato@rotinalanches.com.br', '(22) 98141-3656', 'active')
        RETURNING id INTO v_tenant_id;
        
        INSERT INTO public.restaurants (tenant_id, description)
        VALUES (v_tenant_id, 'Açais e Lanches Artesanais');
    END IF;

    -- 2. Limpar categorias existentes para este tenant para evitar duplicidade em rodadas repetidas
    DELETE FROM public.categories WHERE tenant_id = v_tenant_id;
    
    -- 3. Criar Categorias
    INSERT INTO public.categories (tenant_id, name, display_order) VALUES (v_tenant_id, 'Lanches', 1) RETURNING id INTO v_cat_lanches;
    INSERT INTO public.categories (tenant_id, name, display_order) VALUES (v_tenant_id, 'Especiais', 2) RETURNING id INTO v_cat_especiais;
    INSERT INTO public.categories (tenant_id, name, display_order) VALUES (v_tenant_id, 'Batatas', 3) RETURNING id INTO v_cat_batatas;
    INSERT INTO public.categories (tenant_id, name, display_order) VALUES (v_tenant_id, 'Combos', 4) RETURNING id INTO v_cat_combos;
    INSERT INTO public.categories (tenant_id, name, display_order) VALUES (v_tenant_id, 'Salgados', 5) RETURNING id INTO v_cat_salgados;
    INSERT INTO public.categories (tenant_id, name, display_order) VALUES (v_tenant_id, 'Açaí / Cupuaçu', 6) RETURNING id INTO v_cat_acai_cupuacu;
    INSERT INTO public.categories (tenant_id, name, display_order) VALUES (v_tenant_id, 'Cupuaçu', 7) RETURNING id INTO v_cat_cupuacu;
    INSERT INTO public.categories (tenant_id, name, display_order) VALUES (v_tenant_id, 'Bebidas', 8) RETURNING id INTO v_cat_bebidas;

    -- 4. Inserir Produtos
    
    -- LANCHES
    INSERT INTO public.products (tenant_id, category_id, name, description, price, available) VALUES
    (v_tenant_id, v_cat_lanches, 'Hambúrguer', 'Pão, carne, salada, batata palha, milho verde e ervilha.', 10.00, true),
    (v_tenant_id, v_cat_lanches, 'X-Burguer', 'Pão, carne, queijo, salada, batata palha.', 11.00, true),
    (v_tenant_id, v_cat_lanches, 'X - Egg', 'Pão, carne, queijo, presunto, ovo, salada e batata palha, milho verde e ervilha.', 14.00, true),
    (v_tenant_id, v_cat_lanches, 'X - Calabresa', 'Pão, carne, queijo, presunto, calabresa salada e batata palha, milho verde e ervilha.', 15.00, true),
    (v_tenant_id, v_cat_lanches, 'X - Bacon', 'Pão, carne, queijo, presunto, bacon, salada e batata palha.', 15.00, true),
    (v_tenant_id, v_cat_lanches, 'X - egg Frango', 'Pão, carne, ovo, queijo, frango desfiado, salada, batata palha, milho verde e ervilha.', 15.00, true),
    (v_tenant_id, v_cat_lanches, 'X - Tudo', 'Pão, carne, ovo, queijo, presunto, ovo, bacon, calabresa, frango desfiado, salada e batata palha, milho verde e ervilha.', 16.00, true),
    (v_tenant_id, v_cat_lanches, 'X - Dobra', 'Pão, duas carnes, dois ovos, bacon, presunto, queijo, salada e batata palha, milho verde e ervilha.', 22.00, true),
    (v_tenant_id, v_cat_lanches, 'Rotina Pesada', 'Pão, três carnes, três ovos, queijo, presunto, calabresa, bacon, salada e batata palha, milho verde e ervilha.', 26.00, true);

    -- ESPECIAIS
    INSERT INTO public.products (tenant_id, category_id, name, description, price, available) VALUES
    (v_tenant_id, v_cat_especiais, 'Big Cheddar', 'Duas carnes, cheddar, salada e batata palha.', 17.00, true),
    (v_tenant_id, v_cat_especiais, 'Big Cheddar Bacon', 'Duas carnes, bacon, cheddar, salada e batata palha.', 22.00, true),
    (v_tenant_id, v_cat_especiais, 'Artesanal Meat', 'Carne 140g, cheddar, salada, maionese artesanal.', 27.00, true),
    (v_tenant_id, v_cat_especiais, 'Artesanal Chicken', 'Frango 140g, cheddar, salada, maionese artesanal.', 27.00, true);

    -- BATATAS
    INSERT INTO public.products (tenant_id, category_id, name, description, price, available) VALUES
    (v_tenant_id, v_cat_batatas, 'Batata no balde M', 'Batata frita com frango desfiado, bacon, cheddar requeijão, calabresa, 4 queijos, e alho frito.', 35.00, true),
    (v_tenant_id, v_cat_batatas, 'Batata Turbo G', 'Batata frita com frango desfiado, bacon, calabresa, cheddar, requeijão, quatro queijos e alho frito.', 38.00, true),
    (v_tenant_id, v_cat_batatas, 'Batata Kids', '', 8.00, true),
    (v_tenant_id, v_cat_batatas, 'Batata Simples M', '', 16.00, true),
    (v_tenant_id, v_cat_batatas, 'Batata Simples G', '', 21.00, true);

    -- COMBOS
    INSERT INTO public.products (tenant_id, category_id, name, description, price, available) VALUES
    (v_tenant_id, v_cat_combos, 'Rotina 1', '2 X-Tudo + 2 Petiscos + Refri 2L.', 57.00, true),
    (v_tenant_id, v_cat_combos, 'Rotina 2', '2 X-Egg + 2 Petiscos + Refri 2L.', 51.00, true),
    (v_tenant_id, v_cat_combos, 'Rotina 3', '1 Meat + 1 Chicken + 2 Petiscos + Refri 2L.', 72.00, true),
    (v_tenant_id, v_cat_combos, 'Rotina 4', '1 Petisco + X-Tudo + Suco.', 31.00, true),
    (v_tenant_id, v_cat_combos, 'Rotina 5', 'X-Egg Bacon + 3 Petiscos + Refri 2L.', 86.00, true);

    -- SALGADOS
    INSERT INTO public.products (tenant_id, category_id, name, description, price, available) VALUES
    (v_tenant_id, v_cat_salgados, 'Pastel de Frango', '', 12.00, true),
    (v_tenant_id, v_cat_salgados, 'Pastel de Frango com bacon', '', 12.00, true),
    (v_tenant_id, v_cat_salgados, 'Pastel de Frango com queijo', '', 12.00, true),
    (v_tenant_id, v_cat_salgados, 'Pastel de Frango com requeijão', '', 12.00, true),
    (v_tenant_id, v_cat_salgados, 'Pastel de Frango com cheddar', '', 12.00, true),
    (v_tenant_id, v_cat_salgados, 'Pastel de Queijo e presunto (opcional orégano)', '', 12.00, true),
    (v_tenant_id, v_cat_salgados, 'Pastel de Queijo Mussarela (opcional orégano)', '', 12.00, true),
    (v_tenant_id, v_cat_salgados, 'Pastel de Três porquinhos (queijo, presunto, bacon)', '', 12.00, true),
    (v_tenant_id, v_cat_salgados, 'Pastel de Nutella com morango', '', 15.00, true),
    (v_tenant_id, v_cat_salgados, 'Pastel de Nutella com banana', '', 15.00, true),
    (v_tenant_id, v_cat_salgados, 'Coxinha com um copo de Ativ plus', '', 10.00, true),
    (v_tenant_id, v_cat_salgados, 'Kibe com um copo de Ativ plus', '', 10.00, true),
    (v_tenant_id, v_cat_salgados, 'Coxinha turbinada com queijo gratinado', '', 12.00, true);

    -- AÇAÍ / CUPUAÇU
    INSERT INTO public.products (tenant_id, category_id, name, description, price, available) VALUES
    (v_tenant_id, v_cat_acai_cupuacu, '200 ml', '', 9.00, true),
    (v_tenant_id, v_cat_acai_cupuacu, '300 ml', '', 10.00, true),
    (v_tenant_id, v_cat_acai_cupuacu, '400 ml', '', 12.00, true),
    (v_tenant_id, v_cat_acai_cupuacu, '500 ml', '', 15.00, true),
    (v_tenant_id, v_cat_acai_cupuacu, '700 ml', '', 18.00, true),
    (v_tenant_id, v_cat_acai_cupuacu, 'Tigela', '', 18.00, true);

    -- CUPUAÇU
    INSERT INTO public.products (tenant_id, category_id, name, description, price, available) VALUES
    (v_tenant_id, v_cat_cupuacu, '500 ml', '', 16.00, true),
    (v_tenant_id, v_cat_cupuacu, '700 ml', '', 19.00, true);

    -- BEBIDAS
    INSERT INTO public.products (tenant_id, category_id, name, description, price, available) VALUES
    (v_tenant_id, v_cat_bebidas, 'Sukita 2L', '', 12.00, true),
    (v_tenant_id, v_cat_bebidas, 'Kuat 2L', '', 12.00, true),
    (v_tenant_id, v_cat_bebidas, 'Guaraná Antartica 1L', '', 10.00, true),
    (v_tenant_id, v_cat_bebidas, 'Coca 1,5L', '', 12.00, true),
    (v_tenant_id, v_cat_bebidas, 'Guaraná Antartica Lata', '', 8.00, true),
    (v_tenant_id, v_cat_bebidas, 'Coca Lata', '', 8.00, true),
    (v_tenant_id, v_cat_bebidas, 'Sukita Lata', '', 8.00, true),
    (v_tenant_id, v_cat_bebidas, 'Kuat Lata', '', 8.00, true),
    (v_tenant_id, v_cat_bebidas, 'Coca 600', '', 10.00, true),
    (v_tenant_id, v_cat_bebidas, 'Sukita 600', '', 10.00, true),
    (v_tenant_id, v_cat_bebidas, 'Kuat 600', '', 10.00, true);

END $$;
