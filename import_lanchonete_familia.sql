-- SQL Script para inserir Categorias, Produtos e Adicionais para Lanchonete da Família
-- TENANT ID: b8b7c9a0-173f-4e64-b35d-73a04b8bfb8c

DO $$
DECLARE
    v_tenant_id UUID := 'b8b7c9a0-173f-4e64-b35d-73a04b8bfb8c';
    v_cat_lanches_id UUID := gen_random_uuid();
    v_cat_hotdog_id UUID := gen_random_uuid();
    v_cat_batata_id UUID := gen_random_uuid();
    v_cat_acai_id UUID := gen_random_uuid();
    v_cat_pasteis_id UUID := gen_random_uuid();
    v_cat_bebidas_id UUID := gen_random_uuid();

    -- Addons
    v_addon_leite_cond_id UUID := gen_random_uuid();
    v_addon_chocolate_id UUID := gen_random_uuid();
    v_addon_morango_id UUID := gen_random_uuid();
    v_addon_menta_id UUID := gen_random_uuid();
    v_addon_mel_id UUID := gen_random_uuid();
    v_addon_uva_id UUID := gen_random_uuid();
    v_addon_pacoca_id UUID := gen_random_uuid();
    v_addon_granola_id UUID := gen_random_uuid();
    v_addon_amendoim_id UUID := gen_random_uuid();
    v_addon_flocos_id UUID := gen_random_uuid();
    v_addon_sucrilhos_id UUID := gen_random_uuid();
    v_addon_granulado_id UUID := gen_random_uuid();

    -- Acai products
    v_acai_200_id UUID := gen_random_uuid();
    v_acai_300_id UUID := gen_random_uuid();
    v_acai_400_id UUID := gen_random_uuid();
    v_acai_500_id UUID := gen_random_uuid();
    v_acai_700_id UUID := gen_random_uuid();

BEGIN
    -- 1. Categorias
    INSERT INTO categories (id, name, description, display_order, tenant_id) VALUES
    (v_cat_lanches_id, 'Lanches', 'Pão, carne, milho, cheddar, salada e batata palha', 1, v_tenant_id),
    (v_cat_hotdog_id, 'Hot Dog', 'Frango desfiado, milho, ervilha, azeitona, passas, maionese, katchup e batata palha.', 2, v_tenant_id),
    (v_cat_batata_id, 'Batata Frita', '', 3, v_tenant_id),
    (v_cat_acai_id, 'Açaí', '', 4, v_tenant_id),
    (v_cat_pasteis_id, 'Pastéis', '', 5, v_tenant_id),
    (v_cat_bebidas_id, 'Bebidas', '', 6, v_tenant_id);

    -- 2. Produtos - Lanches
    INSERT INTO products (id, name, description, price, category_id, tenant_id, display_order, available) VALUES
    (gen_random_uuid(), 'HAMBÚRGUER', 'Pão, carne, milho, cheddar, salada e batata palha.', 10.00, v_cat_lanches_id, v_tenant_id, 1, true),
    (gen_random_uuid(), 'X-BURGUER', 'Pão, carne, queijo, milho, cheddar, salada e batata palha.', 13.00, v_cat_lanches_id, v_tenant_id, 2, true),
    (gen_random_uuid(), 'X-EGG BURGUER', 'Pão, carne, ovo, queijo, milho, cheddar, salada e batata palha.', 14.00, v_cat_lanches_id, v_tenant_id, 3, true),
    (gen_random_uuid(), 'X-BACON', 'Pão, carne, bacon, queijo, milho, cheddar, salada e batata palha.', 15.00, v_cat_lanches_id, v_tenant_id, 4, true),
    (gen_random_uuid(), 'X-EGG BACON', 'Pão, carne, bacon, ovo, queijo, milho, cheddar, salada e batata palha.', 16.00, v_cat_lanches_id, v_tenant_id, 5, true),
    (gen_random_uuid(), 'X-CALABRESA', 'Pão, carne, calabresa, queijo, milho, cheddar, salada e batata palha.', 15.00, v_cat_lanches_id, v_tenant_id, 6, true),
    (gen_random_uuid(), 'X-EGG CALABRESA', 'Pão, carne, calabresa, ovo, queijo, milho, cheddar, salada e batata palha.', 16.00, v_cat_lanches_id, v_tenant_id, 7, true),
    (gen_random_uuid(), 'X-FRANGO', 'Pão, carne, frango, queijo, milho, cheddar, salada e batata palha.', 17.00, v_cat_lanches_id, v_tenant_id, 8, true),
    (gen_random_uuid(), 'X-EGG FRANGO', 'Pão, carne, ovo, frango desfiado, queijo, milho, cheddar, salada e batata palha.', 18.00, v_cat_lanches_id, v_tenant_id, 9, true),
    (gen_random_uuid(), 'X-TUDO', 'Pão, carne, ovo, presunto, bacon, calabresa, queijo, frango desfiado, milho, cheddar, salada e batata palha.', 20.00, v_cat_lanches_id, v_tenant_id, 10, true),
    (gen_random_uuid(), 'X-FAMÍLIA', 'Pão, 2 carne, 2 ovo, presunto, bacon, calabresa, queijo, frango desfiado, milho, cheddar, salada e batata palha.', 34.00, v_cat_lanches_id, v_tenant_id, 11, true);

    -- 3. Produtos - Hot Dog
    INSERT INTO products (id, name, description, price, category_id, tenant_id, display_order, available) VALUES
    (gen_random_uuid(), 'HOT DOG DE SALCICHA', 'Frango desfiado, milho, ervilha, azeitona, passas, maionese, katchup e batata palha.', 15.00, v_cat_hotdog_id, v_tenant_id, 1, true),
    (gen_random_uuid(), 'HOT DOG DE LINGUIÇA', 'Frango desfiado, milho, ervilha, azeitona, passas, maionese, katchup e batata palha.', 17.00, v_cat_hotdog_id, v_tenant_id, 2, true);

    -- 4. Produtos - Batata Frita
    INSERT INTO products (id, name, description, price, category_id, tenant_id, display_order, available) VALUES
    (gen_random_uuid(), 'BATATA FRITA-P', '', 18.00, v_cat_batata_id, v_tenant_id, 1, true),
    (gen_random_uuid(), 'BATATA FRITA-G', '', 22.00, v_cat_batata_id, v_tenant_id, 2, true),
    (gen_random_uuid(), 'BATATA FRITA TURBINADA-P', '', 25.00, v_cat_batata_id, v_tenant_id, 3, true),
    (gen_random_uuid(), 'BATATA FRITA TURBINADA-G', '', 30.00, v_cat_batata_id, v_tenant_id, 4, true);

    -- 5. Produtos - Açaí
    INSERT INTO products (id, name, description, price, category_id, tenant_id, display_order, available) VALUES
    (v_acai_200_id, 'Açaí 200ml', '', 7.00, v_cat_acai_id, v_tenant_id, 1, true),
    (v_acai_300_id, 'Açaí 300ml', '', 11.00, v_cat_acai_id, v_tenant_id, 2, true),
    (v_acai_400_id, 'Açaí 400ml', '', 14.00, v_cat_acai_id, v_tenant_id, 3, true),
    (v_acai_500_id, 'Açaí 500ml', '', 16.00, v_cat_acai_id, v_tenant_id, 4, true),
    (v_acai_700_id, 'Açaí 700ml', '', 20.00, v_cat_acai_id, v_tenant_id, 5, true);

    -- 6. Produtos - Pastéis
    INSERT INTO products (id, name, description, price, category_id, tenant_id, display_order, available) VALUES
    (gen_random_uuid(), 'FRANGO C/ QUEIJO', '', 10.00, v_cat_pasteis_id, v_tenant_id, 1, true),
    (gen_random_uuid(), 'FRANGO C/ MILHO', '', 10.00, v_cat_pasteis_id, v_tenant_id, 2, true),
    (gen_random_uuid(), 'QUEIJO C/ PRESUNTO', '', 10.00, v_cat_pasteis_id, v_tenant_id, 3, true),
    (gen_random_uuid(), 'QUEIJO C/ GOIABADA', '', 10.00, v_cat_pasteis_id, v_tenant_id, 4, true),
    (gen_random_uuid(), 'PIZZA', '', 10.00, v_cat_pasteis_id, v_tenant_id, 5, true),
    (gen_random_uuid(), 'FRANGO', '', 10.00, v_cat_pasteis_id, v_tenant_id, 6, true),
    (gen_random_uuid(), 'QUEIJO', '', 10.00, v_cat_pasteis_id, v_tenant_id, 7, true),
    (gen_random_uuid(), 'FRANGO/QUEIJO/MILHO', '', 10.00, v_cat_pasteis_id, v_tenant_id, 8, true);

    -- 7. Produtos - Bebidas
    INSERT INTO products (id, name, description, price, category_id, tenant_id, display_order, available) VALUES
    (gen_random_uuid(), 'REFRIGERANTE LATA', '', 6.00, v_cat_bebidas_id, v_tenant_id, 1, true),
    (gen_random_uuid(), 'COCA COLA 2 LTS', '', 13.00, v_cat_bebidas_id, v_tenant_id, 2, true),
    (gen_random_uuid(), 'MINEIRINHO 2LT', '', 12.00, v_cat_bebidas_id, v_tenant_id, 3, true),
    (gen_random_uuid(), 'GUARANÁ ANTÁRTICA 2LT', '', 12.00, v_cat_bebidas_id, v_tenant_id, 4, true),
    (gen_random_uuid(), 'SUKITA 2LT', '', 10.00, v_cat_bebidas_id, v_tenant_id, 5, true),
    (gen_random_uuid(), 'CLIPER 2LTS', '', 8.00, v_cat_bebidas_id, v_tenant_id, 6, true),
    (gen_random_uuid(), 'REFRIGERANTE 600 ML', '', 8.00, v_cat_bebidas_id, v_tenant_id, 7, true),
    (gen_random_uuid(), 'GUARAVITON', '', 5.00, v_cat_bebidas_id, v_tenant_id, 8, true),
    (gen_random_uuid(), 'H2O', '', 7.00, v_cat_bebidas_id, v_tenant_id, 9, true),
    (gen_random_uuid(), 'ÁGUA MINERAL', '', 2.00, v_cat_bebidas_id, v_tenant_id, 10, true),
    (gen_random_uuid(), 'ÁGUA C/ GÁS', '', 3.50, v_cat_bebidas_id, v_tenant_id, 11, true),
    (gen_random_uuid(), 'ÁGUA MINERAL 1,5 LT', '', 5.00, v_cat_bebidas_id, v_tenant_id, 12, true),
    (gen_random_uuid(), 'GUARAVITA', '', 2.00, v_cat_bebidas_id, v_tenant_id, 13, true);

    -- 8. Addons do Açaí
    INSERT INTO product_addons (id, name, price, tenant_id, available, is_global) VALUES
    (v_addon_leite_cond_id, 'Leite Condensado', 0, v_tenant_id, true, false),
    (v_addon_chocolate_id, 'Chocolate', 0, v_tenant_id, true, false),
    (v_addon_morango_id, 'Morango', 0, v_tenant_id, true, false),
    (v_addon_menta_id, 'Menta', 0, v_tenant_id, true, false),
    (v_addon_mel_id, 'Mel', 0, v_tenant_id, true, false),
    (v_addon_uva_id, 'Uva', 0, v_tenant_id, true, false),
    (v_addon_pacoca_id, 'Paçoca', 0, v_tenant_id, true, false),
    (v_addon_granola_id, 'Granola', 0, v_tenant_id, true, false),
    (v_addon_amendoim_id, 'Amendoim', 0, v_tenant_id, true, false),
    (v_addon_flocos_id, 'Flocos de Arroz', 0, v_tenant_id, true, false),
    (v_addon_sucrilhos_id, 'Sucrilhos', 0, v_tenant_id, true, false),
    (v_addon_granulado_id, 'Granulado', 0, v_tenant_id, true, false);

    -- 9. Vincular Addons aos Produtos de Açaí
    INSERT INTO product_addon_relations (id, product_id, addon_id, tenant_id) VALUES
    (gen_random_uuid(), v_acai_200_id, v_addon_leite_cond_id, v_tenant_id),
    (gen_random_uuid(), v_acai_300_id, v_addon_leite_cond_id, v_tenant_id),
    (gen_random_uuid(), v_acai_400_id, v_addon_leite_cond_id, v_tenant_id),
    (gen_random_uuid(), v_acai_500_id, v_addon_leite_cond_id, v_tenant_id),
    (gen_random_uuid(), v_acai_700_id, v_addon_leite_cond_id, v_tenant_id),

    (gen_random_uuid(), v_acai_200_id, v_addon_chocolate_id, v_tenant_id),
    (gen_random_uuid(), v_acai_300_id, v_addon_chocolate_id, v_tenant_id),
    (gen_random_uuid(), v_acai_400_id, v_addon_chocolate_id, v_tenant_id),
    (gen_random_uuid(), v_acai_500_id, v_addon_chocolate_id, v_tenant_id),
    (gen_random_uuid(), v_acai_700_id, v_addon_chocolate_id, v_tenant_id),

    (gen_random_uuid(), v_acai_200_id, v_addon_morango_id, v_tenant_id),
    (gen_random_uuid(), v_acai_300_id, v_addon_morango_id, v_tenant_id),
    (gen_random_uuid(), v_acai_400_id, v_addon_morango_id, v_tenant_id),
    (gen_random_uuid(), v_acai_500_id, v_addon_morango_id, v_tenant_id),
    (gen_random_uuid(), v_acai_700_id, v_addon_morango_id, v_tenant_id),
    
    (gen_random_uuid(), v_acai_200_id, v_addon_menta_id, v_tenant_id),
    (gen_random_uuid(), v_acai_300_id, v_addon_menta_id, v_tenant_id),
    (gen_random_uuid(), v_acai_400_id, v_addon_menta_id, v_tenant_id),
    (gen_random_uuid(), v_acai_500_id, v_addon_menta_id, v_tenant_id),
    (gen_random_uuid(), v_acai_700_id, v_addon_menta_id, v_tenant_id),

    (gen_random_uuid(), v_acai_200_id, v_addon_mel_id, v_tenant_id),
    (gen_random_uuid(), v_acai_300_id, v_addon_mel_id, v_tenant_id),
    (gen_random_uuid(), v_acai_400_id, v_addon_mel_id, v_tenant_id),
    (gen_random_uuid(), v_acai_500_id, v_addon_mel_id, v_tenant_id),
    (gen_random_uuid(), v_acai_700_id, v_addon_mel_id, v_tenant_id),

    (gen_random_uuid(), v_acai_200_id, v_addon_uva_id, v_tenant_id),
    (gen_random_uuid(), v_acai_300_id, v_addon_uva_id, v_tenant_id),
    (gen_random_uuid(), v_acai_400_id, v_addon_uva_id, v_tenant_id),
    (gen_random_uuid(), v_acai_500_id, v_addon_uva_id, v_tenant_id),
    (gen_random_uuid(), v_acai_700_id, v_addon_uva_id, v_tenant_id),

    (gen_random_uuid(), v_acai_200_id, v_addon_pacoca_id, v_tenant_id),
    (gen_random_uuid(), v_acai_300_id, v_addon_pacoca_id, v_tenant_id),
    (gen_random_uuid(), v_acai_400_id, v_addon_pacoca_id, v_tenant_id),
    (gen_random_uuid(), v_acai_500_id, v_addon_pacoca_id, v_tenant_id),
    (gen_random_uuid(), v_acai_700_id, v_addon_pacoca_id, v_tenant_id),

    (gen_random_uuid(), v_acai_200_id, v_addon_granola_id, v_tenant_id),
    (gen_random_uuid(), v_acai_300_id, v_addon_granola_id, v_tenant_id),
    (gen_random_uuid(), v_acai_400_id, v_addon_granola_id, v_tenant_id),
    (gen_random_uuid(), v_acai_500_id, v_addon_granola_id, v_tenant_id),
    (gen_random_uuid(), v_acai_700_id, v_addon_granola_id, v_tenant_id),

    (gen_random_uuid(), v_acai_200_id, v_addon_amendoim_id, v_tenant_id),
    (gen_random_uuid(), v_acai_300_id, v_addon_amendoim_id, v_tenant_id),
    (gen_random_uuid(), v_acai_400_id, v_addon_amendoim_id, v_tenant_id),
    (gen_random_uuid(), v_acai_500_id, v_addon_amendoim_id, v_tenant_id),
    (gen_random_uuid(), v_acai_700_id, v_addon_amendoim_id, v_tenant_id),

    (gen_random_uuid(), v_acai_200_id, v_addon_flocos_id, v_tenant_id),
    (gen_random_uuid(), v_acai_300_id, v_addon_flocos_id, v_tenant_id),
    (gen_random_uuid(), v_acai_400_id, v_addon_flocos_id, v_tenant_id),
    (gen_random_uuid(), v_acai_500_id, v_addon_flocos_id, v_tenant_id),
    (gen_random_uuid(), v_acai_700_id, v_addon_flocos_id, v_tenant_id),

    (gen_random_uuid(), v_acai_200_id, v_addon_sucrilhos_id, v_tenant_id),
    (gen_random_uuid(), v_acai_300_id, v_addon_sucrilhos_id, v_tenant_id),
    (gen_random_uuid(), v_acai_400_id, v_addon_sucrilhos_id, v_tenant_id),
    (gen_random_uuid(), v_acai_500_id, v_addon_sucrilhos_id, v_tenant_id),
    (gen_random_uuid(), v_acai_700_id, v_addon_sucrilhos_id, v_tenant_id),

    (gen_random_uuid(), v_acai_200_id, v_addon_granulado_id, v_tenant_id),
    (gen_random_uuid(), v_acai_300_id, v_addon_granulado_id, v_tenant_id),
    (gen_random_uuid(), v_acai_400_id, v_addon_granulado_id, v_tenant_id),
    (gen_random_uuid(), v_acai_500_id, v_addon_granulado_id, v_tenant_id),
    (gen_random_uuid(), v_acai_700_id, v_addon_granulado_id, v_tenant_id);

END $$;
