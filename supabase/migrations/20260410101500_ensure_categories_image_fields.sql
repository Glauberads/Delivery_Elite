ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

UPDATE public.categories
SET display_order = 0
WHERE display_order IS NULL;

ALTER TABLE public.categories
    ALTER COLUMN display_order SET DEFAULT 0;



