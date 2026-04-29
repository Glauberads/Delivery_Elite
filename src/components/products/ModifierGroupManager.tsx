import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, AlertCircle, Layers, FolderOpen } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type BehaviorType = "checkbox" | "stepper" | "fractional";
type PricingRule = "sum" | "highest";

export interface ModifierGroup {
  id: string;
  name: string;
  min_options: number;
  max_options: number | null;
  pricing_rule: PricingRule;
  behavior_type: BehaviorType;
  max_per_item: number;
  display_order: number;
}

interface GroupWithRelations extends ModifierGroup {
  category_ids: string[];
}

interface Category { id: string; name: string; }

// ─── Mapeamento de comportamento → label ──────────────────────────────────────

const BEHAVIOR_LABELS: Record<BehaviorType, string> = {
  checkbox:   "Adicionais / Extras",
  stepper:    "Acompanhamentos",
  fractional: "Combinar Sabores",
};

// ─── Form vazio ───────────────────────────────────────────────────────────────

const emptyForm = (): Omit<GroupWithRelations, "id" | "display_order"> => ({
  name: "",
  min_options: 0,
  max_options: null,
  pricing_rule: "sum",
  behavior_type: "checkbox",
  max_per_item: 1,
  category_ids: [],
});

// ─── Componente ───────────────────────────────────────────────────────────────

export function ModifierGroupManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<ModifierGroup | null>(null);

  const tenantId = user?.tenantId;

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: groups = [], isLoading } = useQuery<ModifierGroup[]>({
    queryKey: ["modifier_groups", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modifier_groups")
        .select("id, name, min_options, max_options, pricing_rule, behavior_type, max_per_item, display_order")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories").select("id, name")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const fetchRelations = async (groupId: string): Promise<{ category_ids: string[] }> => {
    const { data } = await supabase
      .from("category_modifier_groups").select("category_id").eq("group_id", groupId);
    return { category_ids: (data ?? []).map((r) => r.category_id) };
  };

  // ─── Mutações ──────────────────────────────────────────────────────────────

  const invalidate = () => qc.invalidateQueries({ queryKey: ["modifier_groups"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Tenant não identificado.");
      if (!form.name.trim()) throw new Error("Nome do grupo é obrigatório.");

      const pricing_rule: PricingRule =
        form.behavior_type === "fractional" ? form.pricing_rule : form.pricing_rule;

      const payload = {
        tenant_id: tenantId,
        name: form.name.trim(),
        min_options: form.min_options,
        max_options: form.max_options ?? null,
        pricing_rule,
        behavior_type: form.behavior_type,
        max_per_item: form.behavior_type === "stepper" ? form.max_per_item : 1,
      };

      let groupId = editingId;

      if (editingId) {
        const { error } = await supabase.from("modifier_groups").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("modifier_groups").insert(payload).select("id").single();
        if (error) throw error;
        groupId = data.id;
      }

      await supabase.from("category_modifier_groups").delete().eq("group_id", groupId!);

      if (form.category_ids.length > 0) {
        const { error } = await supabase.from("category_modifier_groups").insert(
          form.category_ids.map((category_id) => ({
            tenant_id: tenantId, group_id: groupId!, category_id,
          }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? "Grupo atualizado" : "Grupo criado" });
      setDialogOpen(false);
      invalidate();
    },
    onError: (err: Error) =>
      toast({ variant: "destructive", title: "Erro", description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("modifier_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Grupo excluído" });
      setDeleteTarget(null);
      invalidate();
    },
    onError: (err: Error) =>
      toast({ variant: "destructive", title: "Erro ao excluir", description: err.message }),
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm(), name: BEHAVIOR_LABELS["checkbox"] });
    setDialogOpen(true);
  };

  const openEdit = async (group: ModifierGroup) => {
    const relations = await fetchRelations(group.id);
    setEditingId(group.id);
    setForm({
      name: group.name,
      min_options: group.min_options,
      max_options: group.max_options,
      pricing_rule: group.pricing_rule,
      behavior_type: group.behavior_type,
      max_per_item: group.max_per_item,
      ...relations,
    });
    setDialogOpen(true);
  };

  const toggleCategory = (id: string) =>
    setForm((p) => ({
      ...p,
      category_ids: p.category_ids.includes(id)
        ? p.category_ids.filter((x) => x !== id)
        : [...p.category_ids, id],
    }));

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Grupos de Modificadores</h2>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Grupo
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando grupos...</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 border rounded-md bg-muted/20">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-2 text-lg font-medium">Nenhum grupo cadastrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie grupos como "Sabores", "Acompanhamentos" ou "Extras".
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {groups.map((group) => (
            <Card key={group.id} className="border-border">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{group.name}</span>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {BEHAVIOR_LABELS[group.behavior_type]}
                    </Badge>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {group.min_options}–{group.max_options ?? "∞"}
                    </span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="outline" size="icon" onClick={() => openEdit(group)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => setDeleteTarget(group)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Grupo" : "Novo Grupo"}</DialogTitle>
            <DialogDescription className="hidden">Modal de Grupo</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* 1. Tipo de Regra */}
            <div className="space-y-2">
              <Label>Tipo de Regra</Label>
              <Select
                value={form.behavior_type}
                onValueChange={(v: BehaviorType) =>
                  setForm((p) => ({
                    ...p,
                    behavior_type: v,
                    pricing_rule: v === "fractional" ? "highest" : "sum",
                    name: p.name === "" || Object.values(BEHAVIOR_LABELS).includes(p.name)
                      ? BEHAVIOR_LABELS[v]
                      : p.name,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checkbox">Adicionais / Extras</SelectItem>
                  <SelectItem value="stepper">Acompanhamentos</SelectItem>
                  <SelectItem value="fractional">Mesclar Sabores</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.behavior_type === "checkbox" && "Ex: Selecione os Molhos"}
                {form.behavior_type === "stepper"   && "Ex: Adicionar +1 Carne"}
                {form.behavior_type === "fractional" && "Ex: Pizza Meio a Meio"}
              </p>
            </div>

            {/* 2. Nome */}
            <div className="space-y-2">
              <Label>Nome do Grupo</Label>
              <Input
                placeholder="Ex: Sabores da Pizza"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            {/* Mínimo, Máximo e Regra — grid 4 colunas (50/25/25) no fractional */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Regra de cobrança — col-span-2 (50%) só no fractional */}
              {form.behavior_type === "fractional" && (
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Regra de Cobrança</Label>
                  <Select
                    value={form.pricing_rule}
                    onValueChange={(v: PricingRule) => setForm((p) => ({ ...p, pricing_rule: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="highest">Mais caro</SelectItem>
                      <SelectItem value="sum">Preço médio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2 md:col-span-1">
                <Label className="text-xs text-muted-foreground">Mínimo</Label>
                <Input
                  type="number" min={0}
                  value={form.min_options}
                  onChange={(e) => setForm((p) => ({ ...p, min_options: parseInt(e.target.value) || 0 }))}
                />
              </div>

              <div className="space-y-2 md:col-span-1">
                <Label className="text-xs text-muted-foreground">
                  {form.behavior_type === "fractional" ? "Máximo" : "Máximo"}
                </Label>
                <Input
                  type="number"
                  min={form.behavior_type === "fractional" ? 2 : 0}
                  max={form.behavior_type === "fractional" ? 4 : undefined}
                  placeholder={form.behavior_type === "fractional" ? "2–4" : "Ilimitado"}
                  value={form.max_options ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      max_options: e.target.value === "" ? null : parseInt(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            {/* Categorias — só para fractional */}
            {form.behavior_type === "fractional" && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Categorias para Combinar
                </Label>
                <p className="text-xs text-muted-foreground">
                  Selecione quais categorias entram na regra de combinação (ex: Pizza "meio a meio").
                </p>
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground border rounded-md p-3">
                    Nenhuma categoria cadastrada.
                  </p>
                ) : (
                  <div className="border rounded-md p-3 grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {categories.map((cat) => (
                      <label
                        key={cat.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 rounded px-2 py-1"
                      >
                        <Checkbox
                          checked={form.category_ids.includes(cat.id)}
                          onCheckedChange={() => toggleCategory(cat.id)}
                        />
                        <span className="text-sm truncate">{cat.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : editingId ? "Salvar Alterações" : "Criar Grupo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Confirm delete ───────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir grupo "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os vínculos com categorias serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



