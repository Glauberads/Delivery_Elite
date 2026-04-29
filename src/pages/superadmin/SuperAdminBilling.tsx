import { useQuery } from "@tanstack/react-query";
import { CreditCard, Receipt, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function SuperAdminBilling() {
  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "billing"],
    queryFn: async () => {
      const [billingsResult, subscriptionsResult, tenantsResult, plansResult] = await Promise.all([
        supabase
          .from("tenant_billing_history")
          .select("id, tenant_id, plan_id, amount, status, payment_method, due_date, paid_at, created_at"),
        supabase.from("tenant_subscriptions").select("tenant_id, plan_id, status, current_period_end"),
        supabase.from("tenants").select("id, name, email"),
        supabase.from("plans").select("id, name, price"),
      ]);

      if (billingsResult.error) throw billingsResult.error;
      if (subscriptionsResult.error) throw subscriptionsResult.error;
      if (tenantsResult.error) throw tenantsResult.error;
      if (plansResult.error) throw plansResult.error;

      return {
        billings: billingsResult.data ?? [],
        subscriptions: subscriptionsResult.data ?? [],
        tenants: tenantsResult.data ?? [],
        plans: plansResult.data ?? [],
      };
    },
  });

  const paidTotal = data?.billings.filter((item) => item.status === "paid").reduce((sum, item) => sum + Number(item.amount), 0) ?? 0;
  const pendingTotal =
    data?.billings.filter((item) => item.status === "pending").reduce((sum, item) => sum + Number(item.amount), 0) ?? 0;
  const activeSubscriptions = data?.subscriptions.filter((item) => item.status === "active" || item.status === "trialing").length ?? 0;

  const rows = (data?.subscriptions ?? []).map((subscription) => {
    const tenant = data?.tenants.find((item) => item.id === subscription.tenant_id);
    const plan = data?.plans.find((item) => item.id === subscription.plan_id);
    const lastBilling = data?.billings
      .filter((item) => item.tenant_id === subscription.tenant_id)
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0];

    return {
      tenantName: tenant?.name ?? "Tenant",
      tenantEmail: tenant?.email ?? "-",
      planName: plan?.name ?? "Sem plano",
      planPrice: plan ? formatCurrency(Number(plan.price)) : "-",
      subscriptionStatus: subscription.status ?? "unknown",
      billingStatus: lastBilling?.status ?? "sem cobrança",
      billingAmount: lastBilling ? formatCurrency(Number(lastBilling.amount)) : "-",
      dueDate: lastBilling?.due_date ? new Date(lastBilling.due_date).toLocaleDateString("pt-BR") : "-",
      periodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end).toLocaleDateString("pt-BR")
        : "-",
    };
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Faturamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">Assinaturas, vencimentos e histórico de cobranças</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60 bg-card text-card-foreground">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Recebido</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="text-2xl font-bold">{isLoading ? "..." : formatCurrency(paidTotal)}</CardContent>
        </Card>
        <Card className="border-border/60 bg-card text-card-foreground">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pendente</CardTitle>
            <Receipt className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent className="text-2xl font-bold">{isLoading ? "..." : formatCurrency(pendingTotal)}</CardContent>
        </Card>
        <Card className="border-border/60 bg-card text-card-foreground">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Assinaturas Ativas</CardTitle>
            <CreditCard className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent className="text-2xl font-bold">{isLoading ? "..." : activeSubscriptions}</CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card text-card-foreground">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground">Resumo por tenant</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/60">
                <TableHead>Restaurante</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Assinatura</TableHead>
                <TableHead>Cobrança</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Fim do período</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-border/60">
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Carregando faturamento...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="border-border/60">
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nenhuma assinatura encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={`${row.tenantName}-${row.planName}`} className="border-border/60">
                    <TableCell>
                      <div className="font-medium">{row.tenantName}</div>
                      <div className="text-xs text-muted-foreground">{row.tenantEmail}</div>
                    </TableCell>
                    <TableCell>
                      <div>{row.planName}</div>
                      <div className="text-xs text-muted-foreground">{row.planPrice}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-border text-foreground">
                        {row.subscriptionStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.billingStatus === "paid"
                            ? "border-emerald-500/40 text-emerald-300"
                            : row.billingStatus === "pending"
                            ? "border-amber-500/40 text-amber-300"
                            : "border-border text-muted-foreground"
                        }
                      >
                        {row.billingStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.billingAmount}</TableCell>
                    <TableCell>{row.dueDate}</TableCell>
                    <TableCell>{row.periodEnd}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}



