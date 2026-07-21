import { useQuery } from "@tanstack/react-query";
import { BarChart3, CreditCard, Store, TrendingUp, Users, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "next-themes";

type TenantStatus = "trialing" | "active" | "suspended" | "cancelled";
type PlanType = "monthly" | "quarterly" | "annual";
type SubscriptionStatus = "active" | "past_due" | "canceled" | "trialing";

interface DashboardPayload {
  tenants: Array<{ id: string; created_at: string | null; status: TenantStatus | null }>;
  plans: Array<{ id: string; name: string; type: PlanType; price: number }>;
  subscriptions: Array<{ tenant_id: string; plan_id: string; status: SubscriptionStatus | null }>;
  billings: Array<{ amount: number; status: string; created_at: string | null }>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="border-border/60 bg-card text-card-foreground">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600/15">
          <Icon className="h-4 w-4 text-orange-400" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function getMonthlyRecurringValue(price: number, type: PlanType) {
  if (type === "quarterly") return price / 3;
  if (type === "annual") return price / 12;
  return price;
}

function getLastSixMonthsLabels() {
  const months: Array<{ key: string; label: string }> = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setMonth(date.getMonth() - offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("pt-BR", { month: "short" });
    months.push({ key, label: label.replace(".", "") });
  }

  return months;
}

export default function SuperAdminDashboard() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { data, isLoading } = useQuery<DashboardPayload>({
    queryKey: ["superadmin", "dashboard"],
    queryFn: async () => {
      const [tenantsResult, plansResult, subscriptionsResult, billingsResult] = await Promise.all([
        supabase.from("tenants").select("id, created_at, status"),
        supabase.from("plans").select("id, name, type, price"),
        supabase.from("tenant_subscriptions").select("tenant_id, plan_id, status"),
        supabase.from("tenant_billing_history").select("amount, status, created_at"),
      ]);

      if (tenantsResult.error) throw tenantsResult.error;
      if (plansResult.error) throw plansResult.error;
      if (subscriptionsResult.error) throw subscriptionsResult.error;
      if (billingsResult.error) throw billingsResult.error;

      return {
        tenants: tenantsResult.data ?? [],
        plans: plansResult.data ?? [],
        subscriptions: subscriptionsResult.data ?? [],
        billings: billingsResult.data ?? [],
      };
    },
  });

  const planMap = new Map((data?.plans ?? []).map((plan) => [plan.id, plan]));
  const activeTenants =
    data?.tenants.filter((tenant) => tenant.status === "active" || tenant.status === "trialing").length ?? 0;
  const delinquentTenants =
    data?.subscriptions.filter((subscription) => subscription.status === "past_due").length ?? 0;
  const totalRevenue =
    data?.billings
      .filter((billing) => billing.status === "paid")
      .reduce((sum, billing) => sum + Number(billing.amount), 0) ?? 0;
  const mrr =
    data?.subscriptions.reduce((sum, subscription) => {
      if (!subscription.status || !["active", "trialing", "past_due"].includes(subscription.status)) {
        return sum;
      }

      const plan = planMap.get(subscription.plan_id);
      if (!plan) {
        return sum;
      }

      return sum + getMonthlyRecurringValue(Number(plan.price), plan.type);
    }, 0) ?? 0;

  const monthBuckets = getLastSixMonthsLabels();
  const growthMap = new Map(monthBuckets.map((month) => [month.key, { month: month.label, tenants: 0, revenue: 0 }]));

  (data?.tenants ?? []).forEach((tenant) => {
    if (!tenant.created_at) return;
    const date = new Date(tenant.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = growthMap.get(key);
    if (bucket) {
      bucket.tenants += 1;
    }
  });

  (data?.billings ?? []).forEach((billing) => {
    if (!billing.created_at || billing.status !== "paid") return;
    const date = new Date(billing.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = growthMap.get(key);
    if (bucket) {
      bucket.revenue += Number(billing.amount);
    }
  });

  const chartData = Array.from(growthMap.values());
  const chartGridStroke = isDark ? "#27272a" : "#e4e4e7";
  const chartAxisStroke = isDark ? "#a1a1aa" : "#71717a";
  const chartTooltipStyle = {
    backgroundColor: isDark ? "#09090b" : "#ffffff",
    border: `1px solid ${isDark ? "#27272a" : "#e4e4e7"}`,
    borderRadius: 12,
    color: isDark ? "#f4f4f5" : "#18181b",
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Visão geral da plataforma VipDelivery</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Restaurantes Ativos"
          value={isLoading ? "..." : activeTenants}
          description="Tenants em trial ou ativos"
          icon={Store}
        />
        <StatCard
          title="MRR Estimado"
          value={isLoading ? "..." : formatCurrency(mrr)}
          description="Receita mensal recorrente estimada"
          icon={TrendingUp}
        />
        <StatCard
          title="Faturamento Pago"
          value={isLoading ? "..." : formatCurrency(totalRevenue)}
          description="Total já compensado"
          icon={Wallet}
        />
        <StatCard
          title="Inadimplentes"
          value={isLoading ? "..." : delinquentTenants}
          description="Assinaturas em atraso"
          icon={CreditCard}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card text-card-foreground">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BarChart3 className="h-4 w-4 text-orange-400" />
              Crescimento de Restaurantes
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis dataKey="month" stroke={chartAxisStroke} />
                <YAxis stroke={chartAxisStroke} allowDecimals={false} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  cursor={{ fill: "rgba(249, 115, 22, 0.08)" }}
                />
                <Bar dataKey="tenants" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card text-card-foreground">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4 text-orange-400" />
              Receita Recebida por Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis dataKey="month" stroke={chartAxisStroke} />
                <YAxis stroke={chartAxisStroke} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={chartTooltipStyle}
                  cursor={{ fill: "rgba(249, 115, 22, 0.08)" }}
                />
                <Bar dataKey="revenue" fill="#fb923c" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



