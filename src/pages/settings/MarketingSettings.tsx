import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Save, AlertCircle } from "lucide-react";
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
      <div className="p-6 max-w-3xl">
        <h1 className="text-2xl font-bold mb-2">Marketing (Pixel e Tags)</h1>
        <p className="text-muted-foreground mb-6">
          Integre sua loja com ferramentas de anúncio.
        </p>
        
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">Módulo Bloqueado</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400 mt-2">
            O módulo de Marketing Avançado (Facebook Pixel e Google Tag) é um recurso exclusivo e não está liberado para a sua conta no momento.
            <br /><br />
            Entre em contato com o suporte ou comercial para fazer um upgrade e ativar esta função.
          </AlertDescription>
        </Alert>
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
