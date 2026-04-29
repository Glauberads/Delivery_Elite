import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PlanType = "monthly" | "quarterly" | "annual";

type PlanRecord = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  type: PlanType;
  billing_days: number;
  active: boolean | null;
};

type PlanForm = {
  id: string | null;
  name: string;
  description: string;
  price: number | null;
  type: PlanType;
  active: boolean;
};

const emptyForm: PlanForm = {
  id: null,
  name: "",
  description: "",
  price: null,
  type: "monthly",
  active: true,
};

function getBillingDays(type: PlanType) {
  if (type === "quarterly") return 90;
  if (type === "annual") return 365;
  return 30;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatPlanType(type: PlanType) {
  if (type === "annual") return "Anual";
  if (type === "quarterly") return "Trimestral";
  return "Mensal";
}

function formatCurrencyInput(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function parseCurrencyInput(rawValue: string) {
  const digits = rawValue.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  return Number(digits) / 100;
}

export default function SuperAdminPlans() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data: plans = [], isLoading } = useQuery<PlanRecord[]>({
    queryKey: ["superadmin", "plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name, description, price, type, billing_days, active")
        .order("price", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  const sortedPlans = useMemo(
    () => [...plans].sort((left, right) => Number(left.price) - Number(right.price)),
    [plans]
  );

  const resetForm = () => {
    setForm(emptyForm);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (plan: PlanRecord) => {
    setForm({
      id: plan.id,
      name: plan.name,
      description: plan.description ?? "",
      price: Number(plan.price ?? 0),
      type: plan.type,
      active: plan.active !== false,
    });
    setIsDialogOpen(true);
  };

  const savePlan = async () => {
    const name = form.name.trim();
    const price = form.price;

    if (!name) {
      toast({
        variant: "destructive",
        title: "Nome obrigatório",
        description: "Informe o nome do plano.",
      });
      return;
    }

    if (price === null || !Number.isFinite(price) || price < 0) {
      toast({
        variant: "destructive",
        title: "Valor inválido",
        description: "Informe um valor válido para o plano.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        name,
        description: form.description.trim() || null,
        price,
        type: form.type,
        billing_days: getBillingDays(form.type),
        active: form.active,
      };

      if (form.id) {
        const { error } = await supabase.from("plans").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plans").insert(payload);
        if (error) throw error;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["superadmin", "plans"] }),
        queryClient.invalidateQueries({ queryKey: ["checkout", "plans"] }),
      ]);

      toast({
        title: form.id ? "Plano atualizado" : "Plano criado",
        description: "As alterações foram salvas na tabela public.plans.",
      });

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar plano",
        description: error instanceof Error ? error.message : "Falha inesperada ao salvar o plano.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Planos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie os planos que aparecem no checkout do sistema.</p>
        </div>
        <Button type="button" onClick={openCreateDialog} className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Novo plano
        </Button>
      </div>

      <Card className="border-border/60 bg-card text-card-foreground">
        <CardHeader>
          <CardTitle>Planos cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Plano</TableHead>
                  <TableHead className="text-muted-foreground">Valor</TableHead>
                  <TableHead className="text-muted-foreground">Intervalo</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-right text-muted-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow className="border-border/60">
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Carregando planos...
                    </TableCell>
                  </TableRow>
                ) : sortedPlans.length === 0 ? (
                  <TableRow className="border-border/60">
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhum plano cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedPlans.map((plan) => (
                    <TableRow key={plan.id} className="border-border/60">
                      <TableCell>
                        <div>
                          <p className="font-medium">{plan.name}</p>
                          <p className="text-xs text-muted-foreground">{plan.description || "Sem descrição"}</p>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(Number(plan.price))}</TableCell>
                      <TableCell>{formatPlanType(plan.type)}</TableCell>
                      <TableCell>{plan.active === false ? "Inativo" : "Ativo"}</TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleEdit(plan)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-4 md:hidden">
            {isLoading ? (
              <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                Carregando planos...
              </div>
            ) : sortedPlans.length === 0 ? (
              <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum plano cadastrado.
              </div>
            ) : (
              sortedPlans.map((plan) => (
                <div key={plan.id} className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{plan.name}</p>
                    <p className="text-sm text-muted-foreground">{plan.description || "Sem descrição"}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Valor</p>
                      <p className="mt-1 text-foreground">{formatCurrency(Number(plan.price))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Intervalo</p>
                      <p className="mt-1 text-foreground">{formatPlanType(plan.type)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <p className="mt-1 text-foreground">{plan.active === false ? "Inativo" : "Ativo"}</p>
                    </div>
                  </div>

                  <Button type="button" variant="outline" className="w-full" onClick={() => handleEdit(plan)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open && !isSaving) {
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar plano" : "Novo plano"}</DialogTitle>
            <DialogDescription>
              Defina os dados do plano e salve para refletir no checkout da plataforma.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="plan-name">Nome</Label>
              <Input
                id="plan-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="bg-background dark:bg-secondary text-foreground border-border"
                placeholder="Ex: Plano Mensal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-description">Descrição</Label>
              <Textarea
                id="plan-description"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                className="bg-background dark:bg-secondary text-foreground border-border min-h-[120px]"
                placeholder="Descreva o que este plano oferece."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plan-price">Valor</Label>
                <Input
                  id="plan-price"
                  value={formatCurrencyInput(form.price)}
                  onChange={(event) => setForm((prev) => ({ ...prev, price: parseCurrencyInput(event.target.value) }))}
                  className="bg-background dark:bg-secondary text-foreground border-border"
                  placeholder="R$ 0,00"
                  inputMode="numeric"
                />
              </div>

              <div className="space-y-2">
                <Label>Intervalo</Label>
                <Select value={form.type} onValueChange={(value: PlanType) => setForm((prev) => ({ ...prev, type: value }))}>
                  <SelectTrigger className="bg-background dark:bg-secondary text-foreground border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background dark:bg-secondary text-foreground border-border">
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Plano ativo</p>
                <p className="text-xs text-muted-foreground">Somente planos ativos aparecem no checkout.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, active: checked }))} />
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                resetForm();
              }}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={savePlan} disabled={isSaving} className="bg-orange-500 hover:bg-orange-600 text-white">
              {isSaving ? "Salvando..." : form.id ? "Salvar alterações" : "Criar plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



