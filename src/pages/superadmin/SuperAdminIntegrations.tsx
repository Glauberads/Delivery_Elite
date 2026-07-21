import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PlatformSetting {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  is_secret: boolean | null;
}

type SettingsForm = Record<string, string>;
type SettingsConfig = Record<string, unknown>;

type TestEmailResponse = {
  success: boolean;
  message?: string;
};

type AsaasHealthResponse = {
  connected: boolean;
  status?: number;
  error?: unknown;
};

const managedKeys = ["asaas_config", "resend_api_key", "resend_from_email", "smtp_sender_name", "facebook_pixel_id", "google_tag_id"] as const;

const defaultForm: SettingsForm = {
  asaas_environment: "sandbox",
  asaas_api_key: "",
  asaas_webhook_token: "",
  split_partner_a_wallet: "",
  split_partner_a_percent: "",
  split_partner_b_wallet: "",
  split_partner_b_percent: "",
  smtp_sender_name: "VipDelivery",
  resend_api_key: "",
  resend_from_email: "",
  facebook_pixel_id: "",
  google_tag_id: "",
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isJsonRecord(value: unknown): value is SettingsConfig {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSettingValue(rawValue?: string | null) {
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    return isJsonRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function getFunctionErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Erro desconhecido ao testar o envio de e-mail.";
  }

  const invokeError = error as Error & { context?: Response };

  if (invokeError.context) {
    try {
      const payload = await invokeError.context.json();

      if (typeof payload?.error === "string" && payload.error.trim().length > 0) {
        return payload.error;
      }
    } catch {
      // Mantém a mensagem original do invoke quando o corpo não for JSON.
    }
  }

  return error.message;
}

export default function SuperAdminIntegrations() {
  const { toast } = useToast();
  const { session, user } = useAuth();
  const [form, setForm] = useState<SettingsForm>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [asaasHealth, setAsaasHealth] = useState<AsaasHealthResponse>({ connected: false });
  const [isCheckingAsaas, setIsCheckingAsaas] = useState(false);

  const { data, isLoading, refetch } = useQuery<PlatformSetting[]>({
    queryKey: ["superadmin", "integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("id, key, value, description, is_secret")
        .in("key", managedKeys)
        .order("key");

      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const nextForm: SettingsForm = { ...defaultForm };
    const asaasConfig = parseSettingValue(data?.find((item) => item.key === "asaas_config")?.value);
    const splitConfig = isJsonRecord(asaasConfig.split) ? asaasConfig.split : {};
    const resendApiKey = data?.find((item) => item.key === "resend_api_key")?.value;
    const resendFromEmail = data?.find((item) => item.key === "resend_from_email")?.value;
    const senderName = data?.find((item) => item.key === "smtp_sender_name")?.value;
    const facebookPixelId = data?.find((item) => item.key === "facebook_pixel_id")?.value;
    const googleTagId = data?.find((item) => item.key === "google_tag_id")?.value;

    nextForm.asaas_environment = String(asaasConfig.environment ?? defaultForm.asaas_environment);
    nextForm.asaas_api_key = String(asaasConfig.apiKey ?? "");
    nextForm.asaas_webhook_token = String(asaasConfig.webhookToken ?? "");
    nextForm.split_partner_a_wallet = String(splitConfig.partnerAWallet ?? "");
    nextForm.split_partner_a_percent = String(splitConfig.partnerAPercent ?? "");
    nextForm.split_partner_b_wallet = String(splitConfig.partnerBWallet ?? "");
    nextForm.split_partner_b_percent = String(splitConfig.partnerBPercent ?? "");
    nextForm.smtp_sender_name = String(senderName ?? defaultForm.smtp_sender_name);
    nextForm.resend_api_key = String(resendApiKey ?? "");
    nextForm.resend_from_email = String(resendFromEmail ?? "");
    nextForm.facebook_pixel_id = String(facebookPixelId ?? "");
    nextForm.google_tag_id = String(googleTagId ?? "");
    setForm(nextForm);
  }, [data]);

  useEffect(() => {
    if (!user?.email) return;
    setTestEmail(user.email);
  }, [user?.email]);

  const hasAsaasApiKey = Boolean(form.asaas_api_key?.trim());

  const checkAsaasHealth = useCallback(async () => {
    if (!session?.access_token || !hasAsaasApiKey) {
      setAsaasHealth({ connected: false });
      return;
    }

    setIsCheckingAsaas(true);

    try {
      const { data, error } = await supabase.functions.invoke<AsaasHealthResponse>("check-asaas-health", {
        body: {
          accessToken: session.access_token,
        },
      });

      if (error) {
        throw new Error(await getFunctionErrorMessage(error));
      }

      setAsaasHealth(data ?? { connected: false });
    } catch (error) {
      setAsaasHealth({
        connected: false,
        error: error instanceof Error ? error.message : "Erro ao validar o Asaas.",
      });
    } finally {
      setIsCheckingAsaas(false);
    }
  }, [hasAsaasApiKey, session?.access_token]);

  useEffect(() => {
    void checkAsaasHealth();
  }, [checkAsaasHealth]);

  const saveSettings = async () => {
    setIsSaving(true);

    try {
      const payload = [
        {
          key: "asaas_config",
          value: JSON.stringify({
            environment: form.asaas_environment || "sandbox",
            apiKey: form.asaas_api_key || "",
            webhookToken: form.asaas_webhook_token || "",
            split: {
              partnerAWallet: form.split_partner_a_wallet || "",
              partnerAPercent: form.split_partner_a_percent || "",
              partnerBWallet: form.split_partner_b_wallet || "",
              partnerBPercent: form.split_partner_b_percent || "",
            },
          }),
        },
        {
          key: "resend_api_key",
          value: form.resend_api_key || "",
        },
        {
          key: "smtp_sender_name",
          value: form.smtp_sender_name || "VipDelivery",
        },
        {
          key: "resend_from_email",
          value: form.resend_from_email || "",
        },
        {
          key: "facebook_pixel_id",
          value: form.facebook_pixel_id || "",
        },
        {
          key: "google_tag_id",
          value: form.google_tag_id || "",
        },
      ];

      const { data: persistedRows, error } = await supabase
        .from("platform_settings")
        .upsert(payload, { onConflict: "key" })
        .select("key, value");

      console.log("platform_settings upsert result", persistedRows);

      if (error) {
        if (/row-level security|permission denied/i.test(error.message)) {
          console.error("platform_settings RLS error", error);
        }
        throw error;
      }

      if (!persistedRows || persistedRows.length === 0) {
        throw new Error("Nenhum dado retornou do banco após o upsert em platform_settings.");
      }

      toast({
        title: "Integrações atualizadas",
        description: "As configurações globais da plataforma foram salvas.",
        variant: "success",
      });

      await refetch();
      await checkAsaasHealth();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar integrações",
        description: error instanceof Error ? error.message : "Erro desconhecido ao salvar.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!session?.access_token) {
      toast({
        title: "Sessão inválida",
        description: "Faça login novamente para testar o envio de e-mail.",
        variant: "destructive",
      });
      return;
    }

    const normalizedTargetEmail = testEmail.trim().toLowerCase();

    if (!isValidEmail(normalizedTargetEmail)) {
      toast({
        title: "E-mail inválido",
        description: "Informe um e-mail válido para o teste de entrega.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingEmail(true);

    try {
      const { data, error } = await supabase.functions.invoke<TestEmailResponse>("send-test-email", {
        body: {
          targetEmail: normalizedTargetEmail,
          accessToken: session.access_token,
        },
      });

      if (error) {
        throw new Error(await getFunctionErrorMessage(error));
      }

      if (!data?.success) {
        throw new Error(data?.message || "Falha ao enviar o e-mail de teste.");
      }

      toast({
        title: "E-mail enviado com sucesso!",
        description: `Verifique a caixa de entrada de ${normalizedTargetEmail}.`,
        variant: "success",
      });
      setIsTestDialogOpen(false);
    } catch (error) {
      toast({
        title: "Falha no teste de e-mail",
        description: error instanceof Error ? error.message : "Erro técnico desconhecido.",
        variant: "destructive",
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const isSecret = (key: string) => key === "asaas_api_key" || key === "asaas_webhook_token" || key === "resend_api_key";
  const isAsaasConnected = Boolean(asaasHealth.connected);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configurações globais do Asaas e do provedor de e-mail da plataforma</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/60 bg-card text-card-foreground">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-sm font-medium text-foreground">
              <span className="inline-flex items-center gap-2 text-xs font-medium">
                <span
                  className={`h-3 w-3 rounded-full ${
                    isAsaasConnected ? "bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,5.85)]" : "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,5.7)]"
                  }`}
                />
              </span>
              <span>Asaas</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select
                value={form.asaas_environment || "sandbox"}
                onValueChange={(value) => setForm((prev) => ({ ...prev, asaas_environment: value }))}
              >
                <SelectTrigger className="bg-background dark:bg-secondary text-foreground border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background dark:bg-secondary text-foreground border-border">
                  <SelectItem value="sandbox">sandbox</SelectItem>
                  <SelectItem value="production">production</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Ambiente usado para integração com a API do Asaas.</p>
            </div>

            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type={isSecret("asaas_api_key") ? "password" : "text"}
                value={form.asaas_api_key || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, asaas_api_key: e.target.value }))}
                className="bg-background dark:bg-secondary text-foreground border-border"
              />
              <p className="text-xs text-muted-foreground">Chave da API do Asaas salva em asaas_config.</p>
            </div>

            <div className="space-y-2">
              <Label>Webhook Token</Label>
              <Input
                type={isSecret("asaas_webhook_token") ? "password" : "text"}
                value={form.asaas_webhook_token || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, asaas_webhook_token: e.target.value }))}
                className="bg-background dark:bg-secondary text-foreground border-border"
              />
              <p className="text-xs text-muted-foreground">Token usado para validar os webhooks do Asaas.</p>
            </div>

            <div className="space-y-4 border-t border-border/60 pt-4">
              <div>
                <h3 className="text-sm font-medium text-foreground">Split</h3>
                <p className="mt-1 text-xs text-muted-foreground">Configurações de repasse financeiro da plataforma.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Wallet Sócio A</Label>
                  <Input
                    className="bg-background dark:bg-secondary text-foreground border-border"
                    value={form.split_partner_a_wallet || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, split_partner_a_wallet: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>% Sócio A</Label>
                  <Input
                    className="bg-background dark:bg-secondary text-foreground border-border"
                    value={form.split_partner_a_percent || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, split_partner_a_percent: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Wallet Sócio B</Label>
                  <Input
                    className="bg-background dark:bg-secondary text-foreground border-border"
                    value={form.split_partner_b_wallet || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, split_partner_b_wallet: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>% Sócio B</Label>
                  <Input
                    className="bg-background dark:bg-secondary text-foreground border-border"
                    value={form.split_partner_b_percent || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, split_partner_b_percent: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card text-card-foreground">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-foreground">Email (Resend)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Remetente</Label>
              <Input
                className="bg-background dark:bg-secondary text-foreground border-border"
                value={form.smtp_sender_name || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, smtp_sender_name: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Nome exibido antes do e-mail no campo from.</p>
            </div>

            <div className="space-y-2">
              <Label>E-mail do Remetente</Label>
              <Input
                type="email"
                className="bg-background dark:bg-secondary text-foreground border-border"
                value={form.resend_from_email || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, resend_from_email: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Endereço usado no campo from do Resend.</p>
            </div>

            <div className="space-y-2">
              <Label>Chave da API</Label>
              <Input
                type={isSecret("resend_api_key") ? "password" : "text"}
                className="bg-background dark:bg-secondary text-foreground border-border"
                value={form.resend_api_key || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, resend_api_key: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Chave privada usada para chamadas HTTP à API do Resend.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card text-card-foreground">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-foreground">Marketing & Analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Facebook Pixel ID</Label>
              <Input
                className="bg-background dark:bg-secondary text-foreground border-border"
                value={form.facebook_pixel_id || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, facebook_pixel_id: e.target.value }))}
                placeholder="Ex: 123456789012345"
              />
              <p className="text-xs text-muted-foreground">ID do Pixel do Facebook para rastreamento de eventos.</p>
            </div>

            <div className="space-y-2">
              <Label>Google Tag (GTM / Analytics)</Label>
              <Input
                className="bg-background dark:bg-secondary text-foreground border-border"
                value={form.google_tag_id || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, google_tag_id: e.target.value }))}
                placeholder="Ex: GTM-XXXXXXX ou G-XXXXXXXXXX"
              />
              <p className="text-xs text-muted-foreground">ID da Tag do Google para métricas e rastreamento.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsTestDialogOpen(true)}
          disabled={isTestingEmail || isSaving || isLoading}
          className="border-border bg-background text-foreground hover:bg-muted"
        >
          {isTestingEmail ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testando envio...
            </>
          ) : (
            <>
              <MailCheck className="mr-2 h-4 w-4" />
              Testar Envio
            </>
          )}
        </Button>
        <Button onClick={saveSettings} disabled={isSaving || isLoading || isTestingEmail} className="bg-orange-500 hover:bg-orange-600 text-white">
          {isSaving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent className="border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Testar envio de e-mail</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Informe o e-mail de destino para validar a entrega usando a configuração do Resend.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="test-email-target">E-mail para teste</Label>
            <Input
              id="test-email-target"
              type="email"
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              className="bg-background dark:bg-secondary text-foreground border-border"
              placeholder="voce@dominio.com"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTestDialogOpen(false)}
              className="border-border bg-transparent text-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleTestEmail}
              disabled={isTestingEmail}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isTestingEmail ? "Enviando..." : "Enviar teste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



