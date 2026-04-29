import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogClose, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Product, ProductAddon } from "@/types";
import { Star, Plus, Minus, ShoppingCart, X } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Variation { id: string; name: string; price: number; sort_order: number; }
interface ModifierItem { id: string; name: string; price: number; }
interface ModifierGroup { 
  id: string;
  name: string;
  behavior_type: string;
  min_options: number; 
  max_options: number | null; 
  pricing_rule: string;
  items?: ModifierItem[];
}

interface ProductDetailDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderingBlocked?: boolean;
  onAddToCart: (
    product: Product,
    quantity: number,
    selectedAddons: ProductAddon[],
    notes?: string,
    variation?: Variation
  ) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// ─── Labels padrão por tipo ───────────────────────────────────────────────────────
const BEHAVIOR_LABELS: Record<string, { defaultName: string }> = {
  checkbox: { defaultName: "Adicionais / Extras" },
  stepper: { defaultName: "Acompanhamentos" },
  fractional: { defaultName: "Combinar Sabores" },
};

const EXTRAS_BEHAVIORS = new Set(["checkbox", "extras"]);
const SIDES_BEHAVIORS = new Set(["stepper", "side_items"]);
const FRACTIONAL_BEHAVIORS = new Set(["fractional", "flavor_mix"]);
const normalizeBehavior = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const toModifierItems = (items: unknown): ModifierItem[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item: any) => ({
      id: item?.id,
      name: item?.name,
      price: Number(item?.price ?? 0),
    }))
    .filter((item) => Boolean(item.id) && Boolean(item.name));
};

const roundPrice = (value: number) => Math.round(value * 100) / 100;
const parseNonNegativeLimit = (value: unknown): number => {
  const normalizedValue =
    typeof value === "string" ? value.replace(",", ".").trim() : value;
  const parsed = Number(normalizedValue);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};
const parsePositiveLimit = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;

  const normalizedValue =
    typeof value === "string" ? value.replace(",", ".").trim() : value;
  const parsed = Number(normalizedValue);
  if (!Number.isFinite(parsed)) return null;

  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : null;
};
const normalizeFractionalPricingRule = (value: unknown): "sum" | "highest" => {
  const normalized = String(value ?? "highest").trim().toLowerCase();
  return normalized === "sum" ? "sum" : "highest";
};

// ─── Componente ───────────────────────────────────────────────────────────────

export function ProductDetailDialog({
  product,
  open,
  onOpenChange,
  orderingBlocked = false,
  onAddToCart,
}: ProductDetailDialogProps) {
  const [quantity, setQuantity]                     = useState(1);
  const [notes, setNotes]                           = useState("");
  const [selectedVariationId, setSelectedVariationId] = useState("");
  const [selectedExtras, setSelectedExtras]         = useState<string[]>([]);
  const [selectedSides, setSelectedSides]           = useState<Record<string, number>>({});
  const [selectedFractionals, setSelectedFractionals] = useState<string[]>([]);

  const p = product as any;
  const groups: ModifierGroup[] = Array.isArray(p?.groups) ? p.groups : [];

  // Reset ao abrir/trocar produto
  useEffect(() => {
    if (open && product) {
      setQuantity(1);
      setNotes("");
      setSelectedVariationId("");
      setSelectedExtras([]);
      setSelectedSides({});
      setSelectedFractionals([]);
    }
  }, [open, product?.id]);

  useEffect(() => {
    if (orderingBlocked && open) {
      onOpenChange(false);
    }
  }, [open, onOpenChange, orderingBlocked]);

  // Extract groups by behavior type
  const extrasGroups = groups.filter((g) =>
    EXTRAS_BEHAVIORS.has(
      normalizeBehavior((g as any)?.behavior_type ?? (g as any)?.behaviorType)
    )
  );
  const sidesGroups = groups.filter((g) =>
    SIDES_BEHAVIORS.has(
      normalizeBehavior((g as any)?.behavior_type ?? (g as any)?.behaviorType)
    )
  );
  const fractionalGroups = groups.filter((g) =>
    FRACTIONAL_BEHAVIORS.has(
      normalizeBehavior((g as any)?.behavior_type ?? (g as any)?.behaviorType)
    )
  );

  const extrasGroup =
    extrasGroups.find((group) => toModifierItems(group.items).length > 0) ?? extrasGroups[0];
  const sidesGroup =
    sidesGroups.find((group) => toModifierItems(group.items).length > 0) ?? sidesGroups[0];
  const fractionalGroup =
    fractionalGroups.find((group) => toModifierItems(group.items).length > 0) ?? fractionalGroups[0];

  // Get display names for groups
  const extrasDisplayName = extrasGroup?.name || BEHAVIOR_LABELS.checkbox.defaultName;
  const sidesDisplayName = sidesGroup?.name || BEHAVIOR_LABELS.stepper.defaultName;
  const fractionalDisplayName =
    fractionalGroup?.name || BEHAVIOR_LABELS.fractional.defaultName;

  // Variations from product data
  const variations: Variation[] = p?.variations || [];

  // Items from groups (use cached if available)
  const extrasItems = toModifierItems(extrasGroup?.items);
  const sidesItems = toModifierItems(sidesGroup?.items);
  const fractionalItems = toModifierItems(fractionalGroup?.items);

  const hasVariations = Boolean(p?.hasVariations ?? p?.has_variations) && variations.length > 0;
  const hasExtras = extrasItems.length > 0;
  const hasSides = sidesItems.length > 0;
  const hasFractional = fractionalItems.length > 0;
  const selectedVariation = variations.find((v) => v.id === selectedVariationId) ?? null;

  // Meta for limits
  const extrasMeta = extrasGroup ? { max_options: extrasGroup.max_options } : null;
  const sidesMeta = sidesGroup ? { max_options: sidesGroup.max_options } : null;
  const fractionalGroupRaw = fractionalGroup as any;
  const fractionalMeta = fractionalGroupRaw
    ? {
        min_options: parseNonNegativeLimit(
          fractionalGroupRaw.min_options ?? fractionalGroupRaw.minOptions
        ),
        max_options: parsePositiveLimit(
          fractionalGroupRaw.max_options ?? fractionalGroupRaw.maxOptions
        ),
        pricing_rule: normalizeFractionalPricingRule(
          fractionalGroupRaw.pricing_rule ?? fractionalGroupRaw.pricingRule
        ),
      }
    : null;
  const fractionalMin = fractionalMeta?.min_options ?? 0;
  const fractionalMax = fractionalMeta?.max_options ?? null;
  const fractionalBaseCount = hasFractional ? 1 : 0;
  const fractionalAdditionalMax =
    fractionalMax === null ? null : Math.max(0, fractionalMax - fractionalBaseCount);
  const fractionalItemIds = new Set(fractionalItems.map((item) => String(item.id)));
  const normalizedSelectedFractionals = (() => {
    const deduped = Array.from(new Set(selectedFractionals.map((id) => String(id))));
    const valid = deduped.filter((id) => fractionalItemIds.has(id));
    if (fractionalAdditionalMax === null) return valid;
    return valid.slice(0, fractionalAdditionalMax);
  })();

  useEffect(() => {
    setSelectedFractionals((prev) => {
      const prevNormalized = prev.map((id) => String(id));
      if (
        prevNormalized.length === normalizedSelectedFractionals.length &&
        prevNormalized.every((id, index) => id === normalizedSelectedFractionals[index])
      ) {
        return prev;
      }

      return normalizedSelectedFractionals;
    });
  }, [normalizedSelectedFractionals]);

  if (!product) return null;

  // ── Handlers: Extras (checkbox) ────────────────────────────────────────────

  const toggleExtra = (id: string) => {
    const maxExtras = extrasMeta?.max_options ?? null;
    setSelectedExtras((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (maxExtras !== null && prev.length >= maxExtras) return prev; // trava
      return [...prev, id];
    });
  };

  // ── Handlers: Sides (stepper) ──────────────────────────────────────────────

  const totalSidesQty = Object.values(selectedSides).reduce((s, v) => s + v, 0);
  const maxSides = sidesMeta?.max_options ?? null;

  const incrementSide = (id: string) => {
    if (maxSides !== null && totalSidesQty >= maxSides) return; // trava global
    setSelectedSides((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  };

  const decrementSide = (id: string) => {
    setSelectedSides((prev) => {
      const next = (prev[id] ?? 0) - 1;
      if (next <= 0) { const { [id]: _, ...rest } = prev; return rest; }
      return { ...prev, [id]: next };
    });
  };

  // ── Handlers: Fractional (combinar sabores) ──────────────────────────────

  const toggleFractional = (id: string) => {
    const targetId = String(id);

    setSelectedFractionals((prev) => {
      const normalizedPrev = Array.from(new Set(prev.map((value) => String(value))))
        .filter((value) => fractionalItemIds.has(value))
        .slice(0, fractionalAdditionalMax ?? Number.MAX_SAFE_INTEGER);

      if (!fractionalItemIds.has(targetId)) {
        return normalizedPrev;
      }

      if (normalizedPrev.includes(targetId)) {
        return normalizedPrev.filter((value) => value !== targetId);
      }

      if (
        fractionalAdditionalMax !== null &&
        normalizedPrev.length >= fractionalAdditionalMax
      ) {
        return normalizedPrev;
      }

      return [...normalizedPrev, targetId];
    });
  };

  // ── Motor de preço ─────────────────────────────────────────────────────────

  const basePrice    = selectedVariation ? selectedVariation.price : product.price;
  const extrasTotal  = extrasItems
    .filter((i) => selectedExtras.includes(i.id))
    .reduce((s, i) => s + i.price, 0);
  const sidesTotal   = sidesItems
    .reduce((s, i) => s + i.price * (selectedSides[i.id] ?? 0), 0);

  const selectedFractionalSet = new Set(normalizedSelectedFractionals);
  const selectedFractionalItems = fractionalItems.filter((item) =>
    selectedFractionalSet.has(String(item.id))
  );
  const fractionalTotal = (() => {
    if (selectedFractionalItems.length === 0) return 0;

    const prices = [basePrice, ...selectedFractionalItems.map((item) => item.price)];
    const sum = prices.reduce((acc, value) => acc + value, 0);

    if (fractionalMeta?.pricing_rule === "sum") return sum / prices.length;
    return Math.max(...prices);
  })();
  const fractionalCharge = roundPrice(fractionalTotal);
  const hasFractionalSelectionForPrice = selectedFractionalItems.length > 0;
  const effectiveBasePrice = hasFractionalSelectionForPrice
    ? fractionalCharge
    : basePrice;
  const totalPrice = effectiveBasePrice * quantity + extrasTotal + sidesTotal;

  const selectedFractionalAdditionalCount = normalizedSelectedFractionals.length;
  const selectedFractionalCount =
    hasFractional ? fractionalBaseCount + selectedFractionalAdditionalCount : 0;
  const remainingFractionalSelections =
    fractionalAdditionalMax === null
      ? null
      : Math.max(0, fractionalAdditionalMax - selectedFractionalAdditionalCount);
  const meetsFractionalMin = !hasFractional || selectedFractionalCount >= fractionalMin;
  const canAdd = !orderingBlocked && (!hasVariations || !!selectedVariation) && meetsFractionalMin;

  const handleAddToCart = () => {
    if (!canAdd) return;

    const hasFractionalSelection = selectedFractionalItems.length > 0;

    const fractionalAddons: ProductAddon[] =
      !hasFractionalSelection
        ? []
        : selectedFractionalItems.map((item) => ({
            id: item.id,
            name: item.name,
            // Com fractional ativo, o preço base do produto já será fractionalCharge.
            // Portanto, addons fractional não carregam preço para evitar duplicidade.
            price: 0,
            available: true,
            quantity: 1,
            selected: true,
            groupBehavior: "fractional",
          }));

    const addons: ProductAddon[] = [
      ...extrasItems
        .filter((i) => selectedExtras.includes(i.id))
        .map((i) => ({ id: i.id, name: i.name, price: i.price, available: true, quantity: 1, selected: true, groupBehavior: "checkbox" })),
      ...sidesItems
        .filter((i) => (selectedSides[i.id] ?? 0) > 0)
        .map((i) => ({ id: i.id, name: i.name, price: i.price, available: true, quantity: selectedSides[i.id], selected: true, groupBehavior: "stepper" })),
      ...fractionalAddons,
    ];
    onAddToCart(
      {
        ...product,
        price: hasFractionalSelection ? fractionalCharge : product.price,
      },
      quantity,
      addons,
      notes,
      selectedVariation ?? undefined
    );
    onOpenChange(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-lg max-h-[92vh] overflow-hidden flex flex-col gap-0">

        {/* Hero */}
        <div className="relative w-full h-52 shrink-0 bg-muted">
          <img
            src={p?.imageUrl || p?.image_url || "/placeholder.svg"}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          {product.featured && (
            <Badge className="absolute top-3 left-3 bg-delivery-500 hover:bg-delivery-600 gap-1">
              <Star className="h-3 w-3 fill-current" /> Destaque
            </Badge>
          )}
          <DialogClose className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
            <X className="h-4 w-4" />
          </DialogClose>
        </div>

        {/* Acessibilidade: título e descrição ocultos visualmente */}
        <DialogHeader className="sr-only">
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>{product.description || "Detalhes do produto"}</DialogDescription>
        </DialogHeader>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* Nome, descrição, preço base */}
          <div>
            <h2 className="text-xl font-bold leading-tight">{product.name}</h2>
            {product.description && (
              <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
            )}
            <p className={`mt-2 text-lg font-bold text-delivery-700 dark:text-delivery-300 ${hasVariations ? "text-base font-normal text-muted-foreground line-through" : ""}`}>
              {fmt(product.price)}
            </p>
          </div>

          {/* ── Variações ─────────────────────────────────────────────── */}
          {hasVariations && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Escolha o Tamanho</h3>
                <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
              </div>
              <RadioGroup value={selectedVariationId} onValueChange={setSelectedVariationId} className="space-y-2">
                {variations.map((v) => (
                  <label
                    key={v.id}
                    htmlFor={`var-${v.id}`}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                      selectedVariationId === v.id
                        ? "border-delivery-500 bg-delivery-50 dark:bg-delivery-950/40"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem id={`var-${v.id}`} value={v.id} />
                      <span className="text-sm font-medium">{v.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-delivery-700 dark:text-delivery-300">{fmt(v.price)}</span>
                  </label>
                ))}
              </RadioGroup>
            </section>
          )}

          {/* ── Extras e Acompanhamentos em Accordion ──────────────── */}
          {(hasExtras || hasSides || hasFractional) && (
            <Accordion type="multiple" className="space-y-0">

              {/* Extras (checkbox) */}
              {hasExtras && (
                <AccordionItem value="extras" className="border rounded-lg px-1 my-2">
                  <AccordionTrigger className="px-3 py-3 hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{extrasDisplayName}</span>
                      </div>
                      {selectedExtras.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {selectedExtras.length}{extrasMeta?.max_options ? `/${extrasMeta.max_options}` : ""}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-1 pb-2">
                    <div className="space-y-1">
                      {extrasItems.map((item) => {
                        const checked = selectedExtras.includes(item.id);
                        const atLimit = extrasMeta?.max_options !== null &&
                          extrasMeta?.max_options !== undefined &&
                          selectedExtras.length >= extrasMeta.max_options && !checked;
                        return (
                          <label
                            key={item.id}
                            className={`flex items-center justify-between rounded-lg px-4 py-3 cursor-pointer transition-colors border ${
                              checked
                                ? "border-delivery-500 bg-delivery-50 dark:bg-delivery-950/40"
                                : "border-transparent hover:bg-muted/40"
                            } ${atLimit ? "opacity-40 cursor-not-allowed" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={checked}
                                disabled={atLimit}
                                onCheckedChange={() => !atLimit && toggleExtra(item.id)}
                              />
                              <span className="text-sm">{item.name}</span>
                            </div>
                            <span className="text-sm font-medium text-delivery-700 dark:text-delivery-300">+ {fmt(item.price)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Acompanhamentos (stepper) */}
              {hasSides && (
                <AccordionItem value="sides" className="border rounded-lg px-1">
                  <AccordionTrigger className="px-3 py-3 hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{sidesDisplayName}</span>
                      </div>
                      {totalSidesQty > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {totalSidesQty}{sidesMeta?.max_options ? `/${sidesMeta.max_options}` : ""}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-1 pb-2">
                    <div className="space-y-1">
                      {sidesItems.map((item) => {
                        const qty = selectedSides[item.id] ?? 0;
                        const atGlobalLimit = maxSides !== null && totalSidesQty >= maxSides && qty === 0;
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                              qty > 0
                                ? "border-delivery-500 bg-delivery-50 dark:bg-delivery-950/40"
                                : "border-transparent hover:bg-muted/40"
                            }`}
                          >
                            <span className="text-sm">{item.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground mr-1">+ {fmt(item.price)}</span>
                              <Button type="button" variant="outline" size="icon"
                                className="h-7 w-7 rounded-full" disabled={qty <= 0}
                                onClick={() => decrementSide(item.id)}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-5 text-center text-sm font-bold">{qty}</span>
                              <Button type="button" variant="outline" size="icon"
                                className="h-7 w-7 rounded-full" disabled={atGlobalLimit}
                                onClick={() => incrementSide(item.id)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Combinar Sabores (fractional) */}
              {hasFractional && (
                <AccordionItem value="fractional" className="border rounded-lg px-1 my-2">
                  <AccordionTrigger className="px-3 py-3 hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{fractionalDisplayName}</span>
                      </div>
                      {selectedFractionalCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {selectedFractionalCount}
                          {fractionalMax !== null ? `/${fractionalMax}` : ""}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-1 pb-2">
                    <div className="space-y-1">
                      {fractionalItems.map((item) => {
                        const checked = selectedFractionalSet.has(String(item.id));
                        const atLimit =
                          remainingFractionalSelections !== null &&
                          remainingFractionalSelections <= 0 &&
                          !checked;
                        return (
                          <label
                            key={item.id}
                            className={`flex items-center justify-between rounded-lg px-4 py-3 cursor-pointer transition-colors border ${
                              checked
                                ? "border-delivery-500 bg-delivery-50 dark:bg-delivery-950/40"
                                : "border-transparent hover:bg-muted/40"
                            } ${atLimit ? "opacity-40 cursor-not-allowed" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={checked}
                                disabled={atLimit}
                                onCheckedChange={() => !atLimit && toggleFractional(item.id)}
                              />
                              <span className="text-sm">{item.name}</span>
                            </div>
                            <span className="text-sm font-medium text-delivery-700 dark:text-delivery-300">+ {fmt(item.price)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

            </Accordion>
          )}

          {/* Observações */}
          <section className="space-y-2">
            <h3 className="font-semibold text-sm">Observações</h3>
            <Textarea
              placeholder="Ex: Sem cebola, molho à parte..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
              rows={2}
            />
          </section>
        </div>

        {/* Footer fixo */}
        <div className="shrink-0 border-t bg-background px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Quantidade</span>
            <div className="flex items-center gap-3">
              <Button
                type="button" variant="outline" size="icon"
                className="h-8 w-8 rounded-full"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-6 text-center font-bold text-base">{quantity}</span>
              <Button
                type="button" variant="outline" size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <Button
            className="w-full h-12 text-base font-semibold gap-2 bg-delivery-500 hover:bg-delivery-600 disabled:opacity-50"
            disabled={!canAdd || !product.available}
            onClick={handleAddToCart}
          >
            <ShoppingCart className="h-5 w-5" />
            <span>Adicionar</span>
            <span className="ml-auto font-bold">{fmt(totalPrice)}</span>
          </Button>

          {hasVariations && !selectedVariation && (
            <p className="text-xs text-center text-muted-foreground">
              Selecione um tamanho para continuar
            </p>
          )}
          {hasFractional && !meetsFractionalMin && (
            <p className="text-xs text-center text-muted-foreground">
              Selecione pelo menos {fractionalMin} sabor(es) para continuar
            </p>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}



