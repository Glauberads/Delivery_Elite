import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Save, AlertCircle, Megaphone, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export default function MarketingSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    facebook_pixel_id: "",
    google_tag_id: "",
  });

  const { data: tenant, isLoading, refetch } = useQuery({
    queryKey: ["tenant_marketing", user?.id],
    queryFn: async () => {
      if (!user?.tenantId) return null;
      
      const { data, error } = await supabase
        .from("tenants")
        .select("id, facebook_pixel_id, google_tag_id, marketing_enabled")
        .eq("id", user.tenantId)
        .single();
        
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (tenant) {
      setFormData({
        facebook_pixel_id: tenant.facebook_pixel_id || "",
        google_tag_id: tenant.google_tag_id || "",
      });
    }
  }, [tenant]);

  const handleSave = async () => {
    if (!tenant?.id) return;
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          facebook_pixel_id: formData.facebook_pixel_id || null,
          google_tag_id: formData.google_tag_id || null,
        })
        .eq("id", tenant.id);
        
      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Configurações de marketing salvas com sucesso.",
      });
      refetch();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verifica se o módulo está liberado pelo SuperAdmin
  if (!tenant?.marketing_enabled) {
    return (
      <div className="flex flex-col h-full bg-zinc-950 text-white min-h-[calc(100vh-80px)] -m-6">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-zinc-900/50 p-8 rounded-3xl shadow-2xl text-center relative overflow-hidden border border-zinc-800/50 backdrop-blur-sm">
            {/* Efeito de brilho de fundo */}
            <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-orange-500/10 to-transparent -z-10" />

            <div className="w-20 h-20 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner ring-4 ring-orange-500/20">
              <Megaphone className="w-10 h-10" />
            </div>
            
            <h2 className="text-2xl font-extrabold text-white mb-3 tracking-tight">
              Escale suas vendas com <span className="text-orange-500">Tráfego Pago</span>
            </h2>
            
            <p className="text-zinc-400 mb-6 text-sm leading-relaxed">
              Desbloqueie o <strong className="text-zinc-200">Módulo de Marketing</strong> e integre seu catálogo com Facebook Pixel e Google Analytics para campanhas de alta conversão.
            </p>
            
            <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-2xl p-5 text-left space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <p className="text-sm text-zinc-400"><strong className="text-zinc-200 block">Remarketing Poderoso</strong> Recupere clientes que visitaram o cardápio e não finalizaram a compra.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <p className="text-sm text-zinc-400"><strong className="text-zinc-200 block">Métricas Precisas</strong> Saiba exatamente qual anúncio no Instagram ou Google traz mais pedidos.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <p className="text-sm text-zinc-400"><strong className="text-zinc-200 block">Máxima Conversão</strong> Encontre e foque o seu orçamento no público que mais gasta na sua loja.</p>
              </div>
            </div>

            <Button 
              className="w-full bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_20px_rgba(234,88,12,0.3)] h-14 text-base font-bold rounded-xl transition-all hover:scale-[1.02]"
              onClick={() => window.open("https://wa.me/5522981711078?text=Quero%20habilitar%20o%20*M%C3%B3dulo%20de%20Marketing*%20para%20integrar%20meu%20Pixel%20e%20aumentar%20minhas%20vendas.", "_blank")}
            >
              Quero Vender Mais Agora
            </Button>
            
            <p className="text-xs text-zinc-500 mt-5 font-medium">
              Fale diretamente com nosso suporte comercial no WhatsApp
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marketing (Pixel e Tags)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure os identificadores (IDs) das suas ferramentas de anúncios para rastrear as visitas no seu cardápio.
        </p>
      </div>

      <Card className="border-border/60 bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Integrações de Rastreamento</CardTitle>
          <CardDescription>
            Os scripts serão injetados automaticamente na vitrine para seus clientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="fb-pixel">Facebook Pixel ID</Label>
            <Input
              id="fb-pixel"
              placeholder="Ex: 123456789012345"
              value={formData.facebook_pixel_id}
              onChange={(e) => setFormData((prev) => ({ ...prev, facebook_pixel_id: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Apenas os números de identificação do seu Pixel (ID). O evento padrão 'PageView' será disparado.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="google-tag">Google Tag ID</Label>
            <Input
              id="google-tag"
              placeholder="Ex: G-XXXXXXXXXX ou AW-XXXXXXXXX"
              value={formData.google_tag_id}
              onChange={(e) => setFormData((prev) => ({ ...prev, google_tag_id: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              O ID de medição do Google Analytics 4 (começa com G-) ou do Google Ads (começa com AW-).
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full sm:w-auto bg-delivery-500 hover:bg-delivery-600"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Salvando..." : "Salvar configurações"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
