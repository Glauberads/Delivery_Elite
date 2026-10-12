


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."plan_type" AS ENUM (
    'monthly',
    'quarterly',
    'annual'
);


ALTER TYPE "public"."plan_type" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status" AS ENUM (
    'active',
    'past_due',
    'canceled',
    'trialing'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";


CREATE TYPE "public"."superadmin_role" AS ENUM (
    'superadmin',
    'support'
);


ALTER TYPE "public"."superadmin_role" OWNER TO "postgres";


CREATE TYPE "public"."tenant_status" AS ENUM (
    'trial',
    'active',
    'suspended',
    'cancelled'
);


ALTER TYPE "public"."tenant_status" OWNER TO "postgres";


CREATE TYPE "public"."tenant_user_role" AS ENUM (
    'admin',
    'manager',
    'staff',
    'driver'
);


ALTER TYPE "public"."tenant_user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_insert_public_order_item"("p_order_id" "uuid", "p_product_id" "uuid", "p_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.orders AS orders
        JOIN public.products AS products
          ON products.id = p_product_id
         AND products.tenant_id = p_tenant_id
        WHERE orders.id = p_order_id
          AND orders.tenant_id = p_tenant_id
          AND orders.status = 'pending'
          AND orders.created_at >= NOW() - INTERVAL '15 minutes'
    );
$$;


ALTER FUNCTION "public"."can_insert_public_order_item"("p_order_id" "uuid", "p_product_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_insert_public_order_item_addon"("p_order_item_id" "uuid", "p_addon_id" "uuid", "p_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.order_items AS order_items
        JOIN public.orders AS orders
          ON orders.id = order_items.order_id
         AND orders.tenant_id = p_tenant_id
        JOIN public.product_addons AS addons
          ON addons.id = p_addon_id
         AND (addons.tenant_id = p_tenant_id OR addons.is_global = TRUE)
        WHERE order_items.id = p_order_item_id
          AND order_items.tenant_id = p_tenant_id
          AND orders.status = 'pending'
          AND orders.created_at >= NOW() - INTERVAL '15 minutes'
    );
$$;


ALTER FUNCTION "public"."can_insert_public_order_item_addon"("p_order_item_id" "uuid", "p_addon_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_public_signup_account"("p_user_id" "uuid", "p_email" "text", "p_full_name" "text" DEFAULT NULL::"text", "p_store_name" "text" DEFAULT NULL::"text", "p_cpf_cnpj" "text" DEFAULT NULL::"text", "p_whatsapp" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions'
    AS $_$
DECLARE
    v_email TEXT := lower(btrim(COALESCE(p_email, '')));
    v_full_name TEXT := btrim(COALESCE(p_full_name, ''));
    v_store_name TEXT := btrim(COALESCE(p_store_name, ''));
    v_cpf_cnpj TEXT := regexp_replace(COALESCE(p_cpf_cnpj, ''), '\D', '', 'g');
    v_whatsapp TEXT := regexp_replace(COALESCE(p_whatsapp, ''), '\D', '', 'g');
    v_first_name TEXT;
    v_last_name TEXT;
    v_base_slug TEXT;
    v_slug TEXT;
    v_slug_head TEXT;
    v_slug_suffix TEXT := substr(replace(p_user_id::text, '-', ''), 1, 6);
    v_slug_attempt INTEGER := 0;
    v_tenant_id UUID;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario obrigatorio para provisionar o cadastro publico.';
    END IF;

    IF v_email = '' THEN
        RAISE EXCEPTION 'Email obrigatorio para cadastro publico.';
    END IF;

    SELECT tu.tenant_id
    INTO v_tenant_id
    FROM public.tenant_users tu
    WHERE tu.id = p_user_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        SELECT t.id
        INTO v_tenant_id
        FROM public.tenants t
        WHERE t.created_by = p_user_id
        LIMIT 1;
    END IF;

    IF v_tenant_id IS NULL THEN
        IF v_full_name = '' THEN
            RAISE EXCEPTION 'Nome completo obrigatorio para cadastro publico.';
        END IF;

        IF v_store_name = '' THEN
            RAISE EXCEPTION 'Nome da loja obrigatorio para cadastro publico.';
        END IF;

        IF v_cpf_cnpj !~ '^(?:[0-9]{11}|[0-9]{14})$' THEN
            RAISE EXCEPTION 'CPF ou CNPJ invalido para cadastro publico.';
        END IF;

        IF v_whatsapp !~ '^[0-9]{10,11}$' THEN
            RAISE EXCEPTION 'WhatsApp invalido para cadastro publico.';
        END IF;
    END IF;

    IF v_full_name <> '' THEN
        v_first_name := split_part(v_full_name, ' ', 1);
        v_last_name := NULLIF(btrim(substr(v_full_name, char_length(v_first_name) + 1)), '');
    END IF;

    IF v_tenant_id IS NULL THEN
        v_base_slug := public.slugify_tenant_name(v_store_name);

        IF v_base_slug = '' THEN
            v_base_slug := public.slugify_tenant_name(split_part(v_email, '@', 1));
        END IF;

        IF v_base_slug = '' THEN
            v_base_slug := 'tenant';
        END IF;

        v_base_slug := regexp_replace(left(v_base_slug, 40), '-+$', '', 'g');

        IF v_base_slug = '' THEN
            v_base_slug := 'tenant';
        END IF;

        v_slug := v_base_slug;

        WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug) LOOP
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

        INSERT INTO public.tenants (
            name,
            slug,
            email,
            status,
            created_by,
            full_name,
            cpf_cnpj,
            whatsapp,
            phone
        ) VALUES (
            v_store_name,
            v_slug,
            v_email,
            'trialing',
            p_user_id,
            v_full_name,
            v_cpf_cnpj,
            v_whatsapp,
            v_whatsapp
        )
        RETURNING id INTO v_tenant_id;
    ELSE
        UPDATE public.tenants
        SET
            name = COALESCE(NULLIF(v_store_name, ''), name),
            email = v_email,
            full_name = COALESCE(NULLIF(v_full_name, ''), full_name),
            cpf_cnpj = COALESCE(NULLIF(v_cpf_cnpj, ''), cpf_cnpj),
            whatsapp = COALESCE(NULLIF(v_whatsapp, ''), whatsapp),
            phone = COALESCE(NULLIF(v_whatsapp, ''), phone),
            created_by = COALESCE(created_by, p_user_id),
            status = COALESCE(status, 'trialing'),
            updated_at = now()
        WHERE id = v_tenant_id;
    END IF;

    INSERT INTO public.restaurants (
        tenant_id
    ) VALUES (
        v_tenant_id
    )
    ON CONFLICT (tenant_id) DO UPDATE
    SET
        updated_at = now();

    INSERT INTO public.tenant_settings (
        tenant_id,
        allow_signup
    ) VALUES (
        v_tenant_id,
        false
    )
    ON CONFLICT (tenant_id) DO UPDATE
    SET
        updated_at = now();

    INSERT INTO public.tenant_users (
        id,
        tenant_id,
        email,
        first_name,
        last_name,
        role,
        active
    ) VALUES (
        p_user_id,
        v_tenant_id,
        v_email,
        v_first_name,
        v_last_name,
        'admin',
        true
    )
    ON CONFLICT (id) DO UPDATE
    SET
        tenant_id = EXCLUDED.tenant_id,
        email = EXCLUDED.email,
        first_name = COALESCE(EXCLUDED.first_name, public.tenant_users.first_name),
        last_name = COALESCE(EXCLUDED.last_name, public.tenant_users.last_name),
        role = 'admin',
        active = true,
        updated_at = now();

    UPDATE auth.users
    SET
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
            'tenant_id', v_tenant_id,
            'tenant_role', 'admin',
            'full_name', NULLIF(v_full_name, ''),
            'store_name', NULLIF(v_store_name, ''),
            'storeName', NULLIF(v_store_name, ''),
            'cpf_cnpj', NULLIF(v_cpf_cnpj, ''),
            'whatsapp', NULLIF(v_whatsapp, '')
        )),
        updated_at = now()
    WHERE id = p_user_id;

    RETURN v_tenant_id;
END;
$_$;


ALTER FUNCTION "public"."ensure_public_signup_account"("p_user_id" "uuid", "p_email" "text", "p_full_name" "text", "p_store_name" "text", "p_cpf_cnpj" "text", "p_whatsapp" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ensure_public_signup_account"("p_user_id" "uuid", "p_email" "text", "p_full_name" "text", "p_store_name" "text", "p_cpf_cnpj" "text", "p_whatsapp" "text") IS 'Provisiona tenant, tenant_user, restaurant e tenant_settings de forma idempotente para cadastros publicos.';



CREATE OR REPLACE FUNCTION "public"."generate_order_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    year_prefix TEXT;
    sequence_number INT;
BEGIN
    year_prefix := to_char(now(), 'YYYY');

    SELECT COALESCE(
        MAX(NULLIF(regexp_replace(number, '^[0-9]{4}', ''), ''))::integer, 0
    ) + 1
    INTO sequence_number
    FROM public.orders
    WHERE number LIKE year_prefix || '%'
      AND tenant_id = NEW.tenant_id;

    NEW.number := year_prefix || LPAD(sequence_number::text, 4, '0');
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_tenant_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT tenant_id FROM public.tenant_users WHERE id = auth.uid() LIMIT 1;
$$;


ALTER FUNCTION "public"."get_my_tenant_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_my_tenant_id"() IS 'Retorna o tenant_id do usuário autenticado — usada pelo RLS';



CREATE OR REPLACE FUNCTION "public"."get_product_addon_relations"() RETURNS TABLE("id" "uuid", "product_id" "uuid", "addon_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT id, product_id, addon_id
    FROM public.product_addon_relations
    WHERE tenant_id = public.get_my_tenant_id();
$$;


ALTER FUNCTION "public"."get_product_addon_relations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_product_addons"() RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "price" numeric, "available" boolean, "is_global" boolean, "max_options" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT id, name, description, price, available, is_global, max_options
    FROM public.product_addons
    WHERE tenant_id = public.get_my_tenant_id()
    ORDER BY name;
$$;


ALTER FUNCTION "public"."get_product_addons"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_product_addons_by_product"("product_id_param" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "price" numeric, "available" boolean, "is_global" boolean, "max_options" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT pa.id, pa.name, pa.description, pa.price,
           pa.available, pa.is_global, pa.max_options
    FROM public.product_addons pa
    WHERE pa.tenant_id = public.get_my_tenant_id()
      AND (
          pa.is_global = true
          OR pa.id IN (
              SELECT par.addon_id
              FROM public.product_addon_relations par
              WHERE par.product_id = product_id_param
                AND par.tenant_id = public.get_my_tenant_id()
          )
      )
    ORDER BY pa.name;
$$;


ALTER FUNCTION "public"."get_product_addons_by_product"("product_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_product_by_id"("p_product_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "price" numeric, "image_url" "text", "category_id" "uuid", "category_name" "text", "available" boolean, "featured" boolean, "created_at" timestamp with time zone, "has_variations" boolean, "extras_group_id" "uuid", "sides_group_id" "uuid", "variations" "jsonb", "groups" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := public.get_my_tenant_id();

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant não identificado';
    END IF;

    RETURN QUERY
    SELECT *
    FROM public.get_product_full_internal(v_tenant_id) pf
    WHERE pf.id = p_product_id;
END;
$$;


ALTER FUNCTION "public"."get_product_by_id"("p_product_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_product_full"() RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "price" numeric, "image_url" "text", "category_id" "uuid", "category_name" "text", "available" boolean, "featured" boolean, "created_at" timestamp with time zone, "has_variations" boolean, "extras_group_id" "uuid", "sides_group_id" "uuid", "variations" "jsonb", "groups" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := public.get_my_tenant_id();

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant não identificado';
    END IF;

    RETURN QUERY
    SELECT *
    FROM public.get_product_full_internal(v_tenant_id);
END;
$$;


ALTER FUNCTION "public"."get_product_full"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_product_full_by_tenant"("p_tenant_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "price" numeric, "image_url" "text", "category_id" "uuid", "category_name" "text", "available" boolean, "featured" boolean, "created_at" timestamp with time zone, "has_variations" boolean, "extras_group_id" "uuid", "sides_group_id" "uuid", "variations" "jsonb", "groups" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.get_product_full_internal(p_tenant_id);
END;
$$;


ALTER FUNCTION "public"."get_product_full_by_tenant"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_product_full_internal"("p_tenant_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "price" numeric, "image_url" "text", "category_id" "uuid", "category_name" "text", "available" boolean, "featured" boolean, "created_at" timestamp with time zone, "has_variations" boolean, "extras_group_id" "uuid", "sides_group_id" "uuid", "variations" "jsonb", "groups" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant não identificado';
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.description,
        p.price,
        p.image_url,
        p.category_id,
        c.name::TEXT AS category_name,
        p.available,
        p.featured,
        p.created_at,
        COALESCE(p.has_variations, false) AS has_variations,
        p.extras_group_id,
        p.sides_group_id,

        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', v.id,
                        'name', v.name,
                        'price', v.price,
                        'sort_order', v.sort_order
                    )
                    ORDER BY v.sort_order
                )
                FROM public.product_variations v
                WHERE v.product_id = p.id
                  AND v.tenant_id = p_tenant_id
            ),
            '[]'::jsonb
        ) AS variations,

        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', mg.id,
                        'name', mg.name,
                        'behavior_type', mg.behavior_type,
                        'min_options', mg.min_options,
                        'max_options', mg.max_options,
                        'pricing_rule', mg.pricing_rule,
                        'items',
                        CASE
                            WHEN mg.behavior_type IN ('fractional', 'flavor_mix') THEN
                                COALESCE(
                                    (
                                        SELECT jsonb_agg(
                                            jsonb_build_object(
                                                'id', fp.id,
                                                'name', fp.name,
                                                'price', fp.price,
                                                'display_order', 0
                                            )
                                            ORDER BY fp.name
                                        )
                                        FROM public.category_modifier_groups cmg_items
                                        JOIN public.products fp
                                          ON fp.category_id = cmg_items.category_id
                                         AND fp.tenant_id = p_tenant_id
                                        WHERE cmg_items.group_id = mg.id
                                          AND cmg_items.tenant_id = p_tenant_id
                                          AND COALESCE(fp.available, true) = true
                                    ),
                                    '[]'::jsonb
                                )
                            ELSE
                                COALESCE(
                                    (
                                        SELECT jsonb_agg(
                                            jsonb_build_object(
                                                'id', ga.addon_id,
                                                'name', pa.name,
                                                'price', pa.price,
                                                'display_order', ga.display_order
                                            )
                                            ORDER BY ga.display_order
                                        )
                                        FROM public.group_attributes ga
                                        JOIN public.product_addons pa
                                          ON pa.id = ga.addon_id
                                        WHERE ga.group_id = mg.id
                                          AND ga.tenant_id = p_tenant_id
                                          AND pa.tenant_id = p_tenant_id
                                          AND (
                                              (
                                                  mg.behavior_type IN ('checkbox', 'extras')
                                                  AND EXISTS (
                                                      SELECT 1
                                                      FROM public.product_addon_selections pas
                                                      WHERE pas.tenant_id = p_tenant_id
                                                        AND pas.product_id = p.id
                                                        AND pas.addon_id = ga.addon_id
                                                        AND pas.type = 'extras'
                                                  )
                                              )
                                              OR (
                                                  mg.behavior_type IN ('stepper', 'side_items')
                                                  AND EXISTS (
                                                      SELECT 1
                                                      FROM public.product_addon_selections pas
                                                      WHERE pas.tenant_id = p_tenant_id
                                                        AND pas.product_id = p.id
                                                        AND pas.addon_id = ga.addon_id
                                                        AND pas.type = 'sides'
                                                  )
                                              )
                                          )
                                    ),
                                    '[]'::jsonb
                                )
                        END
                    )
                    ORDER BY mg.display_order, mg.name
                )
                FROM public.modifier_groups mg
                WHERE mg.tenant_id = p_tenant_id
                  AND (
                      mg.id = p.extras_group_id
                      OR mg.id = p.sides_group_id
                      OR EXISTS (
                          SELECT 1
                          FROM public.category_modifier_groups cmg
                          WHERE cmg.tenant_id = p_tenant_id
                            AND cmg.category_id = p.category_id
                            AND cmg.group_id = mg.id
                      )
                  )
                  AND EXISTS (
                      SELECT 1
                      FROM public.group_attributes ga
                      JOIN public.product_addons pa
                        ON pa.id = ga.addon_id
                       AND pa.tenant_id = p_tenant_id
                      LEFT JOIN public.product_addon_selections pas
                        ON pas.addon_id = ga.addon_id
                       AND pas.product_id = p.id
                       AND pas.tenant_id = p_tenant_id
                      WHERE ga.group_id = mg.id
                        AND ga.tenant_id = p_tenant_id
                        AND (
                            (mg.behavior_type IN ('checkbox', 'extras') AND pas.type = 'extras')
                            OR
                            (mg.behavior_type IN ('stepper', 'side_items') AND pas.type = 'sides')
                        )
                      UNION ALL
                      SELECT 1
                      FROM public.category_modifier_groups cmg_fx
                      JOIN public.products fp
                        ON fp.category_id = cmg_fx.category_id
                       AND fp.tenant_id = p_tenant_id
                      WHERE cmg_fx.group_id = mg.id
                        AND cmg_fx.tenant_id = p_tenant_id
                        AND mg.behavior_type IN ('fractional', 'flavor_mix')
                        AND COALESCE(fp.available, true) = true
                  )
            ),
            '[]'::jsonb
        ) AS groups
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE p.tenant_id = p_tenant_id
    ORDER BY p.name ASC;
END;
$$;


ALTER FUNCTION "public"."get_product_full_internal"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_public_signup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions'
    AS $$
BEGIN
    IF COALESCE(NEW.raw_user_meta_data ->> 'signup_source', '') <> 'public_register' THEN
        RETURN NEW;
    END IF;

    PERFORM public.ensure_public_signup_account(
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data ->> 'full_name',
        COALESCE(NEW.raw_user_meta_data ->> 'store_name', NEW.raw_user_meta_data ->> 'storeName'),
        NEW.raw_user_meta_data ->> 'cpf_cnpj',
        NEW.raw_user_meta_data ->> 'whatsapp'
    );

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_public_signup"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_public_signup"() IS 'Provisiona cadastro publico no momento da criacao do auth.users usando a funcao idempotente shared.';



CREATE OR REPLACE FUNCTION "public"."handle_updated_at_tenant_domains"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at_tenant_domains"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_superadmin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT EXISTS(
        SELECT 1 FROM public.superadmin_users WHERE id = auth.uid()
    );
$$;


ALTER FUNCTION "public"."is_superadmin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_superadmin"() IS 'Verifica se o usuário é superadmin — usada pelo RLS';



CREATE OR REPLACE FUNCTION "public"."repair_my_public_signup_account"("p_full_name" "text" DEFAULT NULL::"text", "p_store_name" "text" DEFAULT NULL::"text", "p_cpf_cnpj" "text" DEFAULT NULL::"text", "p_whatsapp" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions'
    AS $$
DECLARE
    v_user auth.users%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sessao obrigatoria para reparar o cadastro.';
    END IF;

    SELECT *
    INTO v_user
    FROM auth.users
    WHERE id = auth.uid()
    LIMIT 1;

    IF v_user.id IS NULL THEN
        RAISE EXCEPTION 'Usuario autenticado nao encontrado.';
    END IF;

    IF COALESCE(v_user.raw_user_meta_data ->> 'signup_source', '') <> 'public_register' THEN
        RAISE EXCEPTION 'Cadastro atual nao pertence ao fluxo publico.';
    END IF;

    RETURN public.ensure_public_signup_account(
        v_user.id,
        v_user.email,
        COALESCE(NULLIF(p_full_name, ''), v_user.raw_user_meta_data ->> 'full_name'),
        COALESCE(NULLIF(p_store_name, ''), v_user.raw_user_meta_data ->> 'store_name', v_user.raw_user_meta_data ->> 'storeName'),
        COALESCE(NULLIF(p_cpf_cnpj, ''), v_user.raw_user_meta_data ->> 'cpf_cnpj'),
        COALESCE(NULLIF(p_whatsapp, ''), v_user.raw_user_meta_data ->> 'whatsapp')
    );
END;
$$;


ALTER FUNCTION "public"."repair_my_public_signup_account"("p_full_name" "text", "p_store_name" "text", "p_cpf_cnpj" "text", "p_whatsapp" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."repair_my_public_signup_account"("p_full_name" "text", "p_store_name" "text", "p_cpf_cnpj" "text", "p_whatsapp" "text") IS 'Permite auto-reparo do cadastro publico para usuarios autenticados quando tenant_user nao foi provisionado.';



CREATE OR REPLACE FUNCTION "public"."resolve_tenant_domain"("p_domain" "text") RETURNS TABLE("tenant_id" "uuid", "tenant_slug" "text", "domain_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        td.tenant_id,
        t.slug AS tenant_slug,
        td.status AS domain_status
    FROM public.tenant_domains td
    JOIN public.tenants t ON t.id = td.tenant_id
    WHERE td.domain = p_domain;
END;
$$;


ALTER FUNCTION "public"."resolve_tenant_domain"("p_domain" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slugify_tenant_name"("value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $_$
    SELECT regexp_replace(
        regexp_replace(
            regexp_replace(
                lower(extensions.unaccent(COALESCE(value, ''))),
                '[^a-z0-9]+',
                '-',
                'g'
            ),
            '-{2,}',
            '-',
            'g'
        ),
        '(^-+|-+$)',
        '',
        'g'
    );
$_$;


ALTER FUNCTION "public"."slugify_tenant_name"("value" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."slugify_tenant_name"("value" "text") IS 'Normaliza o nome da loja para slug: lowercase, sem acento, apenas a-z0-9 e hífen.';



CREATE OR REPLACE FUNCTION "public"."superadmin_renew_tenant"("p_tenant_id" "uuid", "p_plan_id" "uuid", "p_new_end_date" timestamp with time zone, "p_price" numeric DEFAULT 0) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions'
    AS $$
DECLARE
    v_subscription_exists BOOLEAN;
BEGIN
    -- 1. Verifica permissões
    IF NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    -- 2. Atualiza ou insere na tenant_subscriptions
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_subscriptions WHERE tenant_id = p_tenant_id
    ) INTO v_subscription_exists;

    IF v_subscription_exists THEN
        UPDATE public.tenant_subscriptions
        SET
            plan_id = p_plan_id,
            status = 'active',
            current_period_end = p_new_end_date,
            updated_at = now()
        WHERE tenant_id = p_tenant_id;
    ELSE
        INSERT INTO public.tenant_subscriptions (
            tenant_id,
            plan_id,
            status,
            current_period_start,
            current_period_end,
            billing_type
        ) VALUES (
            p_tenant_id,
            p_plan_id,
            'active',
            now(),
            p_new_end_date,
            NULL
        );
    END IF;

    -- 3. Atualiza na tenants
    UPDATE public.tenants
    SET
        status = 'active',
        plan_id = p_plan_id,
        trial_ends_at = p_new_end_date,
        updated_at = now()
    WHERE id = p_tenant_id;

    -- 4. Insere histórico financeiro
    INSERT INTO public.tenant_billing_history (
        tenant_id,
        plan_id,
        amount,
        status,
        payment_method,
        paid_at,
        description
    ) VALUES (
        p_tenant_id,
        p_plan_id,
        p_price,
        'paid',
        'manual_superadmin',
        now(),
        'Renovação manual pelo painel Super Admin'
    );

    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."superadmin_renew_tenant"("p_tenant_id" "uuid", "p_plan_id" "uuid", "p_new_end_date" timestamp with time zone, "p_price" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."superadmin_renew_tenant"("p_tenant_id" "uuid", "p_plan_id" "uuid", "p_new_end_date" timestamp with time zone, "p_price" numeric) IS 'Função usada pelo painel Super Admin para realizar uma renovação explícita de assinatura, atualizando status, vencimento e gerando histórico de cobrança pago.';



CREATE OR REPLACE FUNCTION "public"."superadmin_save_restaurant_with_owner"("p_tenant_id" "uuid" DEFAULT NULL::"uuid", "p_restaurant_name" "text" DEFAULT NULL::"text", "p_slug" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT 'trialing'::"text", "p_plan_id" "uuid" DEFAULT NULL::"uuid", "p_password" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions'
    AS $_$
DECLARE
    v_tenant_id UUID;
    v_owner_user_id UUID;
    v_name TEXT := btrim(COALESCE(p_restaurant_name, ''));
    v_slug TEXT := lower(btrim(COALESCE(p_slug, '')));
    v_email TEXT := lower(btrim(COALESCE(p_email, '')));
    v_phone TEXT := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
    v_password TEXT := NULLIF(COALESCE(p_password, ''), '');
    v_status TEXT := lower(btrim(COALESCE(p_status, 'trialing')));
    v_existing_address TEXT;
    v_subscription_status public.subscription_status;
BEGIN
    IF NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    IF char_length(v_name) < 2 THEN
        RAISE EXCEPTION 'Nome do restaurante inválido.';
    END IF;

    IF v_slug = '' OR v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
        RAISE EXCEPTION 'Slug inválido.';
    END IF;

    IF v_email = '' OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
        RAISE EXCEPTION 'Email inválido.';
    END IF;

    IF v_phone !~ '^55[0-9]{11}$' THEN
        RAISE EXCEPTION 'WhatsApp inválido. Use 55 DDD + número com 9 dígitos.';
    END IF;

    IF v_status NOT IN ('trialing', 'active', 'suspended', 'cancelled') THEN
        RAISE EXCEPTION 'Status inválido.';
    END IF;

    IF p_tenant_id IS NULL AND v_password IS NULL THEN
        RAISE EXCEPTION 'Senha obrigatória para novo restaurante.';
    END IF;

    IF v_password IS NOT NULL AND char_length(v_password) < 6 THEN
        RAISE EXCEPTION 'A senha precisa ter pelo menos 6 caracteres.';
    END IF;

    v_subscription_status := CASE
        WHEN v_status = 'active' THEN 'active'::public.subscription_status
        ELSE 'trialing'::public.subscription_status
    END;

    IF p_tenant_id IS NULL THEN
        INSERT INTO public.tenants (
            name,
            slug,
            email,
            phone,
            status,
            plan_id,
            created_by
        ) VALUES (
            v_name,
            v_slug,
            v_email,
            v_phone,
            v_status,
            p_plan_id,
            auth.uid()
        )
        RETURNING id INTO v_tenant_id;
    ELSE
        SELECT address
        INTO v_existing_address
        FROM public.restaurants
        WHERE tenant_id = p_tenant_id;

        UPDATE public.tenants
        SET
            name = v_name,
            slug = v_slug,
            email = v_email,
            phone = v_phone,
            status = v_status,
            plan_id = p_plan_id,
            updated_at = now()
        WHERE id = p_tenant_id
        RETURNING id INTO v_tenant_id;

        IF v_tenant_id IS NULL THEN
            RAISE EXCEPTION 'Tenant não encontrado.';
        END IF;
    END IF;

    INSERT INTO public.restaurants (
        tenant_id,
        address
    ) VALUES (
        v_tenant_id,
        v_existing_address
    )
    ON CONFLICT (tenant_id) DO UPDATE
    SET
        address = COALESCE(public.restaurants.address, EXCLUDED.address),
        updated_at = now();

    INSERT INTO public.tenant_settings (tenant_id, allow_signup)
    VALUES (v_tenant_id, false)
    ON CONFLICT (tenant_id) DO UPDATE
    SET
        allow_signup = EXCLUDED.allow_signup,
        updated_at = now();

    IF p_plan_id IS NULL THEN
        DELETE FROM public.tenant_subscriptions
        WHERE tenant_id = v_tenant_id;
    ELSE
        UPDATE public.tenant_subscriptions
        SET
            plan_id = p_plan_id,
            status = v_subscription_status,
            updated_at = now()
        WHERE tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            INSERT INTO public.tenant_subscriptions (
                tenant_id,
                plan_id,
                status,
                current_period_start,
                current_period_end,
                billing_type
            ) VALUES (
                v_tenant_id,
                p_plan_id,
                v_subscription_status,
                now(),
                now() + interval '1 month',
                NULL
            );
        END IF;
    END IF;

    SELECT tu.id
    INTO v_owner_user_id
    FROM public.tenant_users tu
    WHERE tu.tenant_id = v_tenant_id
      AND tu.role = 'admin'
    ORDER BY tu.created_at ASC
    LIMIT 1;

    IF v_owner_user_id IS NULL THEN
        IF v_password IS NULL THEN
            RAISE EXCEPTION 'Senha obrigatória para criar o acesso do restaurante.';
        END IF;

        v_owner_user_id := gen_random_uuid();

        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            created_at,
            updated_at,
            aud,
            role,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change
        ) VALUES (
            v_owner_user_id,
            '00000000-0000-0000-0000-000000000000'::uuid,
            v_email,
            extensions.crypt(v_password, extensions.gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object(
                'tenant_id', v_tenant_id,
                'tenant_role', 'admin',
                'restaurant_name', v_name
            ),
            false,
            now(),
            now(),
            'authenticated',
            'authenticated',
            '',
            '',
            '',
            ''
        );

        INSERT INTO auth.identities (
            id,
            user_id,
            provider_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_owner_user_id,
            v_email,
            jsonb_build_object(
                'sub', v_owner_user_id::text,
                'email', v_email,
                'email_verified', true
            ),
            'email',
            now(),
            now(),
            now()
        );

        INSERT INTO public.tenant_users (
            id,
            tenant_id,
            email,
            role,
            active
        ) VALUES (
            v_owner_user_id,
            v_tenant_id,
            v_email,
            'admin',
            true
        );
    ELSE
        UPDATE auth.users
        SET
            email = v_email,
            encrypted_password = CASE
                WHEN v_password IS NOT NULL THEN extensions.crypt(v_password, extensions.gen_salt('bf'))
                ELSE encrypted_password
            END,
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
                'tenant_id', v_tenant_id,
                'tenant_role', 'admin',
                'restaurant_name', v_name
            ),
            updated_at = now()
        WHERE id = v_owner_user_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Usuário de acesso do restaurante não encontrado.';
        END IF;

        UPDATE public.tenant_users
        SET
            tenant_id = v_tenant_id,
            email = v_email,
            role = 'admin',
            active = true,
            updated_at = now()
        WHERE id = v_owner_user_id;

        UPDATE auth.identities
        SET
            provider_id = v_email,
            identity_data = jsonb_build_object(
                'sub', v_owner_user_id::text,
                'email', v_email,
                'email_verified', true
            ),
            updated_at = now()
        WHERE user_id = v_owner_user_id
          AND provider = 'email';

        IF NOT FOUND THEN
            INSERT INTO auth.identities (
                id,
                user_id,
                provider_id,
                identity_data,
                provider,
                last_sign_in_at,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                v_owner_user_id,
                v_email,
                jsonb_build_object(
                    'sub', v_owner_user_id::text,
                    'email', v_email,
                    'email_verified', true
                ),
                'email',
                now(),
                now(),
                now()
            );
        END IF;
    END IF;

    RETURN v_tenant_id;
END;
$_$;


ALTER FUNCTION "public"."superadmin_save_restaurant_with_owner"("p_tenant_id" "uuid", "p_restaurant_name" "text", "p_slug" "text", "p_email" "text", "p_phone" "text", "p_status" "text", "p_plan_id" "uuid", "p_password" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."superadmin_save_restaurant_with_owner"("p_tenant_id" "uuid", "p_restaurant_name" "text", "p_slug" "text", "p_email" "text", "p_phone" "text", "p_status" "text", "p_plan_id" "uuid", "p_password" "text") IS 'Cria ou atualiza tenant/restaurante, cria a assinatura inicial com ciclo financeiro e provisiona o usuário admin do tenant com login por email e senha.';



CREATE OR REPLACE FUNCTION "public"."sync_auth_user_email_to_profiles"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_email TEXT := lower(btrim(COALESCE(NEW.email, '')));
    v_tenant_id UUID;
BEGIN
    IF v_email = '' OR NEW.email IS NOT DISTINCT FROM OLD.email THEN
        RETURN NEW;
    END IF;

    UPDATE public.superadmin_users
    SET
        email = v_email,
        updated_at = now()
    WHERE id = NEW.id;

    UPDATE public.tenant_users
    SET
        email = v_email,
        updated_at = now()
    WHERE id = NEW.id;

    SELECT tenant_id
    INTO v_tenant_id
    FROM public.tenant_users
    WHERE id = NEW.id
      AND role = 'admin'
    LIMIT 1;

    IF v_tenant_id IS NOT NULL THEN
        UPDATE public.tenants
        SET
            email = v_email,
            updated_at = now()
        WHERE id = v_tenant_id;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_auth_user_email_to_profiles"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."business_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "day_of_week" "text" NOT NULL,
    "open_time" "text",
    "close_time" "text",
    "is_closed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."business_hours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category_modifier_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."category_modifier_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_regions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "fee" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."delivery_regions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_times" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "min_time" integer NOT NULL,
    "max_time" integer NOT NULL,
    "day_of_week" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."delivery_times" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."drivers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "vehicle" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."drivers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fractional_exclusions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "excluded_group_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."fractional_exclusions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_attributes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "addon_id" "uuid" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."group_attributes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modifier_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "min_options" integer DEFAULT 0 NOT NULL,
    "max_options" integer,
    "pricing_rule" character varying(50) DEFAULT 'sum'::character varying NOT NULL,
    "behavior_type" character varying(50) DEFAULT 'checkbox'::character varying NOT NULL,
    "max_per_item" integer DEFAULT 1 NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "check_behavior_type" CHECK ((("behavior_type")::"text" = ANY ((ARRAY['checkbox'::character varying, 'stepper'::character varying, 'fractional'::character varying])::"text"[]))),
    CONSTRAINT "check_max_options" CHECK ((("max_options" IS NULL) OR ("max_options" >= "min_options"))),
    CONSTRAINT "check_min_options" CHECK (("min_options" >= 0)),
    CONSTRAINT "check_pricing_rule" CHECK ((("pricing_rule")::"text" = ANY ((ARRAY['sum'::character varying, 'highest'::character varying, 'average'::character varying])::"text"[])))
);


ALTER TABLE "public"."modifier_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_item_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "addon_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "total_price" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_item_addons_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."order_item_addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "total_price" numeric(10,2) NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "number" "text",
    "customer_name" "text" NOT NULL,
    "customer_phone" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_method" "text" NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "subtotal" numeric(10,2) NOT NULL,
    "delivery_fee" numeric(10,2) DEFAULT 0 NOT NULL,
    "discount" numeric(10,2) DEFAULT 0 NOT NULL,
    "total" numeric(10,2) NOT NULL,
    "notes" "text",
    "order_type" "text" DEFAULT 'delivery'::"text" NOT NULL,
    "table_number" "text",
    "delivery_driver_id" "uuid",
    "delivery_status" "text",
    "delivery_address" "text",
    "delivery_region_id" "uuid",
    "delivery_started_at" timestamp with time zone,
    "delivery_completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "orders_order_type_check" CHECK (("order_type" = ANY (ARRAY['delivery'::"text", 'takeaway'::"text", 'instore'::"text"]))),
    CONSTRAINT "orders_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text"]))),
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'preparing'::"text", 'ready'::"text", 'out_for_delivery'::"text", 'delivered'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "enabled" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payment_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."plan_type" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "billing_days" integer NOT NULL,
    "description" "text",
    "features" "jsonb" DEFAULT '[]'::"jsonb",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


COMMENT ON TABLE "public"."plans" IS 'Planos de assinatura disponíveis';



CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "text",
    "description" "text",
    "is_secret" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_settings" IS 'Configurações globais da plataforma (Asaas, split, etc)';



CREATE TABLE IF NOT EXISTS "public"."product_addon_relations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "addon_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_addon_relations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_addon_selections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "addon_id" "uuid" NOT NULL,
    "type" character varying(50) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "product_addon_selections_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['extras'::character varying, 'sides'::character varying])::"text"[])))
);


ALTER TABLE "public"."product_addon_selections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) NOT NULL,
    "available" boolean DEFAULT true,
    "is_global" boolean DEFAULT false,
    "max_options" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "group_id" "uuid"
);


ALTER TABLE "public"."product_addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_modifier_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "min_options" integer DEFAULT 0 NOT NULL,
    "max_options" integer,
    "pricing_rule" character varying(50) DEFAULT 'sum'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "check_max_options" CHECK ((("max_options" IS NULL) OR ("max_options" >= "min_options"))),
    CONSTRAINT "check_min_options" CHECK (("min_options" >= 0)),
    CONSTRAINT "check_pricing_rule" CHECK ((("pricing_rule")::"text" = ANY ((ARRAY['sum'::character varying, 'highest'::character varying])::"text"[])))
);


ALTER TABLE "public"."product_modifier_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_variations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."product_variations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) NOT NULL,
    "image_url" "text",
    "category_id" "uuid",
    "available" boolean DEFAULT true,
    "featured" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "extras_group_id" "uuid",
    "sides_group_id" "uuid",
    "has_variations" boolean DEFAULT false,
    "display_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "description" "text",
    "address" "text",
    "logo_url" "text",
    "banner_url" "text",
    "open_time" time without time zone,
    "close_time" time without time zone,
    "delivery_fee" numeric(10,2) DEFAULT 0,
    "min_order_value" numeric(10,2) DEFAULT 0,
    "theme_settings" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."restaurants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."superadmin_users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "role" "public"."superadmin_role" DEFAULT 'superadmin'::"public"."superadmin_role",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."superadmin_users" OWNER TO "postgres";


COMMENT ON TABLE "public"."superadmin_users" IS 'Administradores da plataforma Delivery MAX';



CREATE TABLE IF NOT EXISTS "public"."system_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "tenant_id" "uuid",
    "action" "text" NOT NULL,
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."system_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_billing_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "plan_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "payment_method" "text",
    "asaas_payment_id" "text",
    "asaas_invoice_url" "text",
    "paid_at" timestamp with time zone,
    "due_date" timestamp with time zone,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "gateway_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "tenant_billing_history_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."tenant_billing_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_domains" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "status" "text" DEFAULT 'pending_dns'::"text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "vercel_domain_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tenant_domains_status_check" CHECK (("status" = ANY (ARRAY['pending_dns'::"text", 'active'::"text", 'error'::"text", 'pending_verification'::"text"])))
);


ALTER TABLE "public"."tenant_domains" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_email_dispatches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "recipient_email" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_key" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenant_email_dispatches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "allow_signup" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tenant_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "public"."subscription_status" DEFAULT 'trialing'::"public"."subscription_status",
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "asaas_subscription_id" "text",
    "asaas_payment_link" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "billing_type" "text"
);


ALTER TABLE "public"."tenant_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_users" (
    "id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "role" "public"."tenant_user_role" DEFAULT 'staff'::"public"."tenant_user_role",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tenant_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "status" "text" DEFAULT 'trialing'::"text",
    "plan_id" "uuid",
    "trial_ends_at" timestamp with time zone,
    "asaas_customer_id" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "full_name" "text",
    "cpf_cnpj" "text",
    "whatsapp" "text",
    "facebook_pixel_id" character varying(255),
    "google_tag_id" character varying(255),
    "marketing_enabled" boolean DEFAULT false,
    "driver_tracking_enabled" boolean DEFAULT false,
    CONSTRAINT "tenants_cpf_cnpj_format_check" CHECK ((("cpf_cnpj" IS NULL) OR ("cpf_cnpj" ~ '^(?:[0-9]{11}|[0-9]{14})$'::"text")))
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenants" IS 'Cada restaurante cadastrado é um tenant isolado';



ALTER TABLE ONLY "public"."business_hours"
    ADD CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_hours"
    ADD CONSTRAINT "business_hours_tenant_id_day_of_week_key" UNIQUE ("tenant_id", "day_of_week");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_modifier_groups"
    ADD CONSTRAINT "category_modifier_groups_category_id_group_id_key" UNIQUE ("category_id", "group_id");



ALTER TABLE ONLY "public"."category_modifier_groups"
    ADD CONSTRAINT "category_modifier_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_regions"
    ADD CONSTRAINT "delivery_regions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_times"
    ADD CONSTRAINT "delivery_times_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drivers"
    ADD CONSTRAINT "drivers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fractional_exclusions"
    ADD CONSTRAINT "fractional_exclusions_group_id_excluded_group_id_key" UNIQUE ("group_id", "excluded_group_id");



ALTER TABLE ONLY "public"."fractional_exclusions"
    ADD CONSTRAINT "fractional_exclusions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_attributes"
    ADD CONSTRAINT "group_attributes_group_id_addon_id_key" UNIQUE ("group_id", "addon_id");



ALTER TABLE ONLY "public"."group_attributes"
    ADD CONSTRAINT "group_attributes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modifier_groups"
    ADD CONSTRAINT "modifier_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_item_addons"
    ADD CONSTRAINT "order_item_addons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_type_key" UNIQUE ("type");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_addon_relations"
    ADD CONSTRAINT "product_addon_relations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_addon_relations"
    ADD CONSTRAINT "product_addon_relations_product_id_addon_id_key" UNIQUE ("product_id", "addon_id");



ALTER TABLE ONLY "public"."product_addon_selections"
    ADD CONSTRAINT "product_addon_selections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_addon_selections"
    ADD CONSTRAINT "product_addon_selections_product_id_addon_id_type_key" UNIQUE ("product_id", "addon_id", "type");



ALTER TABLE ONLY "public"."product_addons"
    ADD CONSTRAINT "product_addons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_modifier_groups"
    ADD CONSTRAINT "product_modifier_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_variations"
    ADD CONSTRAINT "product_variations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."superadmin_users"
    ADD CONSTRAINT "superadmin_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."superadmin_users"
    ADD CONSTRAINT "superadmin_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_logs"
    ADD CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_billing_history"
    ADD CONSTRAINT "tenant_billing_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_domains"
    ADD CONSTRAINT "tenant_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_email_dispatches"
    ADD CONSTRAINT "tenant_email_dispatches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_email_dispatches"
    ADD CONSTRAINT "tenant_email_dispatches_unique_event" UNIQUE ("tenant_id", "event_type", "event_key");



ALTER TABLE ONLY "public"."tenant_settings"
    ADD CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_settings"
    ADD CONSTRAINT "tenant_settings_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."tenant_subscriptions"
    ADD CONSTRAINT "tenant_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_tenant_id_email_key" UNIQUE ("tenant_id", "email");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."tenant_domains"
    ADD CONSTRAINT "uk_tenant_domain" UNIQUE ("domain");



CREATE INDEX "idx_business_hours_tenant_id" ON "public"."business_hours" USING "btree" ("tenant_id");



CREATE INDEX "idx_categories_tenant_id" ON "public"."categories" USING "btree" ("tenant_id");



CREATE INDEX "idx_category_modifier_groups_category" ON "public"."category_modifier_groups" USING "btree" ("category_id");



CREATE INDEX "idx_category_modifier_groups_group" ON "public"."category_modifier_groups" USING "btree" ("group_id");



CREATE INDEX "idx_category_modifier_groups_tenant_cat_group" ON "public"."category_modifier_groups" USING "btree" ("tenant_id", "category_id", "group_id");



CREATE INDEX "idx_delivery_regions_tenant_id" ON "public"."delivery_regions" USING "btree" ("tenant_id");



CREATE INDEX "idx_drivers_tenant_id" ON "public"."drivers" USING "btree" ("tenant_id");



CREATE INDEX "idx_fractional_exclusions_group" ON "public"."fractional_exclusions" USING "btree" ("group_id");



CREATE INDEX "idx_group_attributes_addon" ON "public"."group_attributes" USING "btree" ("addon_id");



CREATE INDEX "idx_group_attributes_group" ON "public"."group_attributes" USING "btree" ("group_id");



CREATE INDEX "idx_group_attributes_tenant_group_addon" ON "public"."group_attributes" USING "btree" ("tenant_id", "group_id", "addon_id");



CREATE INDEX "idx_modifier_groups_product_id" ON "public"."product_modifier_groups" USING "btree" ("product_id");



CREATE INDEX "idx_modifier_groups_tenant" ON "public"."modifier_groups" USING "btree" ("tenant_id");



CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_order_items_tenant_id" ON "public"."order_items" USING "btree" ("tenant_id");



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at");



CREATE INDEX "idx_orders_customer_phone" ON "public"."orders" USING "btree" ("customer_phone");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_orders_tenant_id" ON "public"."orders" USING "btree" ("tenant_id");



CREATE INDEX "idx_pas_tenant_product_addon" ON "public"."product_addon_selections" USING "btree" ("tenant_id", "product_id", "addon_id");



CREATE INDEX "idx_product_addon_rel_tenant_id" ON "public"."product_addon_relations" USING "btree" ("tenant_id");



CREATE INDEX "idx_product_addon_selections_product" ON "public"."product_addon_selections" USING "btree" ("product_id");



CREATE INDEX "idx_product_addons_group_id" ON "public"."product_addons" USING "btree" ("group_id");



CREATE INDEX "idx_product_addons_tenant_id" ON "public"."product_addons" USING "btree" ("tenant_id");



CREATE INDEX "idx_product_variations_product" ON "public"."product_variations" USING "btree" ("product_id");



CREATE INDEX "idx_product_variations_tenant_product" ON "public"."product_variations" USING "btree" ("tenant_id", "product_id");



CREATE INDEX "idx_products_available" ON "public"."products" USING "btree" ("available");



CREATE INDEX "idx_products_category" ON "public"."products" USING "btree" ("category_id");



CREATE INDEX "idx_products_display_order" ON "public"."products" USING "btree" ("tenant_id", "category_id", "display_order");



CREATE INDEX "idx_products_tenant_category_name" ON "public"."products" USING "btree" ("tenant_id", "category_id", "name");



CREATE INDEX "idx_products_tenant_id" ON "public"."products" USING "btree" ("tenant_id");



CREATE INDEX "idx_restaurants_tenant_id" ON "public"."restaurants" USING "btree" ("tenant_id");



CREATE INDEX "idx_system_logs_action" ON "public"."system_logs" USING "btree" ("action");



CREATE INDEX "idx_system_logs_created_at" ON "public"."system_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_system_logs_tenant_id" ON "public"."system_logs" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "idx_tenant_billing_history_tenant_payment_unique" ON "public"."tenant_billing_history" USING "btree" ("tenant_id", "asaas_payment_id") WHERE ("asaas_payment_id" IS NOT NULL);



CREATE INDEX "idx_tenant_billing_tenant_id" ON "public"."tenant_billing_history" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_domains_domain" ON "public"."tenant_domains" USING "btree" ("domain");



CREATE INDEX "idx_tenant_domains_tenant_id" ON "public"."tenant_domains" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_email_dispatches_event_type" ON "public"."tenant_email_dispatches" USING "btree" ("event_type");



CREATE INDEX "idx_tenant_email_dispatches_tenant_id" ON "public"."tenant_email_dispatches" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_subscriptions_tenant_id" ON "public"."tenant_subscriptions" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_users_email" ON "public"."tenant_users" USING "btree" ("email");



CREATE INDEX "idx_tenant_users_tenant_id" ON "public"."tenant_users" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenants_slug" ON "public"."tenants" USING "btree" ("slug");



CREATE INDEX "idx_tenants_status" ON "public"."tenants" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "generate_order_number_trigger" BEFORE INSERT ON "public"."orders" FOR EACH ROW WHEN (("new"."number" IS NULL)) EXECUTE FUNCTION "public"."generate_order_number"();



CREATE OR REPLACE TRIGGER "set_business_hours_updated_at" BEFORE UPDATE ON "public"."business_hours" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_categories_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_delivery_regions_updated_at" BEFORE UPDATE ON "public"."delivery_regions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_delivery_times_updated_at" BEFORE UPDATE ON "public"."delivery_times" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_drivers_updated_at" BEFORE UPDATE ON "public"."drivers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_payment_methods_updated_at" BEFORE UPDATE ON "public"."payment_methods" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_plans_updated_at" BEFORE UPDATE ON "public"."plans" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_platform_settings_updated_at" BEFORE UPDATE ON "public"."platform_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_product_addons_updated_at" BEFORE UPDATE ON "public"."product_addons" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_restaurants_updated_at" BEFORE UPDATE ON "public"."restaurants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_superadmin_users_updated_at" BEFORE UPDATE ON "public"."superadmin_users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_tenant_billing_updated_at" BEFORE UPDATE ON "public"."tenant_billing_history" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_tenant_settings_updated_at" BEFORE UPDATE ON "public"."tenant_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_tenant_subscriptions_updated_at" BEFORE UPDATE ON "public"."tenant_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_tenant_users_updated_at" BEFORE UPDATE ON "public"."tenant_users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_tenants_updated_at" BEFORE UPDATE ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_tenant_domains" BEFORE UPDATE ON "public"."tenant_domains" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at_tenant_domains"();



ALTER TABLE ONLY "public"."business_hours"
    ADD CONSTRAINT "business_hours_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_modifier_groups"
    ADD CONSTRAINT "category_modifier_groups_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_modifier_groups"
    ADD CONSTRAINT "category_modifier_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_modifier_groups"
    ADD CONSTRAINT "category_modifier_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_regions"
    ADD CONSTRAINT "delivery_regions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_times"
    ADD CONSTRAINT "delivery_times_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."drivers"
    ADD CONSTRAINT "drivers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fractional_exclusions"
    ADD CONSTRAINT "fractional_exclusions_excluded_group_id_fkey" FOREIGN KEY ("excluded_group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fractional_exclusions"
    ADD CONSTRAINT "fractional_exclusions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fractional_exclusions"
    ADD CONSTRAINT "fractional_exclusions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_attributes"
    ADD CONSTRAINT "group_attributes_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "public"."product_addons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_attributes"
    ADD CONSTRAINT "group_attributes_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_attributes"
    ADD CONSTRAINT "group_attributes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."modifier_groups"
    ADD CONSTRAINT "modifier_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_item_addons"
    ADD CONSTRAINT "order_item_addons_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "public"."product_addons"("id");



ALTER TABLE ONLY "public"."order_item_addons"
    ADD CONSTRAINT "order_item_addons_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_item_addons"
    ADD CONSTRAINT "order_item_addons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_delivery_driver_id_fkey" FOREIGN KEY ("delivery_driver_id") REFERENCES "public"."drivers"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_delivery_region_id_fkey" FOREIGN KEY ("delivery_region_id") REFERENCES "public"."delivery_regions"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_addon_relations"
    ADD CONSTRAINT "product_addon_relations_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "public"."product_addons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_addon_relations"
    ADD CONSTRAINT "product_addon_relations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_addon_relations"
    ADD CONSTRAINT "product_addon_relations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_addon_selections"
    ADD CONSTRAINT "product_addon_selections_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "public"."product_addons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_addon_selections"
    ADD CONSTRAINT "product_addon_selections_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_addon_selections"
    ADD CONSTRAINT "product_addon_selections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_addons"
    ADD CONSTRAINT "product_addons_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."product_modifier_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_addons"
    ADD CONSTRAINT "product_addons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_modifier_groups"
    ADD CONSTRAINT "product_modifier_groups_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_modifier_groups"
    ADD CONSTRAINT "product_modifier_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_variations"
    ADD CONSTRAINT "product_variations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_variations"
    ADD CONSTRAINT "product_variations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_extras_group_id_fkey" FOREIGN KEY ("extras_group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_sides_group_id_fkey" FOREIGN KEY ("sides_group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."superadmin_users"
    ADD CONSTRAINT "superadmin_users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_logs"
    ADD CONSTRAINT "system_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."system_logs"
    ADD CONSTRAINT "system_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tenant_billing_history"
    ADD CONSTRAINT "tenant_billing_history_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id");



ALTER TABLE ONLY "public"."tenant_billing_history"
    ADD CONSTRAINT "tenant_billing_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_domains"
    ADD CONSTRAINT "tenant_domains_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_email_dispatches"
    ADD CONSTRAINT "tenant_email_dispatches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_settings"
    ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_subscriptions"
    ADD CONSTRAINT "tenant_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id");



ALTER TABLE ONLY "public"."tenant_subscriptions"
    ADD CONSTRAINT "tenant_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id");



CREATE POLICY "Anyone can insert system logs" ON "public"."system_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Leitura pública flexível de tenants" ON "public"."tenants" FOR SELECT USING (("status" = ANY (ARRAY['active'::"text", 'trialing'::"text", 'in_review'::"text"])));



CREATE POLICY "Permitir leitura pública de categorias" ON "public"."categories" FOR SELECT USING (true);



CREATE POLICY "Permitir leitura pública de produtos" ON "public"."products" FOR SELECT USING (true);



CREATE POLICY "Public read access for domain resolution" ON "public"."tenant_domains" FOR SELECT USING (true);



CREATE POLICY "Public: Criar pedido" ON "public"."orders" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public: Ler regiões" ON "public"."delivery_regions" FOR SELECT USING (true);



CREATE POLICY "Public: Rastrear pedido" ON "public"."orders" FOR SELECT USING (("auth"."uid"() IS NULL));



CREATE POLICY "Resolução pública de domínios" ON "public"."tenant_domains" FOR SELECT USING (true);



CREATE POLICY "Superadmin: Todas as operações" ON "public"."orders" USING ((EXISTS ( SELECT 1
   FROM "public"."superadmin_users"
  WHERE ("superadmin_users"."id" = "auth"."uid"()))));



CREATE POLICY "Superadmin: Todas as operações (drivers)" ON "public"."drivers" USING ((EXISTS ( SELECT 1
   FROM "public"."superadmin_users"
  WHERE ("superadmin_users"."id" = "auth"."uid"()))));



CREATE POLICY "Superadmin: Todas as operações (regions)" ON "public"."delivery_regions" USING ((EXISTS ( SELECT 1
   FROM "public"."superadmin_users"
  WHERE ("superadmin_users"."id" = "auth"."uid"()))));



CREATE POLICY "Superadmins can view all system logs" ON "public"."system_logs" FOR SELECT USING ("public"."is_superadmin"());



CREATE POLICY "Tenant can manage category_modifier_groups" ON "public"."category_modifier_groups" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "Tenant can manage fractional_exclusions" ON "public"."fractional_exclusions" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "Tenant can manage group_attributes" ON "public"."group_attributes" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "Tenant can manage modifier_groups" ON "public"."modifier_groups" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "Tenant can manage product_addon_selections" ON "public"."product_addon_selections" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "Tenant can manage product_modifier_groups" ON "public"."product_modifier_groups" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "Tenant can manage product_variations" ON "public"."product_variations" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "Tenant: Gerenciar próprias regiões" ON "public"."delivery_regions" USING ((EXISTS ( SELECT 1
   FROM "public"."tenant_users"
  WHERE (("tenant_users"."id" = "auth"."uid"()) AND ("tenant_users"."tenant_id" = "delivery_regions"."tenant_id") AND ("tenant_users"."active" = true)))));



CREATE POLICY "Tenant: Gerenciar próprios entregadores" ON "public"."drivers" USING ((EXISTS ( SELECT 1
   FROM "public"."tenant_users"
  WHERE (("tenant_users"."id" = "auth"."uid"()) AND ("tenant_users"."tenant_id" = "drivers"."tenant_id") AND ("tenant_users"."active" = true)))));



CREATE POLICY "Tenant: Gerenciar próprios pedidos" ON "public"."orders" USING ((EXISTS ( SELECT 1
   FROM "public"."tenant_users"
  WHERE (("tenant_users"."id" = "auth"."uid"()) AND ("tenant_users"."tenant_id" = "orders"."tenant_id") AND ("tenant_users"."active" = true)))));



CREATE POLICY "Users can delete domains for their tenants" ON "public"."tenant_domains" FOR DELETE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert domains for their tenants" ON "public"."tenant_domains" FOR INSERT WITH CHECK (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update domains for their tenants" ON "public"."tenant_domains" FOR UPDATE USING (("tenant_id" IN ( SELECT "tenant_users"."tenant_id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."id" = "auth"."uid"()))));



ALTER TABLE "public"."business_hours" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_hours_public_read" ON "public"."business_hours" FOR SELECT USING (true);



CREATE POLICY "business_hours_public_read_v2" ON "public"."business_hours" FOR SELECT TO "anon" USING (true);



CREATE POLICY "business_hours_tenant_delete" ON "public"."business_hours" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "business_hours_tenant_insert" ON "public"."business_hours" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "business_hours_tenant_select" ON "public"."business_hours" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "business_hours_tenant_update" ON "public"."business_hours" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"())) WITH CHECK (("tenant_id" = "public"."get_my_tenant_id"()));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_public_read_v2" ON "public"."categories" FOR SELECT TO "anon" USING (true);



CREATE POLICY "categories_tenant_delete" ON "public"."categories" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "categories_tenant_insert" ON "public"."categories" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "categories_tenant_select" ON "public"."categories" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "categories_tenant_update" ON "public"."categories" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"())) WITH CHECK (("tenant_id" = "public"."get_my_tenant_id"()));



ALTER TABLE "public"."category_modifier_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delivery_regions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delivery_times" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delivery_times_public_read" ON "public"."delivery_times" FOR SELECT USING (true);



CREATE POLICY "delivery_times_tenant_delete" ON "public"."delivery_times" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "delivery_times_tenant_insert" ON "public"."delivery_times" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "delivery_times_tenant_select" ON "public"."delivery_times" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "delivery_times_tenant_update" ON "public"."delivery_times" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"())) WITH CHECK (("tenant_id" = "public"."get_my_tenant_id"()));



ALTER TABLE "public"."drivers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fractional_exclusions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_attributes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."modifier_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_item_addons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_item_addons_own_tenant" ON "public"."order_item_addons" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "order_item_addons_public_insert" ON "public"."order_item_addons" FOR INSERT TO "anon" WITH CHECK ((("tenant_id" IS NOT NULL) AND "public"."can_insert_public_order_item_addon"("order_item_id", "addon_id", "tenant_id")));



CREATE POLICY "order_item_addons_superadmin" ON "public"."order_item_addons" USING ("public"."is_superadmin"());



ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_items_own_tenant" ON "public"."order_items" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "order_items_public_insert" ON "public"."order_items" FOR INSERT TO "anon" WITH CHECK ((("tenant_id" IS NOT NULL) AND "public"."can_insert_public_order_item"("order_id", "product_id", "tenant_id")));



CREATE POLICY "order_items_superadmin" ON "public"."order_items" USING ("public"."is_superadmin"());



ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_methods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_methods_public_read" ON "public"."payment_methods" FOR SELECT TO "anon" USING (("enabled" = true));



CREATE POLICY "payment_methods_tenant_delete" ON "public"."payment_methods" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "payment_methods_tenant_insert" ON "public"."payment_methods" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "payment_methods_tenant_select" ON "public"."payment_methods" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "payment_methods_tenant_update" ON "public"."payment_methods" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"())) WITH CHECK (("tenant_id" = "public"."get_my_tenant_id"()));



ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plans_all_superadmin" ON "public"."plans" USING ("public"."is_superadmin"());



CREATE POLICY "plans_select_public" ON "public"."plans" FOR SELECT USING (("active" = true));



ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_settings_delete_superadmin" ON "public"."platform_settings" FOR DELETE TO "authenticated" USING ("public"."is_superadmin"());



CREATE POLICY "platform_settings_insert_superadmin" ON "public"."platform_settings" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "platform_settings_select_superadmin" ON "public"."platform_settings" FOR SELECT TO "authenticated" USING ("public"."is_superadmin"());



CREATE POLICY "platform_settings_update_superadmin" ON "public"."platform_settings" FOR UPDATE TO "authenticated" USING ("public"."is_superadmin"()) WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "product_addon_rel_tenant_delete" ON "public"."product_addon_relations" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "product_addon_rel_tenant_insert" ON "public"."product_addon_relations" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "product_addon_rel_tenant_select" ON "public"."product_addon_relations" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "product_addon_rel_tenant_update" ON "public"."product_addon_relations" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"())) WITH CHECK (("tenant_id" = "public"."get_my_tenant_id"()));



ALTER TABLE "public"."product_addon_relations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_addon_selections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_addons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_addons_tenant_delete" ON "public"."product_addons" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "product_addons_tenant_insert" ON "public"."product_addons" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "product_addons_tenant_select" ON "public"."product_addons" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "product_addons_tenant_update" ON "public"."product_addons" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"())) WITH CHECK (("tenant_id" = "public"."get_my_tenant_id"()));



ALTER TABLE "public"."product_modifier_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_variations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_public_read_v2" ON "public"."products" FOR SELECT TO "anon" USING (true);



CREATE POLICY "products_tenant_delete" ON "public"."products" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "products_tenant_insert" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "products_tenant_select" ON "public"."products" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "products_tenant_update" ON "public"."products" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"())) WITH CHECK (("tenant_id" = "public"."get_my_tenant_id"()));



ALTER TABLE "public"."restaurants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "restaurants_public_read" ON "public"."restaurants" FOR SELECT USING (true);



CREATE POLICY "restaurants_public_read_v2" ON "public"."restaurants" FOR SELECT TO "anon" USING (true);



CREATE POLICY "restaurants_tenant_delete" ON "public"."restaurants" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "restaurants_tenant_insert" ON "public"."restaurants" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "restaurants_tenant_select" ON "public"."restaurants" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "restaurants_tenant_update" ON "public"."restaurants" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."get_my_tenant_id"())) WITH CHECK (("tenant_id" = "public"."get_my_tenant_id"()));



ALTER TABLE "public"."superadmin_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "superadmin_users_delete" ON "public"."superadmin_users" FOR DELETE USING ("public"."is_superadmin"());



CREATE POLICY "superadmin_users_insert" ON "public"."superadmin_users" FOR INSERT WITH CHECK ("public"."is_superadmin"());



CREATE POLICY "superadmin_users_select_own" ON "public"."superadmin_users" FOR SELECT USING ((("id" = "auth"."uid"()) OR "public"."is_superadmin"()));



CREATE POLICY "superadmin_users_update" ON "public"."superadmin_users" FOR UPDATE USING ("public"."is_superadmin"());



ALTER TABLE "public"."system_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_billing_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_billing_own_select" ON "public"."tenant_billing_history" FOR SELECT USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "tenant_billing_superadmin" ON "public"."tenant_billing_history" USING ("public"."is_superadmin"());



ALTER TABLE "public"."tenant_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_email_dispatches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_email_dispatches_superadmin_select" ON "public"."tenant_email_dispatches" FOR SELECT TO "authenticated" USING ("public"."is_superadmin"());



ALTER TABLE "public"."tenant_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_settings_own" ON "public"."tenant_settings" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "tenant_settings_superadmin" ON "public"."tenant_settings" USING ("public"."is_superadmin"());



CREATE POLICY "tenant_sub_own_select" ON "public"."tenant_subscriptions" FOR SELECT USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "tenant_sub_superadmin" ON "public"."tenant_subscriptions" USING ("public"."is_superadmin"());



ALTER TABLE "public"."tenant_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_subscriptions_public_read" ON "public"."tenant_subscriptions" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."tenant_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_users_own_tenant" ON "public"."tenant_users" USING (("tenant_id" = "public"."get_my_tenant_id"()));



CREATE POLICY "tenant_users_superadmin" ON "public"."tenant_users" USING ("public"."is_superadmin"());



ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenants_own_select" ON "public"."tenants" FOR SELECT USING (("id" = "public"."get_my_tenant_id"()));



CREATE POLICY "tenants_own_update" ON "public"."tenants" FOR UPDATE USING (("id" = "public"."get_my_tenant_id"())) WITH CHECK (("id" = "public"."get_my_tenant_id"()));



CREATE POLICY "tenants_public_read" ON "public"."tenants" FOR SELECT TO "anon" USING (true);



CREATE POLICY "tenants_superadmin_all" ON "public"."tenants" USING ("public"."is_superadmin"());





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


































































































































































REVOKE ALL ON FUNCTION "public"."can_insert_public_order_item"("p_order_id" "uuid", "p_product_id" "uuid", "p_tenant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_insert_public_order_item"("p_order_id" "uuid", "p_product_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_insert_public_order_item"("p_order_id" "uuid", "p_product_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_insert_public_order_item"("p_order_id" "uuid", "p_product_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_insert_public_order_item_addon"("p_order_item_id" "uuid", "p_addon_id" "uuid", "p_tenant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_insert_public_order_item_addon"("p_order_item_id" "uuid", "p_addon_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_insert_public_order_item_addon"("p_order_item_id" "uuid", "p_addon_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_insert_public_order_item_addon"("p_order_item_id" "uuid", "p_addon_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_public_signup_account"("p_user_id" "uuid", "p_email" "text", "p_full_name" "text", "p_store_name" "text", "p_cpf_cnpj" "text", "p_whatsapp" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_public_signup_account"("p_user_id" "uuid", "p_email" "text", "p_full_name" "text", "p_store_name" "text", "p_cpf_cnpj" "text", "p_whatsapp" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_public_signup_account"("p_user_id" "uuid", "p_email" "text", "p_full_name" "text", "p_store_name" "text", "p_cpf_cnpj" "text", "p_whatsapp" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_product_addon_relations"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_addon_relations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_addon_relations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_product_addons"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_addons"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_addons"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_product_addons_by_product"("product_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_addons_by_product"("product_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_addons_by_product"("product_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_product_by_id"("p_product_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_by_id"("p_product_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_by_id"("p_product_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_product_full"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_full"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_full"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_product_full_by_tenant"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_full_by_tenant"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_full_by_tenant"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_product_full_internal"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_full_internal"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_full_internal"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_public_signup"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_public_signup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_public_signup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at_tenant_domains"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at_tenant_domains"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at_tenant_domains"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."repair_my_public_signup_account"("p_full_name" "text", "p_store_name" "text", "p_cpf_cnpj" "text", "p_whatsapp" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."repair_my_public_signup_account"("p_full_name" "text", "p_store_name" "text", "p_cpf_cnpj" "text", "p_whatsapp" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."repair_my_public_signup_account"("p_full_name" "text", "p_store_name" "text", "p_cpf_cnpj" "text", "p_whatsapp" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_tenant_domain"("p_domain" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_tenant_domain"("p_domain" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_tenant_domain"("p_domain" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."slugify_tenant_name"("value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slugify_tenant_name"("value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slugify_tenant_name"("value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."superadmin_renew_tenant"("p_tenant_id" "uuid", "p_plan_id" "uuid", "p_new_end_date" timestamp with time zone, "p_price" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."superadmin_renew_tenant"("p_tenant_id" "uuid", "p_plan_id" "uuid", "p_new_end_date" timestamp with time zone, "p_price" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."superadmin_renew_tenant"("p_tenant_id" "uuid", "p_plan_id" "uuid", "p_new_end_date" timestamp with time zone, "p_price" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."superadmin_save_restaurant_with_owner"("p_tenant_id" "uuid", "p_restaurant_name" "text", "p_slug" "text", "p_email" "text", "p_phone" "text", "p_status" "text", "p_plan_id" "uuid", "p_password" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."superadmin_save_restaurant_with_owner"("p_tenant_id" "uuid", "p_restaurant_name" "text", "p_slug" "text", "p_email" "text", "p_phone" "text", "p_status" "text", "p_plan_id" "uuid", "p_password" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."superadmin_save_restaurant_with_owner"("p_tenant_id" "uuid", "p_restaurant_name" "text", "p_slug" "text", "p_email" "text", "p_phone" "text", "p_status" "text", "p_plan_id" "uuid", "p_password" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_auth_user_email_to_profiles"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_auth_user_email_to_profiles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_auth_user_email_to_profiles"() TO "service_role";


















GRANT ALL ON TABLE "public"."business_hours" TO "anon";
GRANT ALL ON TABLE "public"."business_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."business_hours" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."category_modifier_groups" TO "anon";
GRANT ALL ON TABLE "public"."category_modifier_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."category_modifier_groups" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_regions" TO "anon";
GRANT ALL ON TABLE "public"."delivery_regions" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_regions" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_times" TO "anon";
GRANT ALL ON TABLE "public"."delivery_times" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_times" TO "service_role";



GRANT ALL ON TABLE "public"."drivers" TO "anon";
GRANT ALL ON TABLE "public"."drivers" TO "authenticated";
GRANT ALL ON TABLE "public"."drivers" TO "service_role";



GRANT ALL ON TABLE "public"."fractional_exclusions" TO "anon";
GRANT ALL ON TABLE "public"."fractional_exclusions" TO "authenticated";
GRANT ALL ON TABLE "public"."fractional_exclusions" TO "service_role";



GRANT ALL ON TABLE "public"."group_attributes" TO "anon";
GRANT ALL ON TABLE "public"."group_attributes" TO "authenticated";
GRANT ALL ON TABLE "public"."group_attributes" TO "service_role";



GRANT ALL ON TABLE "public"."modifier_groups" TO "anon";
GRANT ALL ON TABLE "public"."modifier_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."modifier_groups" TO "service_role";



GRANT ALL ON TABLE "public"."order_item_addons" TO "anon";
GRANT ALL ON TABLE "public"."order_item_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."order_item_addons" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_methods" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."product_addon_relations" TO "anon";
GRANT ALL ON TABLE "public"."product_addon_relations" TO "authenticated";
GRANT ALL ON TABLE "public"."product_addon_relations" TO "service_role";



GRANT ALL ON TABLE "public"."product_addon_selections" TO "anon";
GRANT ALL ON TABLE "public"."product_addon_selections" TO "authenticated";
GRANT ALL ON TABLE "public"."product_addon_selections" TO "service_role";



GRANT ALL ON TABLE "public"."product_addons" TO "anon";
GRANT ALL ON TABLE "public"."product_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."product_addons" TO "service_role";



GRANT ALL ON TABLE "public"."product_modifier_groups" TO "anon";
GRANT ALL ON TABLE "public"."product_modifier_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."product_modifier_groups" TO "service_role";



GRANT ALL ON TABLE "public"."product_variations" TO "anon";
GRANT ALL ON TABLE "public"."product_variations" TO "authenticated";
GRANT ALL ON TABLE "public"."product_variations" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."restaurants" TO "anon";
GRANT ALL ON TABLE "public"."restaurants" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurants" TO "service_role";



GRANT ALL ON TABLE "public"."superadmin_users" TO "anon";
GRANT ALL ON TABLE "public"."superadmin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."superadmin_users" TO "service_role";



GRANT ALL ON TABLE "public"."system_logs" TO "anon";
GRANT ALL ON TABLE "public"."system_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."system_logs" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_billing_history" TO "anon";
GRANT ALL ON TABLE "public"."tenant_billing_history" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_billing_history" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_domains" TO "anon";
GRANT ALL ON TABLE "public"."tenant_domains" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_domains" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_email_dispatches" TO "anon";
GRANT ALL ON TABLE "public"."tenant_email_dispatches" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_email_dispatches" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_settings" TO "anon";
GRANT ALL ON TABLE "public"."tenant_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_settings" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."tenant_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_users" TO "anon";
GRANT ALL ON TABLE "public"."tenant_users" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_users" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































