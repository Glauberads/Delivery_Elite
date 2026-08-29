import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://jfrlqjgrmhzghdvgmnop.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcmxxamdybWh6Z2hkdmdtbm9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0Njk4NzksImV4cCI6MjA5MzA0NTg3OX0.7mefNvdzV0Wzx2ShCNXu8kvQCc-w5ofG7npjSVvUXrU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const tenant_id = 'b8b7c9a0-173f-4e64-b35d-73a04b8bfb8c';

const categories = [
  { name: 'Lanches', description: 'Pão, carne, milho, cheddar, salada e batata palha', display_order: 1 },
  { name: 'Hot Dog', description: 'Frango desfiado, milho, ervilha, azeitona, passas, maionese, katchup e batata palha.', display_order: 2 },
  { name: 'Batata Frita', description: '', display_order: 3 },
  { name: 'Açaí', description: '', display_order: 4 },
  { name: 'Pastéis', description: '', display_order: 5 },
  { name: 'Bebidas', description: '', display_order: 6 }
];

const products_data: Record<string, any[]> = {
  'Lanches': [
    { name: 'HAMBÚRGUER', description: 'Pão, carne, milho, cheddar, salada e batata palha.', price: 10.00 },
    { name: 'X-BURGUER', description: 'Pão, carne, queijo, milho, cheddar, salada e batata palha.', price: 13.00 },
    { name: 'X-EGG BURGUER', description: 'Pão, carne, ovo, queijo, milho, cheddar, salada e batata palha.', price: 14.00 },
    { name: 'X-BACON', description: 'Pão, carne, bacon, queijo, milho, cheddar, salada e batata palha.', price: 15.00 },
    { name: 'X-EGG BACON', description: 'Pão, carne, bacon, ovo, queijo, milho, cheddar, salada e batata palha.', price: 16.00 },
    { name: 'X-CALABRESA', description: 'Pão, carne, calabresa, queijo, milho, cheddar, salada e batata palha.', price: 15.00 },
    { name: 'X-EGG CALABRESA', description: 'Pão, carne, calabresa, ovo, queijo, milho, cheddar, salada e batata palha.', price: 16.00 },
    { name: 'X-FRANGO', description: 'Pão, carne, frango, queijo, milho, cheddar, salada e batata palha.', price: 17.00 },
    { name: 'X-EGG FRANGO', description: 'Pão, carne, ovo, frango desfiado, queijo, milho, cheddar, salada e batata palha.', price: 18.00 },
    { name: 'X-TUDO', description: 'Pão, carne, ovo, presunto, bacon, calabresa, queijo, frango desfiado, milho, cheddar, salada e batata palha.', price: 20.00 },
    { name: 'X-FAMÍLIA', description: 'Pão, 2 carne, 2 ovo, presunto, bacon, calabresa, queijo, frango desfiado, milho, cheddar, salada e batata palha.', price: 34.00 }
  ],
  'Hot Dog': [
    { name: 'HOT DOG DE SALCICHA', description: 'Frango desfiado, milho, ervilha, azeitona, passas, maionese, katchup e batata palha.', price: 15.00 },
    { name: 'HOT DOG DE LINGUIÇA', description: 'Frango desfiado, milho, ervilha, azeitona, passas, maionese, katchup e batata palha.', price: 17.00 }
  ],
  'Batata Frita': [
    { name: 'BATATA FRITA-P', description: '', price: 18.00 },
    { name: 'BATATA FRITA-G', description: '', price: 22.00 },
    { name: 'BATATA FRITA TURBINADA-P', description: '', price: 25.00 },
    { name: 'BATATA FRITA TURBINADA-G', description: '', price: 30.00 }
  ],
  'Açaí': [
    { name: 'Açaí 200ml', description: '', price: 7.00 },
    { name: 'Açaí 300ml', description: '', price: 11.00 },
    { name: 'Açaí 400ml', description: '', price: 14.00 },
    { name: 'Açaí 500ml', description: '', price: 16.00 },
    { name: 'Açaí 700ml', description: '', price: 20.00 }
  ],
  'Pastéis': [
    { name: 'FRANGO C/ QUEIJO', description: '', price: 10.00 },
    { name: 'FRANGO C/ MILHO', description: '', price: 10.00 },
    { name: 'QUEIJO C/ PRESUNTO', description: '', price: 10.00 },
    { name: 'QUEIJO C/ GOIABADA', description: '', price: 10.00 },
    { name: 'PIZZA', description: '', price: 10.00 },
    { name: 'FRANGO', description: '', price: 10.00 },
    { name: 'QUEIJO', description: '', price: 10.00 },
    { name: 'FRANGO/QUEIJO/MILHO', description: '', price: 10.00 }
  ],
  'Bebidas': [
    { name: 'REFRIGERANTE LATA', description: '', price: 6.00 },
    { name: 'COCA COLA 2 LTS', description: '', price: 13.00 },
    { name: 'MINEIRINHO 2LT', description: '', price: 12.00 },
    { name: 'GUARANÁ ANTÁRTICA 2LT', description: '', price: 12.00 },
    { name: 'SUKITA 2LT', description: '', price: 10.00 },
    { name: 'CLIPER 2LTS', description: '', price: 8.00 },
    { name: 'REFRIGERANTE 600 ML', description: '', price: 8.00 },
    { name: 'GUARAVITON', description: '', price: 5.00 },
    { name: 'H2O', description: '', price: 7.00 },
    { name: 'ÁGUA MINERAL', description: '', price: 2.00 },
    { name: 'ÁGUA C/ GÁS', description: '', price: 3.50 },
    { name: 'ÁGUA MINERAL 1,5 LT', description: '', price: 5.00 },
    { name: 'GUARAVITA', description: '', price: 2.00 }
  ]
};

const addons = [
  'Leite Condensado', 'Chocolate', 'Morango', 'Menta', 'Mel', 'Uva',
  'Paçoca', 'Granola', 'Amendoim', 'Flocos de Arroz', 'Sucrilhos', 'Granulado'
];

async function importData() {
  console.log('Inserting categories...');
  for (const cat of categories) {
    const { data: catData, error: catError } = await supabase
      .from('categories')
      .insert({ ...cat, tenant_id })
      .select()
      .single();

    if (catError) {
      console.error(`Error inserting category ${cat.name}:`, catError.message);
      continue;
    }

    console.log(`Inserted category: ${cat.name} (ID: ${catData.id})`);
    
    // Insert products for this category
    const products = products_data[cat.name] || [];
    let display_order = 1;
    for (const prod of products) {
      const { data: prodData, error: prodError } = await supabase
        .from('products')
        .insert({
          name: prod.name,
          description: prod.description,
          price: prod.price,
          category_id: catData.id,
          tenant_id,
          display_order: display_order++,
          available: true
        })
        .select()
        .single();
      
      if (prodError) {
        console.error(`Error inserting product ${prod.name}:`, prodError.message);
      } else {
        console.log(`  Inserted product: ${prod.name} (ID: ${prodData.id})`);
        
        // If it's Açaí, link the addons
        if (cat.name === 'Açaí') {
            // we will do this after
            prodData._isAcai = true;
        }
      }
    }
  }

  // Insert Addons
  console.log('Inserting addons...');
  for (const addonName of addons) {
    const { data: addonData, error: addonError } = await supabase
      .from('product_addons')
      .insert({
        name: addonName,
        price: 0,
        tenant_id,
        available: true,
        is_global: false
      })
      .select()
      .single();

    if (addonError) {
      console.error(`Error inserting addon ${addonName}:`, addonError.message);
    } else {
      console.log(`Inserted addon: ${addonName}`);
      
      // We would ideally link these addons to specific products in product_addon_relations
      // We can query all Acai products and link them
      const { data: acaiProducts } = await supabase
        .from('products')
        .select('id')
        .eq('tenant_id', tenant_id)
        .like('name', 'Açaí%');
        
      if (acaiProducts) {
          for (const acp of acaiProducts) {
             await supabase.from('product_addon_relations').insert({
                 addon_id: addonData.id,
                 product_id: acp.id,
                 tenant_id
             });
          }
      }
    }
  }

  console.log('Finished importing data.');
}

importData().catch(console.error);
