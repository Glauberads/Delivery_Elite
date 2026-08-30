import React from "react";
import { Product, ProductAddon } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FeaturedCarouselProps {
  products: Product[];
  onAddToCart: (
    product: Product,
    quantity?: number,
    selectedAddons?: ProductAddon[],
    notes?: string,
    variation?: { id: string; name: string; price: number; sort_order: number }
  ) => void;
  orderingBlocked?: boolean;
}

export function FeaturedCarousel({
  products,
  onAddToCart,
  orderingBlocked = false,
}: FeaturedCarouselProps) {
  if (products.length === 0) return null;

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
    if (orderingBlocked) return;
    
    // Always trigger onAddToCart for featured products
    // The parent component (ProductList) will handle whether to open the dialog or add directly
    onAddToCart(product);
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
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Star className="h-5 w-5 text-delivery-500 fill-delivery-500" />
        <h2 className="text-lg font-bold">Mais Vendidos</h2>
      </div>

      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
        {products.map((product) => {
          const displayPrice = getProductDisplayPrice(product);

          return (
            <Card
              key={product.id}
              className="relative flex-none w-[280px] sm:w-[320px] snap-center overflow-hidden border border-border bg-card transition-shadow hover:shadow-md group cursor-pointer"
              onClick={() => handleProductClick(product)}
            >
              {/* Product Image Cover */}
              <div className="relative h-32 sm:h-36 w-full bg-muted overflow-hidden">
                <img
                  src={product.imageUrl || "/placeholder.svg"}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                
                <Badge className="absolute top-2 left-2 bg-delivery-500 hover:bg-delivery-600 gap-1 shadow-sm">
                  <Star className="h-3 w-3 fill-current" /> Destaque
                </Badge>

                {/* Price over image bottom */}
                <div className="absolute bottom-2 left-3 right-3 flex justify-between items-end">
                  <div className="text-white">
                    {displayPrice.label && (
                      <div className="text-[10px] uppercase font-bold text-white/90 leading-none mb-1">
                        {displayPrice.label}
                      </div>
                    )}
                    <div className="font-bold text-lg leading-none">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(displayPrice.value)}
                    </div>
                  </div>
                  
                  <Button 
                    size="icon" 
                    variant="secondary"
                    className="h-8 w-8 rounded-full bg-white/20 backdrop-blur-md hover:bg-white text-white hover:text-delivery-600 border-none transition-colors shadow-sm"
                    disabled={!product.available || orderingBlocked}
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-3 h-[88px] flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm sm:text-base line-clamp-1 mb-1 group-hover:text-delivery-600 transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-tight">
                    {product.description}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      
      {/* Estilo para esconder o scrollbar */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
