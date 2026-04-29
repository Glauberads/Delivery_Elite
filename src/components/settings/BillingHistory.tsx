import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
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
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function translateBillingStatus(value?: string | null) {
  switch (String(value ?? "").toLowerCase()) {
    case "paid":
      return "Pago";
    case "pending":
      return "Pendente";
    case "failed":
      return "Falhou";
    case "refunded":
      return "Estornado";
    default:
      return value ?? "-";
  }
}

export function BillingHistory() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;

  const { data = [], isLoading } = useQuery({
    queryKey: ["tenant", "billing-history", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      if (!tenantId) {
        return [];
      }

      const { data, error } = await supabase
        .from("tenant_billing_history")
        .select("id, created_at, description, amount, status")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });

  return (
    <Card className="border-slate-200/80 bg-slate-100/90 text-slate-900 shadow-xl shadow-slate-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:shadow-black/20">
      <CardHeader>
        <CardTitle className="text-slate-900 dark:text-slate-50">Histórico de Transações</CardTitle>
        <CardDescription className="text-slate-600 dark:text-zinc-400">
          Acompanhe os pagamentos e cobranças da assinatura.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200 dark:border-zinc-800">
              <TableHead className="text-slate-600 dark:text-zinc-400">Data do Pagamento</TableHead>
              <TableHead className="text-slate-600 dark:text-zinc-400">Descrição</TableHead>
              <TableHead className="text-slate-600 dark:text-zinc-400">Valor</TableHead>
              <TableHead className="text-slate-600 dark:text-zinc-400">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="border-slate-200 dark:border-zinc-800">
                <TableCell colSpan={4} className="py-10 text-center text-slate-500 dark:text-zinc-500">
                  Carregando transações...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow className="border-slate-200 dark:border-zinc-800">
                <TableCell colSpan={4} className="py-10 text-center text-slate-500 dark:text-zinc-500">
                  Nenhuma transação encontrada.
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow key={item.id} className="border-slate-200 dark:border-zinc-800">
                  <TableCell className="text-slate-600 dark:text-zinc-300">{formatDate(item.created_at)}</TableCell>
                  <TableCell className="text-slate-800 dark:text-zinc-200">{item.description || "Assinatura"}</TableCell>
                  <TableCell className="font-medium text-slate-900 dark:text-zinc-100">{formatCurrency(Number(item.amount ?? 0))}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        String(item.status ?? "").toLowerCase() === "paid"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "border-slate-300 text-slate-600 dark:border-zinc-700 dark:text-zinc-300"
                      }
                    >
                      {translateBillingStatus(item.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}



