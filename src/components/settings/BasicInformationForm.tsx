
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarClock, Save } from 'lucide-react';
import { digitsOnly, formatCpfCnpj, isValidCpfCnpj } from "@/lib/cpf-cnpj";
import { digitsOnly as digitsOnlyPhone, formatWhatsapp } from "@/lib/phone";
import { getBillingDaysRemaining } from '@/lib/trial';
import { cn } from '@/lib/utils';
import { PaywallScreen } from '@/components/billing/PaywallScreen';

const BILLING_ALERT_PULSE_CLASS = "animate-[pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite]";

type BasicInfoPayload = {
  tenant: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    cpf_cnpj: string | null;
  } | null;
  restaurant: {
    id: string;
    description: string | null;
    address: string | null;
  } | null;
};

type BasicInformationFormProps = {
  showBillingSummary?: boolean;
  enableRenewalModal?: boolean;
};

export function BasicInformationForm({
  showBillingSummary = true,
  enableRenewalModal = true,
}: BasicInformationFormProps) {
  const { toast } = useToast();
  const { user, refreshUserProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRenewalPaywallOpen, setIsRenewalPaywallOpen] = useState(false);
  const daysRemaining = getBillingDaysRemaining({
    trialEndsAt: user?.trialEndsAt,
    subscriptionPeriodEnd: user?.subscriptionCurrentPeriodEnd,
  });
  const displayDaysRemaining = typeof daysRemaining === "number" ? Math.max(daysRemaining, 0) : 0;
  const isCriticalExpiry = typeof daysRemaining === "number" && daysRemaining <= 3;
  const canRenderRenewButton = typeof daysRemaining === "number" && daysRemaining <= 3;
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpfCnpj: '',
    description: '',
    address: '',
    phone: '',
  });
  const preferredPlanId = searchParams.get("planId");

  const normalizeWhatsappForDisplay = (value?: string | null) => {
    const digits = digitsOnlyPhone(value ?? "");
    const localDigits = digits.startsWith("55") ? digits.slice(2) : digits;
    return formatWhatsapp(localDigits);
  };

  const normalizeWhatsappForStorage = (value?: string | null) => {
    const digits = digitsOnlyPhone(value ?? "");
    const localDigits = digits.startsWith("55") ? digits.slice(2) : digits;
    return localDigits ? `55${localDigits.slice(0, 11)}` : "";
  };

  useEffect(() => {
    if (!enableRenewalModal) {
      return;
    }

    if (searchParams.get("billing") === "renew") {
      setIsRenewalPaywallOpen(true);
    }
  }, [enableRenewalModal, searchParams]);

  const { data, refetch } = useQuery<BasicInfoPayload | null>({
    queryKey: ['restaurant'],
    queryFn: async () => {
      if (!user?.tenantId) {
        return null;
      }

      const [tenantResult, restaurantResult] = await Promise.all([
        supabase
          .from('tenants')
          .select('id, name, email, phone, cpf_cnpj')
          .eq('id', user.tenantId)
          .maybeSingle(),
        supabase
          .from('restaurants')
          .select('id, description, address')
          .eq('tenant_id', user.tenantId)
          .maybeSingle(),
      ]);

      if (tenantResult.error) {
        toast({
          variant: "destructive",
          title: "Erro ao carregar informações",
          description: tenantResult.error.message,
        });
        return null;
      }

      if (restaurantResult.error) {
        toast({
          variant: "destructive",
          title: "Erro ao carregar informações",
          description: restaurantResult.error.message,
        });
        return null;
      }

      return {
        tenant: tenantResult.data,
        restaurant: restaurantResult.data,
      };
    }
  });

  useEffect(() => {
    if (data) {
      setFormData({
        name: data.tenant?.name || '',
        email: data.tenant?.email || '',
        cpfCnpj: formatCpfCnpj(data.tenant?.cpf_cnpj || ''),
        description: data.restaurant?.description || '',
        address: data.restaurant?.address || '',
        phone: normalizeWhatsappForDisplay(data.tenant?.phone),
      });
    }
  }, [data]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRenewalPaywallOpenChange = (open: boolean) => {
    if (!enableRenewalModal) {
      return;
    }

    setIsRenewalPaywallOpen(open);

    if (!open && searchParams.get("billing") === "renew") {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("billing");
      nextParams.delete("planId");
      setSearchParams(nextParams, { replace: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const normalizedDocument = digitsOnly(formData.cpfCnpj);
      const normalizedEmail = formData.email.trim().toLowerCase();
      const normalizedWhatsapp = normalizeWhatsappForStorage(formData.phone);
      const currentEmail = String(data?.tenant?.email ?? "").trim().toLowerCase();
      const emailChanged = normalizedEmail !== currentEmail;

      if (!normalizedEmail) {
        throw new Error("Informe um e-mail válido.");
      }

      if (normalizedDocument && !isValidCpfCnpj(normalizedDocument)) {
        throw new Error("CPF/CNPJ inválido.");
      }

      if (!data?.tenant) {
        throw new Error("Tenant não encontrado para salvar as informações.");
      }

      if (emailChanged) {
        try {
          const { error: authError } = await supabase.auth.updateUser({
            email: normalizedEmail,
          });

          if (authError) {
            throw authError;
          }
        } catch (error: any) {
          const errorMessage = String(error?.message ?? "");
          const duplicatedEmail =
            /already been registered/i.test(errorMessage) ||
            /email.*already.*registered/i.test(errorMessage) ||
            /email.*already.*in use/i.test(errorMessage);

          if (duplicatedEmail) {
            throw new Error("Este e-mail já está em uso por outra conta na plataforma.");
          }

          throw error;
        }
      }

      const operations = [
        supabase
          .from('tenants')
          .update({
            name: formData.name,
            email: normalizedEmail,
            phone: normalizedWhatsapp || null,
            cpf_cnpj: normalizedDocument || null,
          })
          .eq('id', data.tenant.id),
      ];

      if (user?.id) {
        operations.push(
          supabase
            .from('tenant_users')
            .update({
              email: normalizedEmail,
            })
            .eq('id', user.id)
        );
      }

      if (data.restaurant?.id) {
        operations.push(
          supabase
            .from('restaurants')
            .update({
              description: formData.description || null,
              address: formData.address || null,
            })
            .eq('id', data.restaurant.id)
        );
      }

      const results = await Promise.all(operations);

      for (const result of results) {
        if (result.error) {
          throw result.error;
        }
      }

      await Promise.all([refetch(), refreshUserProfile()]);
      
      toast({
        title: emailChanged ? "Login atualizado" : "Informações atualizadas",
        description: emailChanged
          ? "O e-mail de login foi alterado. Confirme o novo endereço caso o Supabase solicite validação."
          : "As informações básicas foram atualizadas com sucesso."
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informações Básicas</CardTitle>
        <CardDescription>
          Configure as informações básicas do seu restaurante
        </CardDescription>
      </CardHeader>
      <CardContent>
        {showBillingSummary ? (
          <div className="mb-6 rounded-2xl border border-orange-200/60 bg-orange-50/80 p-4 text-sm text-orange-950 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-100">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="text-orange-600 dark:text-orange-300">
                  <p className="text-sm font-medium">
                    {user?.subscriptionStatus === "active" ? "Sua assinatura expira em:" : "Seu teste expira em:"}
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className={cn(
                      "text-2xl font-bold text-orange-700 dark:text-orange-200",
                      isCriticalExpiry && `dark:text-yellow-500 ${BILLING_ALERT_PULSE_CLASS}`
                    )}>
                      {displayDaysRemaining}
                    </span>
                    <span className={cn(
                      "text-xl font-bold text-orange-700 dark:text-orange-500",
                      isCriticalExpiry && `dark:text-yellow-500 ${BILLING_ALERT_PULSE_CLASS}`
                    )}>
                      dia(s)
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-orange-800/80 dark:text-orange-200/80">
                  {isCriticalExpiry
                    ? "Sua cobrança está em zona crítica. Regularize para evitar bloqueio do painel."
                    : "A contagem automatizada conforme o vencimento da assinatura."}
                </p>
                {canRenderRenewButton ? (
                  <Button
                    type="button"
                    onClick={() => setIsRenewalPaywallOpen(true)}
                    className="mt-4 rounded-xl bg-orange-500 text-white hover:bg-orange-400"
                  >
                    Renovar assinatura
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Restaurante</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpfCnpj">CPF/CNPJ</Label>
              <Input
                id="cpfCnpj"
                name="cpfCnpj"
                value={formData.cpfCnpj}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    cpfCnpj: formatCpfCnpj(e.target.value),
                  }))
                }
                placeholder="000.000.000-00"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Whatsapp</Label>
              <Input
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    phone: normalizeWhatsappForDisplay(e.target.value),
                  }))
                }
                placeholder="(21) 99999-9999"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>

        {enableRenewalModal ? (
          <PaywallScreen
            mode="renewal"
            open={isRenewalPaywallOpen}
            onOpenChange={handleRenewalPaywallOpenChange}
            preferredPlanId={preferredPlanId}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}



