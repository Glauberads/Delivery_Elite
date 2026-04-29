import React, { useState } from "react";
import { Product, ProductAddon } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductDetailDialog } from "./ProductDetailDialog";
import { Plus, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductListProps {
  products: Product[];
  onAddToCart: (
    product: Product,
    quantity?: number,
    selectedAddons?: ProductAddon[],
    notes?: string,
    variation?: { id: string; name: string; price: number; sort_order: number }
  ) => void;
  isLoading?: boolean;
  isError?: boolean;
  orderingBlocked?: boolean;
}

export function ProductList({
  products,
  onAddToCart,
  isLoading = false,
  isError = false,
  orderingBlocked = false,
}: ProductListProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="overflow-hidden border">
            <div className="flex h-full">
              <div className="flex-1 p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-6 w-1/3 mt-2" />
                <Skeleton className="h-8 w-full mt-2" />
              </div>
              <div className="relative flex-shrink-0 w-24 md:w-32">
                <Skeleton
                  className="w-full h-full absolute inset-0"
                  style={{ aspectRatio: "1/1" }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Erro ao carregar produtos. Tente novamente.</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Nenhum produto encontrado.</p>
      </div>
    );
  }

  const shouldOpenProductDialog = (product: Product) => {
    const p = product as any;
    const hasVariations = Boolean(p.hasVariations ?? p.has_variations);
    const groups = Array.isArray(p.groups) ? p.groups : [];
    const hasGroups = groups.length > 0;
    const hasFractionalGroup = groups.some(
      (group: any) => group?.behavior_type === "fractional" || group?.behavior_type === "flavor_mix"
    );
    return hasVariations || hasGroups || hasFractionalGroup;
  };

  const handleProductClick = (product: Product) => {
    if (orderingBlocked) {
      return;
    }

    if (shouldOpenProductDialog(product) && product.available) {
      setSelectedProduct(product);
      setDialogOpen(true);
    } else if (product.available) {
      onAddToCart(product);
    }
  };

  const getProductDisplayPrice = (product: Product) => {
    const p = product as any;
    const hasVariations = Boolean(p.hasVariations ?? p.has_variations);
    const variationPrices = (Array.isArray(p.variations) ? p.variations : [])
      .map((v: any) => Number(v?.price))
      .filter((price: number) => Number.isFinite(price));

    if (hasVariations && variationPrices.length > 0) {
      return { label: "A partir de", value: Math.min(...variationPrices) };
    }

    return { label: null as string | null, value: Number(product.price) || 0 };
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.map((product) => {
          const displayPrice = getProductDisplayPrice(product);
          return (
          <Card
            key={product.id}
            className="overflow-hidden border border-border bg-card transition-shadow hover:shadow-md"
          >
            <div className="flex h-full">
              <div className="flex-1 p-4">
                <h3 className="font-bold text-lg mb-1 line-clamp-1">
                  {product.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                  {product.description}
                </p>
                <div className="mt-auto text-lg font-bold text-delivery-700 dark:text-delivery-300">
                  {displayPrice.label && (
                    <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                      {displayPrice.label}
                    </div>
                  )}
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(displayPrice.value)}
                </div>

                <Button
                  className={cn(
                    "gap-2 w-full mt-2 bg-delivery-500 hover:bg-delivery-600",
                    (!product.available || orderingBlocked) && "opacity-50 cursor-not-allowed"
                  )}
                  size="sm"
                  onClick={() => handleProductClick(product)}
                  disabled={!product.available || orderingBlocked}
                >
                  <Plus className="h-4 w-4" />
                  {orderingBlocked ? "Indisponível" : "Adicionar"}
                </Button>
              </div>

              <div className="relative flex-shrink-0 w-24 md:w-32">
                <img
                  src={product.imageUrl || "/placeholder.svg"}
                  alt={product.name}
                  className="w-full h-full object-cover absolute inset-0"
                  style={{ aspectRatio: "1/1" }}
                />
                {product.featured && (
                  <Badge className="absolute top-1 right-1 bg-delivery-500 hover:bg-delivery-600">
                    <Star className="h-3 w-3 mr-1 fill-current" /> Destaque
                  </Badge>
                )}
              </div>
            </div>
          </Card>
          );
        })}
      </div>

      <ProductDetailDialog
        product={selectedProduct}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orderingBlocked={orderingBlocked}
        onAddToCart={onAddToCart}
      />
    </>
  );
}



