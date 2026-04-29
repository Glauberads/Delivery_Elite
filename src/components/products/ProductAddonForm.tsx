import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ProductAddon } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface ProductAddonFormProps {
  addon?: ProductAddon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  groupId?: string; // quando fornecido, vincula o atributo ao grupo via group_attributes
}

const emptyForm = () => ({
  name: "",
  description: "",
  price: "",
  max_options: "",
  available: true,
  is_global: false,
});

function formatPrice(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(digits) / 100
  );
}

function parsePrice(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
}

export function ProductAddonForm({ addon, open, onOpenChange, onSave, groupId }: ProductAddonFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if (open) {
      setForm(
        addon
          ? {
              name: addon.name,
              description: addon.description ?? "",
              price: formatPrice(String(Math.round(addon.price * 100))),
              max_options: addon.maxOptions != null ? String(addon.maxOptions) : "",
              available: addon.available,
              is_global: addon.isGlobal ?? false,
            }
          : emptyForm()
      );
    }
  }, [open, addon]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Nome é obrigatório" });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parsePrice(form.price),
        max_options: form.max_options !== "" ? parseInt(form.max_options) : null,
        available: form.available,
        is_global: form.is_global,
      };

      if (addon?.id) {
        const { error } = await supabase.from("product_addons").update(payload).eq("id", addon.id);
        if (error) throw error;
        toast({ title: "Atributo atualizado" });
      } else {
        if (!user?.tenantId) throw new Error("Tenant não identificado.");

        const { data: inserted, error } = await supabase
          .from("product_addons")
          .insert({ ...payload, tenant_id: user.tenantId })
          .select("id")
          .single();
        if (error) throw error;

        // Vincular ao grupo se groupId foi fornecido
        if (groupId) {
          const { data: lastOrder } = await supabase
            .from("group_attributes")
            .select("display_order")
            .eq("group_id", groupId)
            .order("display_order", { ascending: false })
            .limit(1)
            .maybeSingle();

          const nextOrder = (lastOrder?.display_order ?? -1) + 1;

          const { error: linkError } = await supabase.from("group_attributes").insert({
            tenant_id: user.tenantId,
            group_id: groupId,
            addon_id: inserted.id,
            display_order: nextOrder,
          });
          if (linkError) throw linkError;
        }

        toast({ title: "Atributo criado" });
      }

      onSave();
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{addon ? "Editar Atributo" : "Novo Atributo"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              placeholder="Ex: Bacon, Tamanho G, Borda Recheada"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              placeholder="Descrição opcional"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Preço</Label>
              <Input
                id="price"
                inputMode="numeric"
                placeholder="R$ 0,00"
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: formatPrice(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_options">Máx. seleções</Label>
              <Input
                id="max_options"
                type="number"
                min={0}
                placeholder="Ilimitado"
                value={form.max_options}
                onChange={(e) => setForm((p) => ({ ...p, max_options: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Switch
                id="available"
                checked={form.available}
                onCheckedChange={(v) => setForm((p) => ({ ...p, available: v }))}
              />
              <Label htmlFor="available">Disponível</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="is_global"
                checked={form.is_global}
                onCheckedChange={(v) => setForm((p) => ({ ...p, is_global: v }))}
              />
              <Label htmlFor="is_global">Global</Label>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : addon ? "Salvar Alterações" : "Criar Atributo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}



