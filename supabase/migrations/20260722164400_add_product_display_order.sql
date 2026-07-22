-- Adiciona a coluna display_order
ALTER TABLE public.products
ADD COLUMN display_order integer;

-- Preenche com sequência determinística (particionado por tenant e categoria)
WITH ordered_products AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, category_id
      ORDER BY created_at ASC, id ASC
    ) - 1 AS calculated_order
  FROM public.products
)
UPDATE public.products AS p
SET display_order = ordered_products.calculated_order
FROM ordered_products
WHERE p.id = ordered_products.id;

-- Torna NOT NULL e define DEFAULT 0 para futuros registros
ALTER TABLE public.products
ALTER COLUMN display_order SET NOT NULL;

ALTER TABLE public.products
ALTER COLUMN display_order SET DEFAULT 0;

-- Cria índice para otimizar ordenação e buscas
CREATE INDEX idx_products_display_order ON public.products (tenant_id, category_id, display_order);
