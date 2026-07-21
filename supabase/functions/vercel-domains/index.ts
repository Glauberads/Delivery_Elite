import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VercelDomainRequest {
  action: 'add' | 'remove' | 'verify';
  domain: string;
  tenant_id: string;
}

const VERCEL_API_URL = "https://api.vercel.com/v9/projects";
const VERCEL_PROJECT_ID = Deno.env.get("VERCEL_PROJECT_ID");
const VERCEL_TEAM_ID = Deno.env.get("VERCEL_TEAM_ID"); // Opcional, se o projeto estiver em um Team
const VERCEL_TOKEN = Deno.env.get("VERCEL_TOKEN");

function normalizeDomain(domain: string): string {
  try {
    let cleanDomain = domain.trim().toLowerCase();
    
    // Remove protocol Se houver
    if (cleanDomain.startsWith('http://')) {
      cleanDomain = cleanDomain.replace('http://', '');
    }
    if (cleanDomain.startsWith('https://')) {
      cleanDomain = cleanDomain.replace('https://', '');
    }
    
    // Remove port, paths and queries
    cleanDomain = cleanDomain.split('/')[0].split(':')[0].split('?')[0];
    
    // Remove www.
    if (cleanDomain.startsWith('www.')) {
      cleanDomain = cleanDomain.substring(4);
    }
    
    return cleanDomain;
  } catch (error) {
    throw new Error('Formato de domínio inválido');
  }
}

async function callVercelAPI(path: string, method: string, body?: any) {
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    throw new Error('Variáveis de ambiente da Vercel não configuradas na Edge Function.');
  }

  let url = `${VERCEL_API_URL}/${VERCEL_PROJECT_ID}/${path}`;
  if (VERCEL_TEAM_ID) {
    url += `?teamId=${VERCEL_TEAM_ID}`;
  }

  const response = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.error(`Erro na Vercel API (${method} ${path}):`, data);
    throw new Error(data?.error?.message || `Vercel API error: ${response.status}`);
  }

  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Validação de autenticação
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const body: VercelDomainRequest = await req.json();
    const { action, domain, tenant_id } = body;

    if (!domain || !tenant_id) {
      throw new Error("Domínio e tenant_id são obrigatórios");
    }

    // O RLS já previne acesso indevido no banco, mas podemos validar aqui também
    // checando se o usuário pertence ao tenant
    const { data: tenantAccess, error: accessError } = await supabaseClient
      .from('tenant_users')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('id', user.id)
      .single();

    if (accessError || !tenantAccess) {
      throw new Error("Você não tem permissão para modificar domínios deste restaurante.");
    }

    const normalizedDomain = normalizeDomain(domain);
    
    // Lista de proteção contra cadastro de domínios oficiais
    const forbiddenDomains = ['app.vipdelivery.com.br', 'api.vipdelivery.com.br', 'vipdelivery.com.br', 'vercel.app', 'localhost'];
    if (forbiddenDomains.some(f => normalizedDomain.includes(f))) {
      throw new Error("Não é possível usar domínios reservados da plataforma.");
    }

    // Instância removida pois não era utilizada e a falta da Service Role Key causava erro

    if (action === 'add') {
      // 1. Cadastra na Vercel
      console.log(`Adicionando domínio ${normalizedDomain} na Vercel...`);
      const vercelRes = await callVercelAPI('domains', 'POST', { name: normalizedDomain });
      
      // 2. Tenta adicionar também o www. e redirecionar
      try {
        await callVercelAPI('domains', 'POST', { name: `www.${normalizedDomain}` });
      } catch (e) {
        console.warn(`Aviso: Falha ao tentar adicionar o www.${normalizedDomain}`, e);
      }

      // 3. Cadastra/Atualiza no Supabase
      const { data: savedDomain, error: dbError } = await supabaseClient
        .from('tenant_domains')
        .insert({
          tenant_id,
          domain: normalizedDomain,
          status: 'pending_dns',
        })
        .select()
        .single();

      if (dbError) {
        // Se já existe, apenas retornamos erro pro frontend tratar
        if (dbError.code === '23505') { // unique_violation
           throw new Error("Este domínio já está cadastrado.");
        }
        throw dbError;
      }

      return new Response(JSON.stringify({ success: true, domain: savedDomain }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === 'remove') {
      // 1. Remove da Vercel
      console.log(`Removendo domínio ${normalizedDomain} da Vercel...`);
      try {
        await callVercelAPI(`domains/${normalizedDomain}`, 'DELETE');
        await callVercelAPI(`domains/www.${normalizedDomain}`, 'DELETE');
      } catch (e) {
        console.error("Erro ignorado ao remover da Vercel:", e);
      }

      // 2. Remove do Supabase
      const { error: dbError } = await supabaseClient
        .from('tenant_domains')
        .delete()
        .eq('domain', normalizedDomain)
        .eq('tenant_id', tenant_id); // Garantia extra pelo RLS

      if (dbError) throw dbError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === 'verify') {
      // 1. Consulta o status na Vercel
      console.log(`Verificando domínio ${normalizedDomain} na Vercel...`);
      const vercelConfig = await callVercelAPI(`domains/${normalizedDomain}/config`, 'GET');
      const vercelVerify = await callVercelAPI(`domains/${normalizedDomain}/verify`, 'POST');

      let newStatus = 'pending_dns';
      if (vercelConfig?.misconfigured === false && vercelVerify?.verified === true) {
        newStatus = 'active';
      }

      // 2. Atualiza no Supabase
      const { data: updatedDomain, error: dbError } = await supabaseClient
        .from('tenant_domains')
        .update({ status: newStatus })
        .eq('domain', normalizedDomain)
        .eq('tenant_id', tenant_id)
        .select()
        .single();

      if (dbError) throw dbError;

      return new Response(JSON.stringify({ success: true, domain: updatedDomain, vercel_config: vercelConfig }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Ação inválida");

  } catch (error) {
    console.error("Erro na Edge Function vercel-domains:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
