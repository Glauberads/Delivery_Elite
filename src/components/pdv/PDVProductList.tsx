
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/types';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductDetailDialog } from '@/components/home/ProductDetailDialog';

interface PDVProductListProps {
  onAddToCart: (
    product: Product,
    quantity?: number,
    selectedAddons?: any[],
    notes?: string,
    variation?: { id: string; name: string; price: number; sort_order: number }
  ) => void;
}

export const PDVProductList = React.memo(function PDVProductList({ onAddToCart }: PDVProductListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products-full'],
    staleTime: 1000 * 60 * 5, // 5 minutos de cache em memória
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_product_full');
      
      if (error) throw error;

      const parseJsonArray = (value: unknown) => {
        if (Array.isArray(value)) return value;
        if (typeof value !== "string") return [];
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };

      return (data || []).map((product: any) => ({
        id: product.id,
        name: product.name,
        description: product.description || '',
        price: product.price,
        imageUrl: product.image_url,
        category: product.category_name || 'Sem categoria',
        available: product.available,
        featured: product.featured || false,
        createdAt: new Date(product.created_at),
        hasVariations: product.has_variations,
        has_variations: product.has_variations,
        extrasGroupId: product.extras_group_id,
        sidesGroupId: product.sides_group_id,
        variations: parseJsonArray(product.variations),
        groups: parseJsonArray(product.groups),
        addons: parseJsonArray(product.groups)
          .flatMap((g: any) => (g.items || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            groupId: g.id,
            groupName: g.name,
            groupBehavior: g.behavior_type,
            minOptions: g.min_options,
            maxOptions: g.max_options
          })))
      } as Product));
    },
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) {
        set.add(p.category);
      }
    });
    return ['Todos', ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === 'Todos' || product.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!query) return true;
      return (
        product.name.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query)
      );
    });
  }, [products, searchQuery, selectedCategory]);

  const shouldOpenProductDialog = useCallback((product: Product) => {
    const p = product as any;
    const hasVariations = Boolean(p.hasVariations ?? p.has_variations);
    const groups = Array.isArray(p.groups) ? p.groups : [];
    const hasGroups = groups.length > 0;
    const hasFractionalGroup = groups.some(
      (group: any) => group?.behavior_type === "fractional" || group?.behavior_type === "flavor_mix"
    );
    return hasVariations || hasGroups || hasFractionalGroup;
  }, []);

  const handleProductClick = useCallback((product: Product) => {
    if (shouldOpenProductDialog(product)) {
      setSelectedProduct(product);
      setDialogOpen(true);
    } else {
      onAddToCart(product);
    }
  }, [onAddToCart, shouldOpenProductDialog]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="relative">
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar produtos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Barra de Filtro de Categorias (reduz DOM e acelera localização) */}
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                selectedCategory === category
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <Card
              key={product.id}
              className="overflow-hidden cursor-pointer group hover:border-primary/50 transition-colors"
              onClick={() => handleProductClick(product)}
            >
              <div className="aspect-square relative overflow-hidden bg-muted">
                <img
                  src={product.imageUrl || '/placeholder.svg'}
                  alt={product.name}
                  loading="lazy"
                  decoding="async"
                  className="object-cover w-full h-full transition-transform group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <h3 className="font-medium line-clamp-1">{product.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {product.description}
                </p>
                <p className="text-lg font-bold text-primary mt-2">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(product.price)}
                </p>
              </div>
            </Card>
          ))
        ) : (
          <p className="col-span-full text-center text-muted-foreground py-8">
            Nenhum produto encontrado
          </p>
        )}
      </div>

      <ProductDetailDialog
        product={selectedProduct}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAddToCart={(product, quantity, selectedAddons, notes) => {
          onAddToCart(product, quantity, selectedAddons, notes);
          setDialogOpen(false);
        }}
      />
    </div>
  );
});



