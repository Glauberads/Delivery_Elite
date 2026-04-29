import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Edit, ExternalLink, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type TenantStatus = "trialing" | "active" | "suspended" | "cancelled";
type SubscriptionStatus = "active" | "past_due" | "canceled" | "trialing";

interface RestaurantRow {
  tenantId: string;
  slug: string;
  email: string;
  phone: string;
  password: string;
  status: TenantStatus;
  restaurantName: string;
  planId: string;
  planLabel: string;
  subscriptionStatus: SubscriptionStatus | "";
}

const emptyForm: RestaurantRow = {
  tenantId: "",
  slug: "",
  email: "",
  phone: "",
  password: "",
  status: "trialing",
  restaurantName: "",
  planId: "",
  planLabel: "",
  subscriptionStatus: "trialing",
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHATSAPP_PATTERN = /^55\d{11}$/;
const formFieldClassName =
  "border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-orange-500/40 focus-visible:ring-offset-0";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  return local ? `55${local}` : "";
}

function formatWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  const ddd = local.slice(0, 2);
  const first = local.slice(2, 7);
  const second = local.slice(7, 11);

  let formatted = "55";
  if (ddd) formatted += ` (${ddd}`;
  if (ddd.length === 2) formatted += ")";
  if (first) formatted += ` ${first}`;
  if (second) formatted += `-${second}`;
  return formatted.trim();
}

function validateFormData(formData: RestaurantRow) {
  const isCreating = !formData.tenantId;
  const restaurantName = formData.restaurantName.trim();
  const slug = slugify(formData.slug);
  const email = formData.email.trim().toLowerCase();
  const phone = normalizeWhatsapp(formData.phone);
  const password = formData.password.trim();

  if (!restaurantName) return "Informe o nome do restaurante.";
  if (restaurantName.length < 2) return "O nome do restaurante precisa ter pelo menos 2 caracteres.";
  if (!slug) return "Informe um slug válido para o restaurante.";
  if (!SLUG_PATTERN.test(slug)) return "O slug deve conter apenas letras minúsculas, números e hífens.";
  if (!email) return "Informe o email principal do restaurante.";
  if (!EMAIL_PATTERN.test(email)) return "Informe um email válido.";
  if (!phone) return "Informe o WhatsApp principal do restaurante.";
  if (!WHATSAPP_PATTERN.test(phone)) return "Use o formato 55 (xx)xxxxx-xxxx para o WhatsApp.";
  if (isCreating && !password) return "Informe uma senha de acesso para o novo restaurante.";
  if (password && password.length < 6) return "A senha precisa ter pelo menos 6 caracteres.";

  return null;
}

function getFriendlyErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Erro desconhecido ao salvar restaurante.";
  }

  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const code = "code" in error && typeof error.code === "string" ? error.code : "";

  if (code === "23505") {
    if (message.includes("tenants_slug_key")) return "Este slug já está em uso por outro restaurante.";
    if (message.includes("tenants_email_key")) return "Este email já está em uso por outro restaurante.";
    return "Já existe um cadastro com esses dados.";
  }

  if (message.includes("superadmin_save_restaurant_with_owner")) {
    return "A migration de onboarding seguro ainda não foi aplicada no projeto Supabase conectado.";
  }

  return message || "Erro desconhecido ao salvar restaurante.";
}

function getDaysDifference(value?: string | null) {
  if (!value) {
    return 0;
  }

  const endDate = new Date(value);
  if (Number.isNaN(endDate.getTime())) {
    return 0;
  }

  return Math.ceil((endDate.getTime() - Date.now()) / (1000 * 3600 * 24));
}

function addDaysFromToday(days: number) {
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

export default function SuperAdminRestaurants() {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<RestaurantRow>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["superadmin", "restaurants"],
    queryFn: async () => {
      const [tenantsResult, plansResult, subscriptionsResult] = await Promise.all([
        supabase.from("tenants").select("id, name, slug, email, phone, status, plan_id, trial_ends_at").order("created_at", { ascending: false }),
        supabase.from("plans").select("id, name, type, price, billing_days"),
        supabase.from("tenant_subscriptions").select("tenant_id, plan_id, status, current_period_end"),
      ]);

      if (tenantsResult.error) throw tenantsResult.error;
      if (plansResult.error) throw plansResult.error;
      if (subscriptionsResult.error) throw subscriptionsResult.error;

      return {
        tenants: tenantsResult.data ?? [],
        plans: plansResult.data ?? [],
        subscriptions: subscriptionsResult.data ?? [],
      };
    },
  });

  const rows: RestaurantRow[] = (data?.tenants ?? []).map((tenant) => {
    const subscription = data?.subscriptions.find((item) => item.tenant_id === tenant.id);
    const plan = data?.plans.find((item) => item.id === (tenant.plan_id ?? subscription?.plan_id));

    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      email: tenant.email,
      phone: formatWhatsapp(tenant.phone ?? ""),
      password: "",
      status: (tenant.status as TenantStatus | null) ?? "trialing",
      restaurantName: tenant.name,
      planId: plan?.id ?? "",
      planLabel: plan ? `${plan.name} • R$ ${Number(plan.price).toFixed(2).replace(".", ",")}` : "Sem plano",
      subscriptionStatus: subscription?.status ?? "",
    };
  });

  const plans = data?.plans ?? [];

  useEffect(() => {
    if (!formOpen) {
      setFormData(emptyForm);
    }
  }, [formOpen]);

  const handleEdit = (row: RestaurantRow) => {
    setFormData(row);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setFormData(emptyForm);
    setFormOpen(true);
  };

  const saveTenant = async () => {
    const validationError = validateFormData(formData);
    if (validationError) {
      toast({
        variant: "destructive",
        title: "Validação inválida",
        description: validationError,
      });
      return;
    }

    setIsSaving(true);

    try {
      const restaurantName = formData.restaurantName.trim();
      const slug = slugify(formData.slug);
      const email = formData.email.trim().toLowerCase();
      const phone = normalizeWhatsapp(formData.phone) || null;
      const password = formData.password.trim() || null;
      const currentTenant = data?.tenants.find((tenant) => tenant.id === formData.tenantId);
      const currentSubscription = data?.subscriptions.find((item) => item.tenant_id === formData.tenantId);
      const currentPlanId = currentTenant?.plan_id ?? currentSubscription?.plan_id ?? null;
      const currentPlan = data?.plans.find((plan) => plan.id === currentPlanId);
      const nextPlan = data?.plans.find((plan) => plan.id === formData.planId);
      const shouldApplyProrata = Boolean(formData.tenantId && formData.planId && formData.planId !== currentPlanId && nextPlan);

      const { data: tenantId, error } = await supabase.rpc("superadmin_save_restaurant_with_owner", {
        p_tenant_id: formData.tenantId || null,
        p_restaurant_name: restaurantName,
        p_slug: slug,
        p_email: email,
        p_phone: phone,
        p_status: formData.status,
        p_plan_id: formData.planId || null,
        p_password: password,
      });

      if (error) throw error;

      if (shouldApplyProrata && tenantId) {
        const currentPlanDays = Number(currentPlan?.billing_days ?? 0);
        const daysRemaining = getDaysDifference(currentSubscription?.current_period_end ?? currentTenant?.trial_ends_at);
        const daysUsed = Math.max(0, currentPlanDays - daysRemaining);
        const nextPlanDays = Number(nextPlan?.billing_days ?? 0);
        const newDaysRemaining = nextPlanDays - daysUsed;
        const nextPeriodEndsAt = addDaysFromToday(newDaysRemaining);

        if (currentSubscription?.tenant_id) {
          const { error: subscriptionUpdateError } = await supabase
            .from("tenant_subscriptions")
            .update({
              plan_id: formData.planId,
              current_period_end: nextPeriodEndsAt,
            })
            .eq("tenant_id", tenantId);

          if (subscriptionUpdateError) {
            throw subscriptionUpdateError;
          }
        } else {
          const { error: tenantUpdateError } = await supabase
            .from("tenants")
            .update({
              plan_id: formData.planId,
              trial_ends_at: nextPeriodEndsAt,
            })
            .eq("id", tenantId);

          if (tenantUpdateError) {
            throw tenantUpdateError;
          }
        }
      }

      toast({
        title: tenantId === formData.tenantId ? "Restaurante atualizado" : "Restaurante criado",
        description: formData.tenantId
          ? "Os dados do restaurante e do acesso foram atualizados com sucesso."
          : "O restaurante foi criado com login por email e senha.",
      });

      setFormOpen(false);
      await refetch();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: getFriendlyErrorMessage(error),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTenant = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase.from("tenants").delete().eq("id", deleteId);
      if (error) throw error;

      toast({
        title: "Restaurante removido",
        description: "O tenant foi excluído com sucesso.",
      });

      setDeleteId(null);
      await refetch();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error instanceof Error ? error.message : "Erro desconhecido ao excluir tenant.",
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Restaurantes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cadastro, edição e gestão dos restaurantes da plataforma</p>
        </div>
        <Button onClick={handleCreate} className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Novo restaurante
        </Button>
      </div>

      <Card className="border-border/60 bg-card text-card-foreground">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground">Restaurantes cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isError && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error instanceof Error ? error.message : "Erro ao carregar restaurantes do superadmin."}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow className="border-border/60">
                <TableHead>ID</TableHead>
                <TableHead>Restaurante</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-border/60">
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Carregando restaurantes...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="border-border/60">
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nenhum tenant cadastrado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.tenantId} className="border-border/60">
                    <TableCell className="text-xs text-muted-foreground">{row.tenantId.slice(0, 8)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{row.restaurantName}</div>
                      <div className="text-xs text-muted-foreground">/{row.slug}</div>
                    </TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{row.phone || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.status === "active"
                            ? "border-emerald-500/40 text-emerald-300"
                            : row.status === "trialing"
                            ? "border-blue-500/40 text-blue-300"
                            : row.status === "suspended"
                            ? "border-amber-500/40 text-amber-300"
                            : "border-border text-muted-foreground"
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.planLabel}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="icon" onClick={() => handleEdit(row)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" asChild>
                          <a href={`/r/${row.slug}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => setDeleteId(row.tenantId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="border-border bg-background text-foreground sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formData.tenantId ? "Editar restaurante" : "Novo restaurante"}</DialogTitle>
          </DialogHeader>

          <div className="rounded-2xl border border-border/60 bg-muted/20 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="restaurant-name">Nome do restaurante</Label>
                <Input
                  id="restaurant-name"
                  className={formFieldClassName}
                  value={formData.restaurantName}
                  placeholder="Ex.: DelivMax Centro"
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      restaurantName: e.target.value,
                      slug: prev.tenantId ? prev.slug : slugify(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-email">Email</Label>
                <Input
                  id="tenant-email"
                  type="email"
                  className={formFieldClassName}
                  value={formData.email}
                  placeholder="contato@restaurante.com"
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-phone">WhatsApp</Label>
                <Input
                  id="tenant-phone"
                  className={formFieldClassName}
                  value={formData.phone}
                  placeholder="55 (11)99999-9999"
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      phone: formatWhatsapp(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-password">
                  {formData.tenantId ? "Nova senha de acesso" : "Senha de acesso"}
                </Label>
                <Input
                  id="tenant-password"
                  type="password"
                  className={formFieldClassName}
                  value={formData.password}
                  placeholder={formData.tenantId ? "Preencha para redefinir a senha" : "Mínimo 6 caracteres"}
                  onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(value: TenantStatus) => setFormData((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger className={formFieldClassName}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-background text-foreground">
                    <SelectItem value="trialing">trialing</SelectItem>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="suspended">suspended</SelectItem>
                    <SelectItem value="cancelled">cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={formData.planId || "none"} onValueChange={(value) => setFormData((prev) => ({ ...prev, planId: value === "none" ? "" : value }))}>
                  <SelectTrigger className={formFieldClassName}>
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-background text-foreground">
                    <SelectItem value="none">Sem plano</SelectItem>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} • R$ {Number(plan.price).toFixed(2).replace(".", ",")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="border-border bg-background text-foreground hover:bg-muted"
              onClick={() => setFormOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={saveTenant} disabled={isSaving} className="bg-orange-500 hover:bg-orange-600 text-white">
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="border-border bg-background text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir restaurante</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta ação remove o tenant e os dados relacionados do banco. Use apenas quando isso for intencional.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={deleteTenant}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



