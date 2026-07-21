import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Home from "@/pages/Home";
import Index from "@/pages/Index";
import { Loader2 } from "lucide-react";

export function DomainResolver() {
  const [loading, setLoading] = useState(true);
  const [resolvedSlug, setResolvedSlug] = useState<string | null>(null);
  const [isOfficialDomain, setIsOfficialDomain] = useState(false);
  const [errorStatus, setErrorStatus] = useState<'not_found' | 'pending_dns' | null>(null);

  useEffect(() => {
    async function resolveDomain() {
      const hostname = window.location.hostname;
      
      // 1. Identificar se é domínio oficial, localhost ou Vercel preview
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
      const isOfficial = hostname.includes('vipdelivery.com.br');
      const isVercelApp = hostname.endsWith('.vercel.app');

      if (isLocal || isOfficial || isVercelApp) {
        setIsOfficialDomain(true);
        setLoading(false);
        return;
      }

      // 2. É um domínio personalizado. Vamos buscar no Supabase.
      try {
        const cleanDomain = hostname.replace(/^www\./, '');
        
        const { data, error } = await supabase.rpc('resolve_tenant_domain', { 
          p_domain: cleanDomain 
        });

        if (error) {
          console.error("Erro ao resolver domínio:", error);
          setErrorStatus('not_found');
          setLoading(false);
          return;
        }

        if (!data || data.length === 0) {
          setErrorStatus('not_found');
        } else {
          const domainInfo = data[0];
          
          if (domainInfo.domain_status === 'active') {
            setResolvedSlug(domainInfo.tenant_slug);
          } else {
            setErrorStatus('pending_dns');
          }
        }
      } catch (err) {
        console.error("Exceção na resolução de domínio:", err);
        setErrorStatus('not_found');
      } finally {
        setLoading(false);
      }
    }

    resolveDomain();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  // Se o domínio for o da plataforma, renderiza a Landing Page original
  if (isOfficialDomain) {
    return <Index />;
  }

  // Se o domínio personalizado está ativo, injeta o slug na URL virtual e carrega a loja
  if (resolvedSlug) {
    // Nós não usamos React Router Navigate aqui para não mudar a URL do navegador.
    // Simplesmente renderizamos a página Home, e precisamos avisar o usePublicTenant
    // ou quem quer que precise do slug. Como Home usa useParams<{slug}>, 
    // precisaremos passar o slug como prop ou usar o history/MemoryRouter internamente,
    // ou melhor: exportamos uma Home que aceita prop.
    return <Home overrideSlug={resolvedSlug} />;
  }

  // Telas de erro específicas para Custom Domains
  if (errorStatus === 'pending_dns') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Domínio em Propagação</h1>
        <p className="text-zinc-400 max-w-md">
          Este domínio foi registrado, mas o DNS ainda está propagando ou pendente de verificação. 
          Aguarde alguns minutos e tente novamente.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">Loja não encontrada</h1>
      <p className="text-zinc-400 max-w-md">
        Nenhum restaurante está vinculado a este endereço no momento.
      </p>
    </div>
  );
}
