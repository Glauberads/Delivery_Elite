ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS driver_tracking_enabled BOOLEAN DEFAULT false;
