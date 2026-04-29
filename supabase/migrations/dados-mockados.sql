
-- Adicionar categorias
INSERT INTO public.categories (name, description, display_order, image_url)
VALUES
  ('Hambúrgueres', 'Deliciosos hambúrgueres artesanais', 1, 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?q=80&w=768'),
  ('Bebidas', 'Refrigerantes, sucos e bebidas alcoólicas', 2, 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?q=80&w=768'),
  ('Porções', 'Porções para compartilhar', 3, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=768'),
  ('Sobremesas', 'Doces para finalizar sua refeição', 4, 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?q=80&w=768');

-- Adicionar produtos
INSERT INTO public.products (name, description, price, image_url, category_id, available, featured)
VALUES
  ('Classic Burger', 'Hambúrguer clássico com queijo, alface, tomate e molho especial', 25.90, 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?q=80&w=768', (SELECT id FROM categories WHERE name = 'Hambúrgueres'), true, true),
  ('Cheese Burger', 'Hambúrguer com queijo cheddar duplo', 28.90, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=768', (SELECT id FROM categories WHERE name = 'Hambúrgueres'), true, false),
  ('Bacon Burger', 'Hambúrguer com muito bacon crocante', 32.90, 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?q=80&w=768', (SELECT id FROM categories WHERE name = 'Hambúrgueres'), true, true),
  ('Veggie Burger', 'Hambúrguer vegetariano de grão de bico', 30.90, 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?q=80&w=768', (SELECT id FROM categories WHERE name = 'Hambúrgueres'), true, false),
  
  ('Refrigerante Cola', 'Lata 350ml', 6.00, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=768', (SELECT id FROM categories WHERE name = 'Bebidas'), true, false),
  ('Suco de Laranja', 'Natural 500ml', 9.90, 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?q=80&w=768', (SELECT id FROM categories WHERE name = 'Bebidas'), true, false),
  ('Água Mineral', 'Garrafa 500ml', 4.50, 'https://images.unsplash.com/photo-1638688569176-5b6db19f9d2a?q=80&w=768', (SELECT id FROM categories WHERE name = 'Bebidas'), true, false),
  ('Cerveja Artesanal', 'Long neck 355ml', 12.90, 'https://images.unsplash.com/photo-1566633806327-68e152aaf26d?q=80&w=768', (SELECT id FROM categories WHERE name = 'Bebidas'), true, false),
  
  ('Batata Frita', 'Porção grande com cheddar e bacon', 22.90, 'https://images.unsplash.com/photo-1585109649139-366815a0d713?q=80&w=768', (SELECT id FROM categories WHERE name = 'Porções'), true, true),
  ('Onion Rings', 'Anéis de cebola empanados', 18.90, 'https://images.unsplash.com/photo-1639024471283-03518883512d?q=80&w=768', (SELECT id FROM categories WHERE name = 'Porções'), true, false),
  ('Nuggets', 'Porção com 10 unidades', 19.90, 'https://images.unsplash.com/photo-1562967914-608f82629710?q=80&w=768', (SELECT id FROM categories WHERE name = 'Porções'), true, false),
  
  ('Milkshake', 'Chocolate ou baunilha 400ml', 14.90, 'https://images.unsplash.com/photo-1619158401201-8fa932695178?q=80&w=768', (SELECT id FROM categories WHERE name = 'Sobremesas'), true, false),
  ('Brownie', 'Com sorvete de creme', 12.90, 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?q=80&w=768', (SELECT id FROM categories WHERE name = 'Sobremesas'), true, true),
  ('Cheesecake', 'Com calda de frutas vermelhas', 15.90, 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?q=80&w=768', (SELECT id FROM categories WHERE name = 'Sobremesas'), true, false);

-- Adicionar mais adicionais
INSERT INTO public.product_addons (name, description, price, available, is_global, max_options)
VALUES
  ('Ovo', 'Ovo frito', 2.50, true, true, 1),
  ('Queijo Extra', 'Fatia adicional de queijo', 3.00, true, true, 2),
  ('Molho BBQ', 'Molho barbecue', 1.50, true, true, 1),
  ('Molho Picante', 'Molho com pimenta', 1.50, true, true, 1),
  ('Guacamole', 'Pasta de abacate', 4.00, true, false, 1);

-- Criar relações entre produtos e adicionais
INSERT INTO public.product_addon_relations (product_id, addon_id)
SELECT p.id, a.id
FROM public.products p
CROSS JOIN public.product_addons a
WHERE 
  (p.name = 'Classic Burger' AND a.name IN ('Bacon', 'Cheddar', 'Ovo', 'Queijo Extra', 'Molho da casa')) OR
  (p.name = 'Cheese Burger' AND a.name IN ('Bacon', 'Hamburguer', 'Molho BBQ', 'Queijo Extra')) OR
  (p.name = 'Bacon Burger' AND a.name IN ('Cheddar', 'Hamburguer', 'Ovo', 'Molho Picante')) OR
  (p.name = 'Veggie Burger' AND a.name IN ('Queijo Extra', 'Guacamole', 'Molho da casa')) OR
  (p.name = 'Batata Frita' AND a.name IN ('Bacon', 'Cheddar', 'Molho da casa', 'Molho BBQ', 'Molho Picante'));

-- Criar informações do restaurante
INSERT INTO public.restaurants (name, description, address, phone, logo_url, banner_url, open_time, close_time, delivery_fee, min_order_value)
VALUES (
  'Burger House',
  'O melhor hambúrguer artesanal da cidade. Ingredientes frescos e selecionados para uma experiência gastronômica única.',
  'Rua dos Hamburgueres, 123 - Centro',
  '+55 11 99999-9999',
  'https://images.unsplash.com/photo-1586816001966-79b736744398?q=80&w=768',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=768',
  '11:00',
  '23:00',
  5.00,
  20.00
);



