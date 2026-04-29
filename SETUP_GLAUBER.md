# Setup rapido para novo dono

## 1) Criar projeto no Supabase

1. Crie um novo projeto no Supabase.
2. Copie:
   - `Project URL`
   - `anon public key`
   - `project ref` (parte do dominio, ex.: `abcd1234`)
   - `service_role key` (Settings > API)

## 2) Configurar ambiente web

1. Copie `.env.example` para `.env`.
2. Preencha:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## 3) Vincular Supabase CLI ao novo projeto

1. Instale o CLI: `npm i -g supabase`
2. Login: `supabase login`
3. No `supabase/config.toml`, troque `project_id` por seu `project ref`.
4. Link do projeto: `supabase link --project-ref SEU_PROJECT_REF`

## 4) Rodar migrations

1. `supabase db push`

## 5) Configurar secrets e deploy das functions

1. Defina secrets:
   - `supabase secrets set SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co`
   - `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY`
2. Deploy de todas as functions:
   - `supabase functions deploy --all`

## 6) Configurar Asaas no painel Superadmin

1. Entre no sistema como superadmin.
2. Abra Integracoes.
3. Preencha e salve:
   - Ambiente (`sandbox` ou `production`)
   - `asaas_api_key`
   - `asaas_webhook_token`
4. Configure o webhook no Asaas apontando para:
   - `https://SEU_PROJECT_REF.supabase.co/functions/v1/asaas-webhook`
5. Envie o token no header `asaas-access-token` com o mesmo valor salvo em `asaas_webhook_token`.
