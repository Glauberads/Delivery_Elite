import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, Trash2, CheckCircle2, AlertCircle, Clock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface CustomDomain {
  id: string;
  domain: string;
  status: string;
  created_at: string;
}

export function CustomDomainManager({ tenantId }: { tenantId: string }) {
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetchDomains();
  }, [tenantId]);

  const fetchDomains = async () => {
    try {
      setIsFetching(true);
      const { data, error } = await supabase
        .from('tenant_domains')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDomains(data || []);
    } catch (error) {
      console.error("Erro ao carregar domínios:", error);
      toast.error("Não foi possível carregar os domínios.");
    } finally {
      setIsFetching(false);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) {
      toast.error("Digite um domínio válido");
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('vercel-domains', {
        body: { action: 'add', domain: newDomain, tenant_id: tenantId }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success("Domínio adicionado com sucesso!");
      setNewDomain("");
      fetchDomains();
    } catch (error: any) {
      console.error("Erro ao adicionar domínio:", error);
      toast.error(error.message || "Erro ao adicionar domínio. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveDomain = async (domainName: string) => {
    if (!confirm(`Tem certeza que deseja remover o domínio ${domainName}? O seu site deixará de abrir por ele imediatamente.`)) {
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('vercel-domains', {
        body: { action: 'remove', domain: domainName, tenant_id: tenantId }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success("Domínio removido com sucesso!");
      fetchDomains();
    } catch (error: any) {
      console.error("Erro ao remover domínio:", error);
      toast.error(error.message || "Erro ao remover domínio.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyDomain = async (domainName: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('vercel-domains', {
        body: { action: 'verify', domain: domainName, tenant_id: tenantId }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success("Status atualizado!");
      fetchDomains();
    } catch (error: any) {
      console.error("Erro ao verificar domínio:", error);
      toast.error(error.message || "Erro ao verificar domínio.");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Ativo</Badge>;
      case 'pending_dns':
      case 'pending_verification':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600"><Clock className="w-3 h-3 mr-1" /> Propagando DNS</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Erro no DNS</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2 text-zinc-100">
          <Globe className="w-5 h-5 text-brand-primary" />
          Domínio Próprio
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Conecte o seu site (ex: www.seurestaurante.com.br) para abrir a sua loja digital.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-3">
          <Input 
            placeholder="ex: seurestaurante.com.br" 
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            disabled={isLoading}
            className="bg-zinc-950 border-zinc-800"
          />
          <Button onClick={handleAddDomain} disabled={isLoading || !newDomain.trim()}>
            Adicionar
          </Button>
        </div>

        {isFetching ? (
          <div className="text-center text-zinc-500 text-sm py-4">Carregando domínios...</div>
        ) : domains.length > 0 ? (
          <div className="space-y-4">
            {domains.map(d => (
              <div key={d.id} className="p-4 rounded-lg border border-zinc-800 bg-zinc-950/50">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-medium text-zinc-200">{d.domain}</h4>
                    <div className="mt-2">
                      {getStatusBadge(d.status)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      title="Verificar status do DNS"
                      onClick={() => handleVerifyDomain(d.domain)}
                      disabled={isLoading}
                    >
                      <RotateCcw className="w-4 h-4 text-zinc-400" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleRemoveDomain(d.domain)}
                      disabled={isLoading}
                      className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {d.status !== 'active' && (
                  <div className="mt-4 p-4 rounded bg-zinc-900 border border-zinc-800">
                    <p className="text-sm font-medium text-zinc-300 mb-2">Para ativar, configure no seu provedor de domínio (Registro.br, Cloudflare, etc):</p>
                    <div className="space-y-3 text-sm font-mono bg-black/40 p-3 rounded text-zinc-400">
                      <div>
                        <span className="text-zinc-500 block text-xs">Tipo A (Deixe o nome em branco ou use @)</span>
                        Valor: <span className="text-green-400">76.76.21.21</span>
                      </div>
                      <div className="border-t border-zinc-800 my-2 pt-2"></div>
                      <div>
                        <span className="text-zinc-500 block text-xs">Tipo CNAME (Para o nome www)</span>
                        Valor: <span className="text-green-400">cname.vercel-dns.com</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-zinc-500 text-sm py-4">
            Você ainda não conectou nenhum domínio.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
