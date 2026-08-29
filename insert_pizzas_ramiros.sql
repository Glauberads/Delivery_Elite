DO $$
DECLARE
    v_tenant_id UUID;
    v_cat_pizzas_id UUID;
    v_prod_id UUID;
BEGIN
    -- Busca o ID do lojista Ramiro's
    SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'ramiros-lanchonete-e-acai';

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant "ramiros-lanchonete-e-acai" não encontrado!';
    END IF;

    -- Verifica se já existe uma categoria "Pizzas"
    SELECT id INTO v_cat_pizzas_id FROM public.categories WHERE name ILIKE 'Pizza%' AND tenant_id = v_tenant_id LIMIT 1;

    -- Se não existir, cria a categoria
    IF v_cat_pizzas_id IS NULL THEN
        v_cat_pizzas_id := gen_random_uuid();
        INSERT INTO public.categories (id, name, description, display_order, tenant_id)
        VALUES (v_cat_pizzas_id, 'Pizzas', 'Pizzas fresquinhas e deliciosas.', 10, v_tenant_id);
    END IF;

    -- 1. MUSSARELA
    v_prod_id := gen_random_uuid();
    INSERT INTO public.products (id, name, description, price, category_id, tenant_id, display_order, available, has_variations)
    VALUES (v_prod_id, 'MUSSARELA', 'Molho, mussarela e orégano', 35.00, v_cat_pizzas_id, v_tenant_id, 1, true, true);
    INSERT INTO public.product_variations (id, tenant_id, product_id, name, price, sort_order) VALUES
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'P', 35.00, 1),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'G', 60.00, 2),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'GG', 70.00, 3);

    -- 2. PRESUNTO
    v_prod_id := gen_random_uuid();
    INSERT INTO public.products (id, name, description, price, category_id, tenant_id, display_order, available, has_variations)
    VALUES (v_prod_id, 'PRESUNTO', 'Molho, mussarela, presunto e orégano', 35.00, v_cat_pizzas_id, v_tenant_id, 2, true, true);
    INSERT INTO public.product_variations (id, tenant_id, product_id, name, price, sort_order) VALUES
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'P', 35.00, 1),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'G', 60.00, 2),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'GG', 70.00, 3);

    -- 3. MISTA
    v_prod_id := gen_random_uuid();
    INSERT INTO public.products (id, name, description, price, category_id, tenant_id, display_order, available, has_variations)
    VALUES (v_prod_id, 'MISTA', 'Molho, mussarela, calabresa, presunto e orégano', 35.00, v_cat_pizzas_id, v_tenant_id, 3, true, true);
    INSERT INTO public.product_variations (id, tenant_id, product_id, name, price, sort_order) VALUES
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'P', 35.00, 1),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'G', 60.00, 2),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'GG', 70.00, 3);

    -- 4. MARGUERITA
    v_prod_id := gen_random_uuid();
    INSERT INTO public.products (id, name, description, price, category_id, tenant_id, display_order, available, has_variations)
    VALUES (v_prod_id, 'MARGUERITA', 'Molho, mussarela, tomate, manjericão, parmesão e orégano', 35.00, v_cat_pizzas_id, v_tenant_id, 4, true, true);
    INSERT INTO public.product_variations (id, tenant_id, product_id, name, price, sort_order) VALUES
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'P', 35.00, 1),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'G', 60.00, 2),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'GG', 70.00, 3);

    -- 5. BACON
    v_prod_id := gen_random_uuid();
    INSERT INTO public.products (id, name, description, price, category_id, tenant_id, display_order, available, has_variations)
    VALUES (v_prod_id, 'BACON', 'Molho, mussarela, bacon e orégano', 35.00, v_cat_pizzas_id, v_tenant_id, 5, true, true);
    INSERT INTO public.product_variations (id, tenant_id, product_id, name, price, sort_order) VALUES
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'P', 35.00, 1),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'G', 60.00, 2),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'GG', 70.00, 3);

    -- 6. BACON C/ ALHO
    v_prod_id := gen_random_uuid();
    INSERT INTO public.products (id, name, description, price, category_id, tenant_id, display_order, available, has_variations)
    VALUES (v_prod_id, 'BACON C/ ALHO', 'Molho, mussarela, bacon, alho e orégano', 35.00, v_cat_pizzas_id, v_tenant_id, 6, true, true);
    INSERT INTO public.product_variations (id, tenant_id, product_id, name, price, sort_order) VALUES
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'P', 35.00, 1),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'G', 60.00, 2),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'GG', 70.00, 3);

    -- 7. ATUM
    v_prod_id := gen_random_uuid();
    INSERT INTO public.products (id, name, description, price, category_id, tenant_id, display_order, available, has_variations)
    VALUES (v_prod_id, 'ATUM', 'Molho, mussarela, atum, cebola, azeitona e orégano', 35.00, v_cat_pizzas_id, v_tenant_id, 7, true, true);
    INSERT INTO public.product_variations (id, tenant_id, product_id, name, price, sort_order) VALUES
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'P', 35.00, 1),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'G', 60.00, 2),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'GG', 70.00, 3);

    -- 8. PALMITO
    v_prod_id := gen_random_uuid();
    INSERT INTO public.products (id, name, description, price, category_id, tenant_id, display_order, available, has_variations)
    VALUES (v_prod_id, 'PALMITO', 'Molho, mussarela, palmito e orégano', 35.00, v_cat_pizzas_id, v_tenant_id, 8, true, true);
    INSERT INTO public.product_variations (id, tenant_id, product_id, name, price, sort_order) VALUES
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'P', 35.00, 1),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'G', 62.00, 2),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'GG', 72.00, 3);

    -- 9. PRESUNTO ESPECIAL
    v_prod_id := gen_random_uuid();
    INSERT INTO public.products (id, name, description, price, category_id, tenant_id, display_order, available, has_variations)
    VALUES (v_prod_id, 'PRESUNTO ESPECIAL', 'Molho, mussarela, presunto, palmito, milho, bacon e orégano', 35.00, v_cat_pizzas_id, v_tenant_id, 9, true, true);
    INSERT INTO public.product_variations (id, tenant_id, product_id, name, price, sort_order) VALUES
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'P', 35.00, 1),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'G', 62.00, 2),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'GG', 72.00, 3);

    -- 10. LOMBO CANADENSE
    v_prod_id := gen_random_uuid();
    INSERT INTO public.products (id, name, description, price, category_id, tenant_id, display_order, available, has_variations)
    VALUES (v_prod_id, 'LOMBO CANADENSE', 'Molho, mussarela, lombo canadense, catupiry e orégano', 38.00, v_cat_pizzas_id, v_tenant_id, 10, true, true);
    INSERT INTO public.product_variations (id, tenant_id, product_id, name, price, sort_order) VALUES
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'P', 38.00, 1),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'G', 64.00, 2),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'GG', 74.00, 3);

    -- 11. LOMBO CANADENSE C/ ABACAXI
    v_prod_id := gen_random_uuid();
    INSERT INTO public.products (id, name, description, price, category_id, tenant_id, display_order, available, has_variations)
    VALUES (v_prod_id, 'LOMBO CANADENSE C/ ABACAXI', 'Molho, mussarela, lombo canadense, abacaxi e orégano', 38.00, v_cat_pizzas_id, v_tenant_id, 11, true, true);
    INSERT INTO public.product_variations (id, tenant_id, product_id, name, price, sort_order) VALUES
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'P', 38.00, 1),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'G', 64.00, 2),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'GG', 74.00, 3);

    -- 12. PEITO DE PERU
    v_prod_id := gen_random_uuid();
    INSERT INTO public.products (id, name, description, price, category_id, tenant_id, display_order, available, has_variations)
    VALUES (v_prod_id, 'PEITO DE PERU', 'Molho, mussarela, peito de peru, couve e orégano', 35.00, v_cat_pizzas_id, v_tenant_id, 12, true, true);
    INSERT INTO public.product_variations (id, tenant_id, product_id, name, price, sort_order) VALUES
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'P', 35.00, 1),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'G', 62.00, 2),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'GG', 72.00, 3);

    -- 13. PORTUGUESA
    v_prod_id := gen_random_uuid();
    INSERT INTO public.products (id, name, description, price, category_id, tenant_id, display_order, available, has_variations)
    VALUES (v_prod_id, 'PORTUGUESA', 'Molho, mussarela, presunto, calabresa, cebola, azeitona, ovo e orégano', 38.00, v_cat_pizzas_id, v_tenant_id, 13, true, true);
    INSERT INTO public.product_variations (id, tenant_id, product_id, name, price, sort_order) VALUES
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'P', 38.00, 1),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'G', 64.00, 2),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'GG', 74.00, 3);

    -- 14. CALABRESA
    v_prod_id := gen_random_uuid();
    INSERT INTO public.products (id, name, description, price, category_id, tenant_id, display_order, available, has_variations)
    VALUES (v_prod_id, 'CALABRESA', 'Molho, mussarela, calabresa, azeitona, cebola e orégano', 35.00, v_cat_pizzas_id, v_tenant_id, 14, true, true);
    INSERT INTO public.product_variations (id, tenant_id, product_id, name, price, sort_order) VALUES
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'P', 35.00, 1),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'G', 62.00, 2),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'GG', 72.00, 3);

    -- 15. QUATRO QUEIJOS
    v_prod_id := gen_random_uuid();
    INSERT INTO public.products (id, name, description, price, category_id, tenant_id, display_order, available, has_variations)
    VALUES (v_prod_id, 'QUATRO QUEIJOS', 'Molho, mussarela, gorgonzola, catupiry, parmesão e orégano', 38.00, v_cat_pizzas_id, v_tenant_id, 15, true, true);
    INSERT INTO public.product_variations (id, tenant_id, product_id, name, price, sort_order) VALUES
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'P', 38.00, 1),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'G', 64.00, 2),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'GG', 74.00, 3);

    -- 16. CALABRESA ESPECIAL
    v_prod_id := gen_random_uuid();
    INSERT INTO public.products (id, name, description, price, category_id, tenant_id, display_order, available, has_variations)
    VALUES (v_prod_id, 'CALABRESA ESPECIAL', 'Molho, mussarela, calabresa, bacon, ovos, cebola e orégano', 35.00, v_cat_pizzas_id, v_tenant_id, 16, true, true);
    INSERT INTO public.product_variations (id, tenant_id, product_id, name, price, sort_order) VALUES
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'P', 35.00, 1),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'G', 62.00, 2),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'GG', 72.00, 3);

    -- 17. FRANGO COM CATUPIRY
    v_prod_id := gen_random_uuid();
    INSERT INTO public.products (id, name, description, price, category_id, tenant_id, display_order, available, has_variations)
    VALUES (v_prod_id, 'FRANGO COM CATUPIRY', 'Molho, mussarela, frango, catupiry, cebola e orégano', 37.00, v_cat_pizzas_id, v_tenant_id, 17, true, true);
    INSERT INTO public.product_variations (id, tenant_id, product_id, name, price, sort_order) VALUES
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'P', 37.00, 1),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'G', 63.00, 2),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'GG', 73.00, 3);

    -- 18. FRANGO COM CHEDDAR
    v_prod_id := gen_random_uuid();
    INSERT INTO public.products (id, name, description, price, category_id, tenant_id, display_order, available, has_variations)
    VALUES (v_prod_id, 'FRANGO COM CHEDDAR', 'Molho, mussarela, frango, cheddar, cebola e orégano', 37.00, v_cat_pizzas_id, v_tenant_id, 18, true, true);
    INSERT INTO public.product_variations (id, tenant_id, product_id, name, price, sort_order) VALUES
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'P', 37.00, 1),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'G', 63.00, 2),
    (gen_random_uuid(), v_tenant_id, v_prod_id, 'GG', 73.00, 3);

END $$;
