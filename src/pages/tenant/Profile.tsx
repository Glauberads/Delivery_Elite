import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BadgeCheck, CalendarClock, CreditCard, Mail, MapPin, Phone, Sparkles } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { PaywallScreen } from "@/components/billing/PaywallScreen";
import { BasicInformationForm } from "@/components/settings/BasicInformationForm";
import { BillingHistory } from "@/components/settings/BillingHistory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getBillingDaysRemaining } from "@/lib/trial";
import { cn } from "@/lib/utils";

const BILLING_ALERT_PULSE_CLASS = "animate-[pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite]";

type TenantProfilePayload = {
  tenant: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    cpf_cnpj: string | null;
    plan_id: string | null;
    trial_ends_at: string | null;
    status: string | null;
    created_at: string | null;
  } | null;
  restaurant: {
    description: string | null;
    address: string | null;
  } | null;
  subscription: {
    plan_id: string | null;
    status: string | null;
    current_period_end: string | null;
    created_at: string | null;
  } | null;
  plans: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    type: string;
    billing_days: number;
  }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatPlanCardPrice(value: number) {
  return formatCurrency(value).replace(/^R\$\s?/, "");
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getPlanTypeLabel(value?: string | null) {
  switch (String(value ?? "").toLowerCase()) {
    case "annual":
    case "yearly":
      return "Anual";
    case "semiannual":
    case "semi-annual":
    case "semester":
    case "semestral":
      return "Semestral";
    case "quarterly":
      return "Trimestral";
    default:
      return "Mensal";
  }
}

function getPlanFeatures(type?: string | null) {
  const baseFeatures = ["PDV Online", "Gestão de Pedidos", "Menu Digital"];

  switch (String(type ?? "").toLowerCase()) {
    case "annual":
    case "yearly":
      return [...baseFeatures, "Relatórios Avançados", "Suporte Prioritário"];
    case "semiannual":
    case "semi-annual":
    case "semester":
    case "semestral":
      return [...baseFeatures, "Relatórios Avançados", "Campanhas sazonais"];
    case "quarterly":
      return [...baseFeatures, "Relatórios Avançados", "Automações comerciais"];
    default:
      return [...baseFeatures, "Operação essencial"];
  }
}

function getDiscountPercent(plan: TenantProfilePayload["plans"][number], monthlyPrice?: number) {
  if (!monthlyPrice || plan.price <= 0) {
    return null;
  }

  const planType = String(plan.type ?? "").toLowerCase();
  const cycleMultiplier =
    planType === "quarterly" ? 3 :
    planType === "semiannual" || planType === "semi-annual" || planType === "semester" || planType === "semestral" ? 6 :
    planType === "annual" || planType === "yearly" ? 12 :
    1;

  if (cycleMultiplier === 1) {
    return null;
  }

  const referenceValue = monthlyPrice * cycleMultiplier;
  const discountPercent = Math.round((1 - Number(plan.price) / referenceValue) * 100);

  if (discountPercent <= 0) {
    return null;
  }

  return discountPercent;
}

export default function TenantProfile() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isRenewalPaywallOpen, setIsRenewalPaywallOpen] = useState(false);
  const tenantId = user?.tenantId ?? null;
  const activeTab = searchParams.get("tab") || "profile";
  const preferredPlanId = searchParams.get("planId");
  const onboardingRequested = searchParams.get("onboarding") === "complete";
  const daysRemaining = getBillingDaysRemaining({
    trialEndsAt: user?.trialEndsAt,
    subscriptionPeriodEnd: user?.subscriptionCurrentPeriodEnd,
  });
  const displayDaysRemaining = typeof daysRemaining === "number" ? Math.max(daysRemaining, 0) : 0;
  const isScarcityWindow = typeof daysRemaining === "number" && daysRemaining <= 3;

  const { data, isLoading } = useQuery<TenantProfilePayload>({
    queryKey: ["tenant", "profile-hub", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      if (!tenantId) {
        throw new Error("Tenant não encontrado para o usuário logado.");
      }

      const [tenantResult, restaurantResult, subscriptionResult, plansResult] = await Promise.all([
        supabase
          .from("tenants")
          .select("id, name, email, phone, cpf_cnpj, plan_id, trial_ends_at, status, created_at")
          .eq("id", tenantId)
          .maybeSingle(),
        supabase
          .from("restaurants")
          .select("description, address")
          .eq("tenant_id", tenantId)
          .maybeSingle(),
        supabase
          .from("tenant_subscriptions")
          .select("plan_id, status, current_period_end, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("plans")
          .select("id, name, description, price, type, billing_days")
          .eq("active", true)
          .order("price", { ascending: true }),
      ]);

      if (tenantResult.error) throw tenantResult.error;
      if (restaurantResult.error) throw restaurantResult.error;
      if (subscriptionResult.error) throw subscriptionResult.error;
      if (plansResult.error) throw plansResult.error;

      return {
        tenant: tenantResult.data,
        restaurant: restaurantResult.data,
        subscription: subscriptionResult.data,
        plans: plansResult.data ?? [],
      };
    },
  });

  useEffect(() => {
    if (searchParams.get("billing") === "renew") {
      setIsRenewalPaywallOpen(true);
    }
  }, [searchParams]);

  const currentPlan = useMemo(() => {
    const currentPlanId = data?.subscription?.plan_id ?? data?.tenant?.plan_id ?? null;
    return data?.plans.find((plan) => plan.id === currentPlanId) ?? null;
  }, [data?.plans, data?.subscription?.plan_id, data?.tenant?.plan_id]);

  const monthlyPlan = useMemo(
    () => data?.plans.find((plan) => String(plan.type).toLowerCase() === "monthly") ?? null,
    [data?.plans]
  );

  const tenantInitial =
    data?.tenant?.name?.trim().charAt(0).toUpperCase() ||
    user?.tenantName?.trim().charAt(0).toUpperCase() ||
    "L";

  const subscriptionStartDate = data?.subscription?.created_at ?? data?.tenant?.created_at ?? null;
  const expirationDate = data?.subscription?.current_period_end ?? data?.tenant?.trial_ends_at ?? null;
  const missingBasicFields = [
    !data?.tenant?.phone ? "telefone/WhatsApp" : null,
    !data?.tenant?.cpf_cnpj ? "CPF/CNPJ" : null,
    !data?.restaurant?.address ? "endereco" : null,
  ].filter(Boolean) as string[];
  const showOnboardingAlert = onboardingRequested || missingBasicFields.length > 0;

  const handleTabChange = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", value);
    setSearchParams(nextParams, { replace: true });
  };

  const openRenewalModal = (planId?: string | null) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("billing", "renew");
    nextParams.set("tab", activeTab);

    if (planId) {
      nextParams.set("planId", planId);
    } else {
      nextParams.delete("planId");
    }

    setSearchParams(nextParams, { replace: true });
    setIsRenewalPaywallOpen(true);
  };

  const handleRenewalPaywallOpenChange = (open: boolean) => {
    setIsRenewalPaywallOpen(open);

    if (!open) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("billing");
      nextParams.delete("planId");
      setSearchParams(nextParams, { replace: true });
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Header title="Perfil da Loja" />

      <div className="flex-1 space-y-6 p-4 md:p-6">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.18em] text-orange-500/80 dark:text-orange-300/80">
            Configurações Admin
          </p>
          <h2 className="text-3xl font-heading font-semibold text-slate-900 dark:text-slate-50">
            Hub de controle da sua loja
          </h2>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="subscription">Assinatura</TabsTrigger>
            <TabsTrigger value="plans">Planos</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            {showOnboardingAlert ? (
              <Card className="border-amber-300/70 bg-amber-50 shadow-lg shadow-amber-100/40 dark:border-amber-500/30 dark:bg-amber-500/10 dark:shadow-transparent">
                <CardContent className="flex items-start gap-3 p-5">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-300" />
                  <div className="space-y-1">
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      Finalize a configuracao inicial da sua loja
                    </p>
                    <p className="text-sm text-amber-800/90 dark:text-amber-100/80">
                      Preencha os dados basicos restantes para concluir o onboarding e liberar a operacao completa.
                    </p>
                    {missingBasicFields.length > 0 ? (
                      <p className="text-xs uppercase tracking-[0.16em] text-amber-700/80 dark:text-amber-200/70">
                        Pendencias: {missingBasicFields.join(" • ")}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-slate-200/80 bg-white shadow-xl shadow-slate-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20">
              <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-2xl font-bold text-white shadow-lg shadow-orange-500/20">
                      {tenantInitial}
                    </div>
                    <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-green-500 dark:border-zinc-900" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                      {data?.tenant?.name || user?.tenantName || "Sua loja"}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-zinc-400">
                      Centralize aqui seus dados cadastrais e informações operacionais.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 text-sm text-slate-600 dark:text-zinc-300 md:text-right">
                  <div className="inline-flex items-center gap-2 md:justify-end">
                    <Mail className="h-4 w-4 text-orange-500" />
                    <span>{data?.tenant?.email || user?.email || "-"}</span>
                  </div>
                  <div className="inline-flex items-center gap-2 md:justify-end">
                    <Phone className="h-4 w-4 text-orange-500" />
                    <span>{data?.tenant?.phone || "Telefone não informado"}</span>
                  </div>
                  <div className="inline-flex items-center gap-2 md:justify-end">
                    <MapPin className="h-4 w-4 text-orange-500" />
                    <span>{data?.restaurant?.address || "Endereço não informado"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <BasicInformationForm showBillingSummary={false} enableRenewalModal={false} />
          </TabsContent>

          <TabsContent value="subscription" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="border-slate-200/80 bg-white shadow-xl shadow-slate-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20">
                <CardHeader>
                  <CardTitle className="text-slate-900 dark:text-slate-50">Informações da assinatura</CardTitle>
                  <CardDescription className="text-slate-600 dark:text-zinc-400">
                    Acompanhe o plano ativo, datas e janela de renovação.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-500">
                          Plano Atual
                        </p>
                        <h3 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                          {currentPlan?.name || "Plano não identificado"}
                        </h3>
                      </div>
                      {currentPlan ? (
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                          {getPlanTypeLabel(currentPlan.type)}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
                        <p className="text-sm text-slate-500 dark:text-zinc-500">Início do ciclo</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                          {formatDate(subscriptionStartDate)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
                        <p className="text-sm text-slate-500 dark:text-zinc-500">Expiração</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                          {formatDate(expirationDate)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-orange-200/70 bg-orange-50 p-5 dark:border-orange-500/20 dark:bg-orange-500/10">
                    <div className="flex items-start gap-3">
                      <CalendarClock className="mt-1 h-5 w-5 text-orange-600 dark:text-orange-300" />
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                          {user?.subscriptionStatus === "active" ? "Assinatura expira em" : "Seu periodo atual expira em"}
                        </p>
                        <div className="flex items-end gap-2">
                          <span
                            className={cn(
                              "text-5xl font-bold text-red-600 dark:text-white",
                              isScarcityWindow && BILLING_ALERT_PULSE_CLASS
                            )}
                          >
                            {displayDaysRemaining}
                          </span>
                          <span
                            className={cn(
                              "pb-1 text-2xl font-bold text-red-600 dark:text-white",
                              isScarcityWindow && BILLING_ALERT_PULSE_CLASS
                            )}
                          >
                            dias
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-zinc-400">
                          Mantenha seu painel e PDV ativos sem interrupção no próximo ciclo.
                        </p>
                      </div>
                    </div>

                    {isScarcityWindow ? (
                      <Button
                        type="button"
                        onClick={() => openRenewalModal(currentPlan?.id)}
                        className="mt-5 rounded-xl"
                      >
                        Renovar Plano
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <BillingHistory />
            </div>
          </TabsContent>

          <TabsContent value="plans" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {isLoading ? (
                <Card className="border-slate-200/80 bg-white shadow-xl shadow-slate-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20 lg:col-span-3">
                  <CardContent className="py-12 text-center text-slate-600 dark:text-zinc-400">
                    Carregando planos...
                  </CardContent>
                </Card>
              ) : (
                data?.plans.map((plan) => {
                  const isCurrentPlan = currentPlan?.id === plan.id;
                  const discountPercent = getDiscountPercent(plan, monthlyPlan?.price);

                  return (
                    <Card
                      key={plan.id}
                      className={cn(
                        "flex h-full flex-col border shadow-xl transition-all duration-300",
                        "border-slate-200/80 bg-white shadow-slate-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20",
                        isCurrentPlan && "border-orange-300 bg-orange-50/70 dark:border-orange-500/30 dark:bg-zinc-900"
                      )}
                    >
                      <CardHeader className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <Badge variant="outline" className="border-slate-300 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                            {getPlanTypeLabel(plan.type)}
                          </Badge>
                          {isCurrentPlan ? (
                            <Badge className="bg-emerald-500 text-emerald-950">
                              Plano atual
                            </Badge>
                          ) : null}
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-4">
                            <CardTitle className="text-2xl text-slate-900 dark:text-slate-50">
                              {plan.name}
                            </CardTitle>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-4xl font-extrabold text-slate-950 dark:text-white">
                              {formatPlanCardPrice(Number(plan.price))}
                            </span>
                            {discountPercent ? (
                              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full bg-orange-500 text-white">
                                <span className="text-lg font-bold leading-none">{discountPercent}%</span>
                                <span className="mt-1 text-xs font-medium uppercase leading-none">off</span>
                              </div>
                            ) : null}
                          </div>
                          <CardDescription className="text-slate-600 dark:text-zinc-400">
                            Renovação a cada {plan.billing_days} dias.
                          </CardDescription>
                        </div>
                      </CardHeader>

                      <CardContent className="flex flex-1 flex-col justify-between gap-6">
                        <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
                          {getPlanFeatures(plan.type).map((feature) => (
                            <div key={feature} className="flex items-center gap-3 text-sm text-slate-700 dark:text-zinc-300">
                              <Sparkles className="h-4 w-4 text-orange-500" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>

                        <Button
                          type="button"
                          onClick={() => openRenewalModal(plan.id)}
                          className="w-full"
                        >
                          Selecionar
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <PaywallScreen
        mode="renewal"
        open={isRenewalPaywallOpen}
        onOpenChange={handleRenewalPaywallOpenChange}
        preferredPlanId={preferredPlanId}
      />
    </div>
  );
}



