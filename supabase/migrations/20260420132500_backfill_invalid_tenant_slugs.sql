DO $$
DECLARE
    v_row RECORD;
    v_base_slug TEXT;
    v_slug TEXT;
    v_slug_head TEXT;
    v_slug_suffix TEXT;
    v_slug_attempt INTEGER;
BEGIN
    FOR v_row IN
        SELECT
            t.id,
            t.name,
            t.email,
            t.slug
        FROM public.tenants t
        WHERE
            t.slug IS NULL
            OR t.slug LIKE '-%'
            OR t.slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        ORDER BY t.created_at ASC, t.id ASC
    LOOP
        v_base_slug := public.slugify_tenant_name(v_row.name);

        IF v_base_slug = '' THEN
            v_base_slug := public.slugify_tenant_name(split_part(COALESCE(v_row.email, ''), '@', 1));
        END IF;

        IF v_base_slug = '' THEN
            v_base_slug := 'tenant';
        END IF;

        v_base_slug := regexp_replace(left(v_base_slug, 40), '-+$', '', 'g');

        IF v_base_slug = '' THEN
            v_base_slug := 'tenant';
        END IF;

        v_slug_suffix := substr(replace(v_row.id::text, '-', ''), 1, 6);
        v_slug := v_base_slug;
        v_slug_attempt := 0;

        WHILE EXISTS (
            SELECT 1
            FROM public.tenants t
            WHERE t.slug = v_slug
              AND t.id <> v_row.id
        ) LOOP
            v_slug_attempt := v_slug_attempt + 1;

            IF v_slug_attempt = 1 THEN
                v_slug_head := regexp_replace(left(v_base_slug, 33), '-+$', '', 'g');
                IF v_slug_head = '' THEN
                    v_slug_head := 'tenant';
                END IF;
                v_slug := v_slug_head || '-' || v_slug_suffix;
            ELSE
                v_slug_head := regexp_replace(left(v_base_slug, 30), '-+$', '', 'g');
                IF v_slug_head = '' THEN
                    v_slug_head := 'tenant';
                END IF;
                v_slug := v_slug_head || '-' || v_slug_suffix || v_slug_attempt::TEXT;
            END IF;
        END LOOP;

        UPDATE public.tenants
        SET
            slug = v_slug,
            updated_at = now()
        WHERE id = v_row.id;
    END LOOP;
END;
$$;



