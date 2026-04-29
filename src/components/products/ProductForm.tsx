import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Upload, ExternalLink, Layers, Trash2, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fileToBase64, validateImageFile } from "@/utils/image-utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

interface Category {
  id: string;
  name: string;
  display_order?: number;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category_id?: string;
  available: boolean;
  featured: boolean;
  extras_group_id?: string | null;
  sides_group_id?: string | null;
  has_variations?: boolean;
}

interface ProductFormProps {
  product: Product | null;
  categories: Category[];
  onClose: (shouldRefetch?: boolean) => void;
}

type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];

interface GroupSelectableItem {
  id: string;
  name: string;
  price: number;
  group_id: string;
}

interface ModifierGroupWithItems {
  id: string;
  name: string;
  items: GroupSelectableItem[];
}

function formatBrlCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatBrlInput(value: string | number) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return formatBrlCurrency(value);
  }

  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  return formatBrlCurrency(Number(digits) / 100);
}

function parseBrlInput(value: string | number): number {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return value;
  }

  const cleaned = value
    .toString()
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

export function ProductForm({
  product,
  categories,
  onClose,
}: ProductFormProps) {
  const isEditing = !!product;
  const { toast } = useToast();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    image_url: "",
    category_id: "",
    available: true,
    featured: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // ── Área 1: seleção de atributos por tipo ──────────────────────────────
  const [extrasEnabled, setExtrasEnabled] = useState(false);
  const [extrasSelected, setExtrasSelected] = useState<string[]>([]);
  const [sidesEnabled, setSidesEnabled] = useState(false);
  const [sidesSelected, setSidesSelected] = useState<string[]>([]);

  // ── Área 2: variações inline ────────────────────────────────────────────
  const [variationsEnabled, setVariationsEnabled] = useState(false);
  const [variations, setVariations] = useState<{ id: string; name: string; price: string }[]>([]);

  const addVariation = () =>
    setVariations((p) => [...p, { id: crypto.randomUUID(), name: "", price: "" }]);

  const updateVariation = (id: string, field: "name" | "price", value: string) =>
    setVariations((p) => p.map((v) => (v.id === id ? { ...v, [field]: value } : v)));

  const removeVariation = (id: string) =>
    setVariations((p) => p.filter((v) => v.id !== id));

  // Atributos de grupos checkbox (Adicionais/Extras) - buscar groups
  const { data: extrasGroups = [] } = useQuery<ModifierGroupWithItems[]>({
    queryKey: ["modifier_groups_checkbox"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modifier_groups")
        .select(`
          id,
          name,
          group_attributes(display_order, product_addons(id, name, price))
        `)
        .eq("behavior_type", "checkbox")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((g: any) => ({
        id: g.id,
        name: g.name,
        items: (g.group_attributes ?? [])
          .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .map((r: any) => {
            const addon = r.product_addons;
            if (!addon) return null;
            return {
              id: addon.id,
              name: addon.name,
              price: addon.price,
              group_id: g.id,
            } as GroupSelectableItem;
          })
          .filter(Boolean)
      }));
    },
  });

  // Atributos de grupos stepper (Acompanhamentos)
  const { data: sidesGroups = [] } = useQuery<ModifierGroupWithItems[]>({
    queryKey: ["modifier_groups_stepper"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modifier_groups")
        .select(`
          id,
          name,
          group_attributes(display_order, product_addons(id, name, price))
        `)
        .eq("behavior_type", "stepper")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((g: any) => ({
        id: g.id,
        name: g.name,
        items: (g.group_attributes ?? [])
          .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .map((r: any) => {
            const addon = r.product_addons;
            if (!addon) return null;
            return {
              id: addon.id,
              name: addon.name,
              price: addon.price,
              group_id: g.id,
            } as GroupSelectableItem;
          })
          .filter(Boolean)
      }));
    },
  });

  const toggleItem = (list: string[], setList: (v: string[]) => void, id: string) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const toggleAll = (items: { id: string }[], selected: string[], setSelected: (v: string[]) => void) =>
    setSelected(selected.length === items.length ? [] : items.map((i) => i.id));

  // ── Fetch dados extras ao editar ───────────────────────────────────────
  useEffect(() => {
    if (!isEditing || !product?.id) return;

    let cancelled = false;

    // Buscar addon_ids selecionados de product_addon_selections (fonte oficial)
    const loadSelections = async () => {
      const [{ data: extrasData }, { data: sidesData }] = await Promise.all([
        supabase
          .from("product_addon_selections")
          .select("addon_id")
          .eq("product_id", product.id)
          .eq("type", "extras"),
        supabase
          .from("product_addon_selections")
          .select("addon_id")
          .eq("product_id", product.id)
          .eq("type", "sides"),
      ]);

      if (cancelled) return;

      const nextExtrasSelected = (extrasData ?? []).map((r: any) => r.addon_id);
      const nextSidesSelected = (sidesData ?? []).map((r: any) => r.addon_id);

      setExtrasSelected(nextExtrasSelected);
      setSidesSelected(nextSidesSelected);
      setExtrasEnabled(Boolean(product.extras_group_id) || nextExtrasSelected.length > 0);
      setSidesEnabled(Boolean(product.sides_group_id) || nextSidesSelected.length > 0);
    };

    loadSelections();

    // Variações
    if (product.has_variations) {
      setVariationsEnabled(true);
      supabase
        .from("product_variations")
        .select("id, name, price")
        .eq("product_id", product.id)
        .order("sort_order", { ascending: true })
        .then(({ data }) => {
          if (cancelled) return;
          if (data && data.length > 0) {
            setVariations(
              data.map((v) => ({
                id: v.id,
                name: v.name,
                price: formatBrlInput(v.price),
              }))
            );
            return;
          }
          setVariations([]);
        });
    } else {
      setVariationsEnabled(false);
      setVariations([]);
    }

    return () => {
      cancelled = true;
    };
  }, [
    isEditing,
    product?.id,
    product?.extras_group_id,
    product?.sides_group_id,
    product?.has_variations,
  ]); // eslint-disable-line react-hooks/exhaustive-deps
  
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        description: product.description || "",
        price: formatBrlInput(product.price || 0),
        image_url: product.image_url || "",
        category_id: product.category_id || "",
        available: product.available !== undefined ? product.available : true,
        featured: product.featured || false,
      });
      return;
    }

    setFormData({
      name: "",
      description: "",
      price: "",
      image_url: "",
      category_id: "",
      available: true,
      featured: false,
    });
    setExtrasEnabled(false);
    setSidesEnabled(false);
    setExtrasSelected([]);
    setSidesSelected([]);
    setVariationsEnabled(false);
    setVariations([]);
  }, [product]);

  const allExtrasItems = extrasGroups.flatMap((g) => g.items);
  const allSidesItems = sidesGroups.flatMap((g) => g.items);
  const extrasGroupByAddonId = new Map(allExtrasItems.map((item) => [item.id, item.group_id]));
  const sidesGroupByAddonId = new Map(allSidesItems.map((item) => [item.id, item.group_id]));

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      ...(name === "price"
        ? { price: formatBrlInput(value) }
        : {}),
      [name]:
        name === "price"
          ? formatBrlInput(value)
          : type === "checkbox"
            ? (e.target as HTMLInputElement).checked
            : value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!user?.tenantId) throw new Error("Tenant não identificado.");

      const selectedExtrasGroupId =
        extrasEnabled
          ? extrasSelected.map((addonId) => extrasGroupByAddonId.get(addonId)).find(Boolean) ??
            product?.extras_group_id ??
            null
          : null;

      const selectedSidesGroupId =
        sidesEnabled
          ? sidesSelected.map((addonId) => sidesGroupByAddonId.get(addonId)).find(Boolean) ??
            product?.sides_group_id ??
            null
          : null;

      const normalizedPrice = parseBrlInput(formData.price);

      const productData = {
        ...formData,
        price: normalizedPrice,
        extras_group_id: selectedExtrasGroupId,
        sides_group_id: selectedSidesGroupId,
        has_variations: variationsEnabled,
      };

      let productId = product?.id;

      if (isEditing) {
        const { error } = await supabase
          .from("products").update(productData).eq("id", product.id);
        if (error) throw error;
      } else {
        const insertPayload: ProductInsert = {
          ...productData,
          tenant_id: user.tenantId,
        };
        const { data, error } = await supabase
          .from("products").insert(insertPayload).select("id").single();
        if (error) throw error;
        productId = data.id;
      }

      // ── Sincronizar selections reais do produto (fonte oficial) ───────────
      if (productId) {
        const { error: deleteSelectionsError } = await supabase
          .from("product_addon_selections")
          .delete()
          .eq("product_id", productId)
          .in("type", ["extras", "sides"]);
        if (deleteSelectionsError) throw deleteSelectionsError;

        const { error: probeGroupIdError } = await supabase
          .from("product_addon_selections")
          .select("group_id")
          .limit(1);

        const supportsGroupId = !probeGroupIdError;

        if (extrasEnabled && extrasSelected.length > 0) {
          const extrasToInsert = extrasSelected.map((addonId) => {
            const row: Record<string, string> = {
              tenant_id: user.tenantId,
              product_id: productId as string,
              addon_id: addonId,
              type: "extras",
            };

            const groupId = extrasGroupByAddonId.get(addonId);
            if (supportsGroupId && groupId) {
              row.group_id = groupId;
            }

            return row;
          });

          const { error: errorExtras } = await supabase
            .from("product_addon_selections")
            .insert(extrasToInsert as any);
          if (errorExtras) throw errorExtras;
        }

        if (sidesEnabled && sidesSelected.length > 0) {
          const sidesToInsert = sidesSelected.map((addonId) => {
            const row: Record<string, string> = {
              tenant_id: user.tenantId,
              product_id: productId as string,
              addon_id: addonId,
              type: "sides",
            };

            const groupId = sidesGroupByAddonId.get(addonId);
            if (supportsGroupId && groupId) {
              row.group_id = groupId;
            }

            return row;
          });

          const { error: errorSides } = await supabase
            .from("product_addon_selections")
            .insert(sidesToInsert as any);
          if (errorSides) throw errorSides;
        }
      }

      // ── Sincronizar variações ──────────────────────────────────────────
      if (productId) {
        await supabase.from("product_variations").delete().eq("product_id", productId);

        if (variationsEnabled && variations.length > 0) {
          const validVariations = variations.filter((v) => v.name.trim());
          if (validVariations.length > 0) {
            const { error } = await supabase.from("product_variations").insert(
              validVariations.map((v, i) => ({
                tenant_id:  user.tenantId,
                product_id: productId,
                name:       v.name.trim(),
                price:      parseBrlInput(v.price),
                sort_order: i,
              }))
            );
            if (error) throw error;
          }
        }
      }

      toast({
        title: isEditing ? "Produto atualizado" : "Produto criado",
        description: isEditing ? "Atualizado com sucesso." : "Criado com sucesso.",
      });
      onClose(true);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: (error as any)?.message || (error as any)?.details || "Erro desconhecido ao salvar.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Grupos herdados pela categoria selecionada (read-only)
  const { data: inheritedGroups = [] } = useQuery({
    queryKey: ["inherited_groups", formData.category_id],
    enabled: !!formData.category_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_modifier_groups")
        .select("modifier_groups(id, name, min_options, max_options, pricing_rule)")
        .eq("category_id", formData.category_id);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.modifier_groups).filter(Boolean);
    },
  });

  // Handler para upload de arquivo
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);

    try {
      // Validar arquivo
      const error = validateImageFile(file, 2); // 2MB max
      if (error) {
        toast({
          variant: "destructive",
          title: "Erro no upload",
          description: error,
        });
        return;
      }

      // Converter para base64
      const base64 = await fileToBase64(file);
      setFormData((prev) => ({ ...prev, image_url: base64 }));

      toast({
        title: "Upload concluído",
        description: "Imagem carregada com sucesso",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro no upload",
        description: "Não foi possível processar o arquivo",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handler para abrir a imagem em nova aba
  const handleOpenInNewTab = (url: string) => {
    if (!url) return;

    // Se for uma URL base64, criar um blob e gerar uma URL temporária
    if (url.startsWith("data:")) {
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head>
              <title>Visualização da Imagem</title>
              <style>
                body {
                  margin: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  background: #f1f1f1;
                }
                img {
                  max-width: 100%;
                  max-height: 100vh;
                  object-fit: contain;
                }
              </style>
            </head>
            <body>
              <img src="${url}" alt="Preview" />
            </body>
          </html>
        `);
      }
    } else {
      // Se for uma URL normal, abrir em nova aba
      window.open(url, "_blank");
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
          <DialogDescription className="hidden">Modal de Produto</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="geral">Informações Básicas</TabsTrigger>
              <TabsTrigger value="grupos">Adicionais e Variações</TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Preço (R$)</Label>
                  <Input
                    id="price"
                    name="price"
                    type="text"
                    inputMode="decimal"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="R$ 0,00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) =>
                      handleSelectChange("category_id", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="image_url">Imagem do Produto</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      id="image_url"
                      name="image_url"
                      value={formData.image_url}
                      onChange={handleChange}
                      placeholder="https://exemplo.com/imagem.jpg"
                    />
                  </div>
                  <div>
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      id="product-image-upload"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                        e.target.value = ""; // Reset input
                      }}
                      disabled={isUploading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() =>
                        document.getElementById("product-image-upload")?.click()
                      }
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Recomendado: 800x600 pixels, formatos JPG, PNG ou WebP
                </p>

                {formData.image_url && (
                  <div className="mt-2">
                    <div className="relative w-1/2 max-w-[240px] overflow-hidden rounded-md border">
                      <img
                        src={formData.image_url}
                        alt="Preview do Produto"
                        className="aspect-square w-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src =
                            "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWltYWdlLW9mZiI+PHBhdGggZD0iTTIuMiAyLjJMOCAxNWwyLTIgNC0xIDggMTAiLz48cGF0aCBkPSJNMTQuOTUgOC02LjExIDYuMTEiLz48Y2lyY2xlIGN4PSI4IiBjeT0iOCIgcj0iMiIvPjxwYXRoIGQ9Ik0yMS45NSAyMS45IDEzIDE1bC0zLjA3IDIuOTkiLz48cGF0aCBkPSJNMiAyLjJMMjEuOCAyMiIvPjwvc3ZnPg==";
                          target.classList.add("p-8", "opacity-30");
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                        onClick={() => handleOpenInNewTab(formData.image_url)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="available"
                    name="available"
                    checked={formData.available}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, available: checked }))
                    }
                  />
                  <Label htmlFor="available">Disponível</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="featured"
                    name="featured"
                    checked={formData.featured}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, featured: checked }))
                    }
                  />
                  <Label htmlFor="featured">Destacado</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="grupos" className="mt-4 space-y-6">

              {/* ── Área 1: Vínculos de Atributos ─────────────────────────── */}
              <div className="rounded-lg border p-4 space-y-4">
                <p className="text-sm font-medium">Vínculos de Atributos</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Coluna 1 — Adicionais/Extras */}
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="extras-toggle" className="font-medium text-sm">Adicionais / Extras</Label>
                      <Switch id="extras-toggle" checked={extrasEnabled} onCheckedChange={(v) => { setExtrasEnabled(v); if (!v) setExtrasSelected([]); }} />
                    </div>
                    {extrasEnabled && (
                      <div className="space-y-1 max-h-44 overflow-y-auto">
                        {extrasGroups.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhum atributo do tipo Adicionais cadastrado.</p>
                        ) : (
                          <>
                            {/* Marcar todos */}
                            <label className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-muted/40 border-b pb-2 mb-1">
                              <Checkbox
                                checked={extrasSelected.length === extrasGroups.flatMap(g => g.items).length && extrasGroups.flatMap(g => g.items).length > 0}
                                onCheckedChange={() => toggleAll(extrasGroups.flatMap(g => g.items), extrasSelected, setExtrasSelected)}
                              />
                              <span className="text-sm font-medium">Marcar todos</span>
                            </label>
                            {extrasGroups.flatMap(g => g.items).map((item) => (
                              <label key={item.id} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-muted/40">
                                <Checkbox
                                  checked={extrasSelected.includes(item.id)}
                                  onCheckedChange={() => toggleItem(extrasSelected, setExtrasSelected, item.id)}
                                />
                                <span className="text-sm flex-1 truncate">{item.name}</span>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.price)}
                                </span>
                              </label>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Coluna 2 — Acompanhamentos */}
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sides-toggle" className="font-medium text-sm">Acompanhamentos</Label>
                      <Switch id="sides-toggle" checked={sidesEnabled} onCheckedChange={(v) => { setSidesEnabled(v); if (!v) setSidesSelected([]); }} />
                    </div>
                    {sidesEnabled && (
                      <div className="space-y-1 max-h-44 overflow-y-auto">
                        {sidesGroups.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhum atributo do tipo Acompanhamentos cadastrado.</p>
                        ) : (
                          <>
                            {/* Marcar todos */}
                            <label className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-muted/40 border-b pb-2 mb-1">
                              <Checkbox
                                checked={sidesSelected.length === sidesGroups.flatMap(g => g.items).length && sidesGroups.flatMap(g => g.items).length > 0}
                                onCheckedChange={() => toggleAll(sidesGroups.flatMap(g => g.items), sidesSelected, setSidesSelected)}
                              />
                              <span className="text-sm font-medium">Marcar todos</span>
                            </label>
                            {sidesGroups.flatMap(g => g.items).map((item) => (
                              <label key={item.id} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-muted/40">
                                <Checkbox
                                  checked={sidesSelected.includes(item.id)}
                                  onCheckedChange={() => toggleItem(sidesSelected, setSidesSelected, item.id)}
                                />
                                <span className="text-sm flex-1 truncate">{item.name}</span>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.price)}
                                </span>
                              </label>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Grupos herdados da categoria */}
                {inheritedGroups.length > 0 && (
                  <div className="space-y-1 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Herdados da categoria:</p>
                    <div className="flex flex-wrap gap-2">
                      {inheritedGroups.map((g: any) => (
                        <span key={g.id} className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2 py-1">
                          <Layers className="h-3 w-3" />
                          {g.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Área 2: Variações Inline ───────────────────────────── */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Variações</p>
                    <p className="text-xs text-muted-foreground">Ex: Tamanhos com preços diferentes</p>
                  </div>
                  <Switch
                    id="variations-toggle"
                    checked={variationsEnabled}
                    onCheckedChange={(v) => {
                      setVariationsEnabled(v);
                      if (v && variations.length === 0) addVariation();
                    }}
                  />
                </div>

                {variationsEnabled && (
                  <div className="space-y-2">
                    {variations.map((v) => (
                      <div key={v.id} className="flex items-center gap-2">
                        <Input
                          id={`var-name-${v.id}`}
                          name={`var-name-${v.id}`}
                          className="flex-[3]"
                          placeholder="Nome (ex: Média)"
                          value={v.name}
                          onChange={(e) => updateVariation(v.id, "name", e.target.value)}
                        />
                        <div className="relative flex-[1.5]">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                          <Input
                            id={`var-price-${v.id}`}
                            name={`var-price-${v.id}`}
                            className="pl-8"
                            inputMode="numeric"
                            placeholder="0,00"
                            value={v.price}
                            onChange={(e) =>
                              updateVariation(
                                v.id,
                                "price",
                                formatBrlInput(e.target.value)
                              )
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={() => removeVariation(v.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 mt-1"
                      onClick={addVariation}
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar Variação
                    </Button>
                  </div>
                )}
              </div>

            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-4 mt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onClose()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Salvando..."
                : isEditing
                  ? "Salvar Alterações"
                  : "Criar Produto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}



