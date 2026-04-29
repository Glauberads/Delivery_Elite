import React, { useEffect, useState } from "react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2, Minus, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { useFormContext } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";

interface Product {
  id: string;
  name: string;
  price: number;
}

interface Addon {
  id: string;
  name: string;
  price: number;
  is_global: boolean;
  description?: string;
}

interface OrderItemFormProps {
  index: number;
  onRemove: () => void;
}

export function OrderItemForm({ index, onRemove }: OrderItemFormProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [availableAddons, setAvailableAddons] = useState<Addon[]>([]);
  const form = useFormContext();

  // Buscar produtos
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select("id, name, price")
          .eq("available", true);

        if (productsError) throw productsError;
        setProducts(productsData || []);
      } catch (error) {
        console.error("Erro ao buscar produtos:", error);
      }
    };

    fetchProducts();
  }, []);

  // Buscar adicionais disponíveis quando um produto é selecionado
  useEffect(() => {
    const fetchAddons = async () => {
      const productId = form.watch(`items.${index}.productId`);
      if (!productId) {
        setAvailableAddons([]);
        return;
      }

      try {
        // Buscar adicionais relacionados ao produto
        const { data: addonsData, error: addonsError } = await supabase
          .from("product_addon_relations")
          .select(
            `
            addon:product_addons (
              id,
              name,
              price,
              is_global,
              description
            )
          `
          )
          .eq("product_id", productId)
          .eq("addon.available", true);

        if (addonsError) throw addonsError;

        // Formatar os dados removendo a estrutura aninhada
        const formattedAddons = addonsData
          ?.map((item) => item.addon)
          .filter(Boolean) as Addon[];

        setAvailableAddons(formattedAddons || []);

        // Limpar adicionais selecionados se não estiverem mais disponíveis
        const currentAddons = form.watch(`items.${index}.addons`) || [];
        const validAddons = currentAddons.filter((addonId) =>
          formattedAddons?.some((addon) => addon.id === addonId)
        );

        if (validAddons.length !== currentAddons.length) {
          form.setValue(`items.${index}.addons`, validAddons);
        }
      } catch (error) {
        console.error("Erro ao buscar adicionais:", error);
        setAvailableAddons([]);
      }
    };

    fetchAddons();
  }, [form.watch(`items.${index}.productId`)]);

  // Atualizar preço total quando produto, quantidade ou adicionais mudarem
  useEffect(() => {
    const productId = form.watch(`items.${index}.productId`);
    const quantity = form.watch(`items.${index}.quantity`) || 0;
    const selectedProduct = products.find((p) => p.id === productId);
    const selectedAddonsList = form.watch(`items.${index}.addons`) || [];

    if (selectedProduct) {
      // Preço base do produto (sem adicionais)
      const baseProductPrice = selectedProduct.price;

      // Total dos adicionais
      const addonsTotal = selectedAddonsList.reduce((total, addonId) => {
        const addon = availableAddons.find((a) => a.id === addonId);
        return total + (addon?.price || 0);
      }, 0);

      // Preço total do item (produto base + adicionais) * quantidade
      const totalPrice = (baseProductPrice + addonsTotal) * quantity;

      // Armazenar o preço total do item (incluindo adicionais)
      form.setValue(`items.${index}.price`, totalPrice);

      // Também armazenamos o preço base do produto para uso futuro
      form.setValue(`items.${index}.basePrice`, baseProductPrice);
    }
  }, [
    form.watch(`items.${index}.productId`),
    form.watch(`items.${index}.quantity`),
    form.watch(`items.${index}.addons`),
  ]);

  return (
    <Card className="mb-4">
      <CardContent className="p-4 space-y-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 space-y-4">
            {/* Produto e Quantidade na mesma linha */}
            <div className="flex gap-4">
              <FormField
                control={form.control}
                name={`items.${index}.productId`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Produto</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue(`items.${index}.addons`, []);
                        const product = products.find((p) => p.id === value);
                        if (product) {
                          // Definir o preço base do produto
                          form.setValue(
                            `items.${index}.basePrice`,
                            product.price
                          );
                          // Definir o preço total inicial (apenas preço base * quantidade)
                          form.setValue(
                            `items.${index}.price`,
                            product.price *
                              (form.watch(`items.${index}.quantity`) || 1)
                          );
                        }
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um produto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <ScrollArea className="h-[200px]">
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} -{" "}
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(product.price)}
                            </SelectItem>
                          ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`items.${index}.quantity`}
                render={({ field }) => (
                  <FormItem className="w-[140px]">
                    <FormLabel>Qtd</FormLabel>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const newValue = Math.max(1, (field.value || 1) - 1);
                          field.onChange(newValue);
                        }}
                        disabled={field.value <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <div className="flex-1 text-center font-medium">
                        {field.value || 1}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const newValue = (field.value || 1) + 1;
                          field.onChange(newValue);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Adicionais */}
            {availableAddons.length > 0 && (
              <FormField
                control={form.control}
                name={`items.${index}.addons`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adicionais</FormLabel>
                    <ScrollArea className="h-[150px]">
                      <div className="grid grid-cols-2 gap-3 p-1">
                        {availableAddons.map((addon) => (
                          <div
                            key={addon.id}
                            className={`border rounded-lg p-2 transition-colors ${
                              field.value?.includes(addon.id)
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <label className="flex items-center gap-3 cursor-pointer">
                              <Checkbox
                                checked={field.value?.includes(addon.id)}
                                onCheckedChange={(checked) => {
                                  const newValue = checked
                                    ? [...(field.value || []), addon.id]
                                    : (field.value || []).filter(
                                        (id: string) => id !== addon.id
                                      );
                                  field.onChange(newValue);
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="font-medium truncate">
                                    {addon.name}
                                  </div>
                                  <div className="text-sm font-medium text-primary whitespace-nowrap">
                                    {new Intl.NumberFormat("pt-BR", {
                                      style: "currency",
                                      currency: "BRL",
                                    }).format(addon.price)}
                                  </div>
                                </div>
                                {addon.description && (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {addon.description}
                                  </div>
                                )}
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          {/* Botão Remover */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}



