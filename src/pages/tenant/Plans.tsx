import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, CreditCard, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type PlansPagePayload = {
  plans: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    type: "monthly" | "quarterly" | "annual";
    billing_days: number;
  }>;
  currentSubscription: {
    plan_id: string;
    status: string | null;
  } | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getPlanTypeLabel(type: PlansPagePayload["plans"][number]["type"]) {
  switch (type) {
    case "annual":
      return "Anual";
    case "quarterly":
      return "Trimestral";
    default:
      return "Mensal";
  }
}

function getPlanAccent(type: PlansPagePayload["plans"][number]["type"]) {
  switch (type) {
    case "annual":
      return "from-emerald-500/25 to-emerald-400/5 border-emerald-500/30 text-emerald-100";
    case "quarterly":
      return "from-sky-500/25 to-sky-400/5 border-sky-500/30 text-sky-100";
    default:
      return "from-orange-500/25 to-orange-400/5 border-orange-500/30 text-orange-100";
  }
}

export default function TenantPlans() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const tenantId = user?.tenantId ?? null;

  const { data, isLoading, error } = useQuery<PlansPagePayload>({
    queryKey: ["tenant", "plans", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      if (!tenantId) {
        throw new Error("Loja não encontrada para o usuário logado.");
      }

      const [plansResult, subscriptionResult] = await Promise.all([
        supabase
          .from("plans")
          .select("id, name, description, price, type, billing_days")
          .eq("active", true)
          .in("type", ["monthly", "quarterly", "annual"])
          .order("price", { ascending: true }),
        supabase
          .from("tenant_subscriptions")
          .select("plan_id, status")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (plansResult.error) throw plansResult.error;
      if (subscriptionResult.error) throw subscriptionResult.error;

      return {
        plans: plansResult.data ?? [],
        currentSubscription: subscriptionResult.data,
      };
    },
  });

  return (
    <div className="min-h-full text-slate-900 dark:text-slate-50">
      <Header title="Escolha seu Plano" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-orange-500/80 dark:text-orange-300/80">Assinatura self-service</p>
            <h2 className="mt-2 text-3xl font-heading font-semibold text-slate-900 dark:text-slate-50">Selecione o plano ideal para sua operação</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-zinc-400">
              Os planos já cadastrados no banco são lidos em tempo real e o checkout segue direto para a Edge Function.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-100 dark:hover:bg-zinc-900"
            onClick={() => navigate("/admin/profile?tab=subscription")}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Voltar para assinatura
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="border-red-500/40 bg-red-500/10 text-red-50">
            <AlertTitle>Falha ao carregar os planos</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "Não foi possível consultar os planos disponíveis."}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {isLoading ? (
            <Card className="border-slate-200/80 bg-white text-slate-900 shadow-xl shadow-slate-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-slate-50 dark:shadow-black/30 lg:col-span-3">
              <CardContent className="flex items-center justify-center gap-3 py-16 text-slate-600 dark:text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando planos...
              </CardContent>
            </Card>
          ) : (
            data?.plans.map((plan) => {
              const isCurrent = data.currentSubscription?.plan_id === plan.id;

              return (
                <Card
                  key={plan.id}
                    className={`border shadow-xl shadow-slate-200/40 dark:shadow-black/30 ${isCurrent ? "border-orange-300/60 bg-orange-50/60 dark:border-orange-500/30 dark:bg-zinc-900" : "border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"}`}
                  >
                  <CardHeader className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <Badge variant="outline" className="border-slate-300 bg-white/80 text-slate-700 dark:border-zinc-700 dark:bg-black/15 dark:text-zinc-200">
                        {getPlanTypeLabel(plan.type)}
                      </Badge>
                      {isCurrent && (
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          Plano atual
                        </div>
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-3xl text-slate-900 dark:text-slate-50">{plan.name}</CardTitle>
                      <CardDescription className="mt-2 text-slate-600 dark:text-zinc-400">
                        {plan.description || "Assinatura recorrente com checkout transparente dentro do painel."}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <div className="text-4xl font-semibold">{formatCurrency(Number(plan.price))}</div>
                      <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">Renovação a cada {plan.billing_days} dias.</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-zinc-800 dark:bg-black/15 dark:text-zinc-300">
                      <p>Loja autenticada: {tenantId}</p>
                      <p className="mt-2">O fluxo consolidado de renovação será aberto com o plano já selecionado.</p>
                    </div>

                    <Button
                      type="button"
                      className="w-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                      onClick={() => navigate(`/admin/profile?tab=plans&billing=renew&planId=${plan.id}`)}
                    >
                      Assinar agora
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}



