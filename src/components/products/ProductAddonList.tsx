import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ProductAddonForm } from "./ProductAddonForm";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Layers, LayoutGrid } from "lucide-react";
import { ProductAddon } from "@/types";
import type { ModifierGroup, BehaviorType } from "./ModifierGroupManager";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BEHAVIOR_LABELS: Record<BehaviorType, string> = {
  checkbox:   "Adicionais / Extras",
  stepper:    "Acompanhamentos",
  fractional: "Mesclar Sabores",
};

const BEHAVIOR_COLORS: Record<BehaviorType, string> = {
  checkbox:   "bg-blue-50 text-blue-700 border-blue-200",
  stepper:    "bg-purple-50 text-purple-700 border-purple-200",
  fractional: "bg-orange-50 text-orange-700 border-orange-200",
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// ─── Card: checkbox / stepper ─────────────────────────────────────────────────

function AddonGroupCard({ group, onRefetch }: { group: ModifierGroup; onRefetch: () => void }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProductAddon | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<ProductAddon | null>(null);

  const { data: addons = [], refetch } = useQuery<ProductAddon[]>({
    queryKey: ["group_addons", group.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_attributes")
        .select("display_order, product_addons(id, name, description, price, available, is_global, max_options)")
        .eq("group_id", group.id)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => r.product_addons)
        .filter(Boolean)
        .map((a: any) => ({
          id: a.id, name: a.name,
          description: a.description ?? undefined,
          price: a.price, available: a.available,
          isGlobal: a.is_global, maxOptions: a.max_options,
        }));
    },
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("product_addons").delete().eq("id", deleteTarget.id);
    if (error) toast({ variant: "destructive", title: "Erro ao excluir", description: error.message });
    else { toast({ title: "Atributo excluído" }); refetch(); onRefetch(); }
    setDeleteTarget(null);
  };

  return (
    <Card className="border-border shadow-sm">
      {/* Cabeçalho */}
      <CardHeader className="py-3 px-4 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-semibold truncate">{group.name}</span>
            <Badge variant="outline" className={`text-xs shrink-0 ${BEHAVIOR_COLORS[group.behavior_type]}`}>
              {BEHAVIOR_LABELS[group.behavior_type]}
            </Badge>
            <span className="text-xs text-muted-foreground shrink-0">
              {group.min_options}–{group.max_options ?? "∞"}
            </span>
          </div>
          <Button size="sm" className="gap-1 shrink-0"
            onClick={() => { setEditing(undefined); setShowForm(true); }}>
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
      </CardHeader>

      {/* Corpo */}
      <CardContent className="p-0">
        {addons.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhum item neste grupo.{" "}
            <button
              className="underline underline-offset-2 hover:text-foreground transition-colors"
              onClick={() => { setEditing(undefined); setShowForm(true); }}
            >
              Adicionar agora
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {addons.map((addon) => (
              <div key={addon.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-medium truncate">{addon.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{fmt(addon.price)}</span>
                  {!addon.available && (
                    <Badge variant="secondary" className="text-xs shrink-0">Indisponível</Badge>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon"
                    onClick={() => { setEditing(addon); setShowForm(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(addon)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ProductAddonForm
        addon={editing} open={showForm} onOpenChange={setShowForm}
        groupId={editing ? undefined : group.id}
        onSave={() => { refetch(); onRefetch(); }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── Card: fractional (Mesclar Sabores) ──────────────────────────────────────

interface CategoryRow { id: string; name: string; }
interface ProductRow  { id: string; name: string; category_id: string | null; }

function FractionalGroupCard({ group }: { group: ModifierGroup }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [toggling, setToggling] = useState<string | null>(null); // product_id em loading

  // IDs excluídos da mescla para este grupo
  const { data: excludedIds = [], refetch: refetchExclusions } = useQuery<string[]>({
    queryKey: ["fractional_exclusions", group.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fractional_exclusions")
        .select("product_id")
        .eq("group_id", group.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.product_id);
    },
  });

  const handleToggle = async (productId: string, currentlyAllowed: boolean) => {
    setToggling(productId);
    try {
      if (currentlyAllowed) {
        // Desativar → INSERT na tabela de exclusões
        const { error } = await supabase.from("fractional_exclusions").insert({
          tenant_id: user!.tenantId,
          group_id: group.id,
          product_id: productId,
        });
        if (error) throw error;
      } else {
        // Reativar → DELETE da tabela de exclusões
        const { error } = await supabase
          .from("fractional_exclusions")
          .delete()
          .eq("group_id", group.id)
          .eq("product_id", productId);
        if (error) throw error;
      }
      toast({ title: "Status atualizado" });
      refetchExclusions();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao atualizar", description: err.message });
    } finally {
      setToggling(null);
    }
  };

  const { data: linkedCategoryIds = [] } = useQuery<string[]>({
    queryKey: ["group_categories", group.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_modifier_groups").select("category_id").eq("group_id", group.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.category_id);
    },
  });

  const { data: categories = [] } = useQuery<CategoryRow[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery<ProductRow[]>({
    queryKey: ["products_fractional", linkedCategoryIds],
    enabled: linkedCategoryIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products").select("id, name, category_id")
        .in("category_id", linkedCategoryIds).eq("available", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const linkedCategories = categories.filter((c) => linkedCategoryIds.includes(c.id));

  const pricingLabel =
    group.pricing_rule === "highest" ? "Mais caro"
    : "Preço médio";

  return (
    <Card className="border-border shadow-sm">
      {/* Cabeçalho */}
      <CardHeader className="py-3 px-4 border-b bg-muted/20">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-semibold truncate">{group.name}</span>
          <Badge variant="outline" className={`text-xs shrink-0 ${BEHAVIOR_COLORS.fractional}`}>
            Mesclar Sabores
          </Badge>
          <Badge variant="secondary" className="text-xs shrink-0">{pricingLabel}</Badge>
          {group.max_options && (
            <span className="text-xs text-muted-foreground shrink-0">
              até {group.max_options} frações
            </span>
          )}
        </div>
      </CardHeader>

      {/* Corpo */}
      <CardContent className="p-4 space-y-5">
        {linkedCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma categoria vinculada. Edite o grupo na aba "Grupos" para adicionar categorias.
          </p>
        ) : (
          linkedCategories.map((cat) => {
            const catProducts = products.filter((p) => p.category_id === cat.id);
            return (
              <div key={cat.id}>
                {/* Sub-cabeçalho da categoria */}
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 pb-1 border-b">
                  {cat.name}
                </p>
                {catProducts.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-1">
                    Nenhum produto disponível nesta categoria.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {catProducts.map((prod) => {
                      const isAllowed = !excludedIds.includes(prod.id);
                      const isLoading = toggling === prod.id;
                      return (
                        <div
                          key={prod.id}
                          className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/30 transition-colors"
                        >
                          <span className={`text-sm truncate pr-2 ${!isAllowed ? "text-muted-foreground line-through" : ""}`}>
                            {prod.name}
                          </span>
                          <Switch
                            checked={isAllowed}
                            disabled={isLoading}
                            onCheckedChange={() => handleToggle(prod.id, isAllowed)}
                            aria-label={`Permitir ${prod.name} na mescla`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// ─── Componente principal (Tab 3) ─────────────────────────────────────────────

export function ProductAddonList() {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const { data: groups = [], isLoading, refetch } = useQuery<ModifierGroup[]>({
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

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando atributos...</div>;
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-xl bg-muted/10 text-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <LayoutGrid className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-base">Nenhum grupo criado ainda</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Vá até a aba <span className="font-medium text-foreground">Grupos</span> e crie
            um grupo para começar a organizar seus atributos aqui.
          </p>
        </div>
      </div>
    );
  }

  const BEHAVIOR_ORDER: Record<BehaviorType, number> = { checkbox: 0, stepper: 1, fractional: 2 };

  const sorted = [...groups].sort(
    (a, b) => BEHAVIOR_ORDER[a.behavior_type] - BEHAVIOR_ORDER[b.behavior_type]
  );

  return (
    <div className="space-y-4">
      {sorted.map((group) =>
        group.behavior_type === "fractional" ? (
          <FractionalGroupCard key={group.id} group={group} />
        ) : (
          <AddonGroupCard key={group.id} group={group} onRefetch={refetch} />
        )
      )}
    </div>
  );
}



