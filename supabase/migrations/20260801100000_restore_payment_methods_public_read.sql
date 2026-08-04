DROP POLICY IF EXISTS "payment_methods_public_read" ON public.payment_methods;

CREATE POLICY "payment_methods_public_read"
    ON public.payment_methods
    FOR SELECT
    TO anon
    USING (enabled = true);
