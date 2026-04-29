import React, { useState } from "react";
import { Header } from "@/components/layout/Header";
import { ProductGrid } from "@/components/products/ProductGrid";
import { CategoryFilter } from "@/components/products/CategoryFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  FolderPlus,
  Settings,
  Package2,
  Tags,
  Puzzle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ProductForm } from "@/components/products/ProductForm";
import { CategoryManager } from "@/components/products/CategoryManager";
import { ProductAddonList } from "@/components/products/ProductAddonList";
import { ModifierGroupManager } from "@/components/products/ModifierGroupManager";
import type { Product as ProductCardProduct } from "@/components/products/ProductCard";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/dashboard/StatCard";

interface CategoryOption {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  display_order?: number | null;
}

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category_id: string | null;
  available: boolean | null;
  featured: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  categories: { id: string; name: string } | null;
}

interface EditingProduct {
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

export default function Products() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showProductForm, setShowProductForm] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingProduct, setEditingProduct] = useState<EditingProduct | null>(null);
  const { toast } = useToast();

  // Fetch categories
  const { data: categories = [], refetch: refetchCategories } = useQuery<CategoryOption[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao carregar categorias",
          description: error.message,
        });
        return [];
      }

      return data;
    },
  });

  // Fetch products
  const { data: products = [], refetch: refetchProducts } = useQuery<ProductCardProduct[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const query = supabase.from("products").select(`
          *,
          categories:category_id (
            id,
            name
          )
        `);

      const { data, error } = await query;

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao carregar produtos",
          description: error.message,
        });
        return [];
      }

      return ((data ?? []) as ProductRow[]).map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description ?? "",
        price: product.price,
        image_url: product.image_url ?? undefined,
        imageUrl: product.image_url ?? undefined,
        category: product.categories?.name ?? "Sem categoria",
        available: product.available ?? true,
        featured: product.featured ?? false,
        createdAt: product.created_at ? new Date(product.created_at) : new Date(),
        category_id: product.category_id ?? undefined,
        extras_group_id: (product as any).extras_group_id ?? undefined,
        sides_group_id: (product as any).sides_group_id ?? undefined,
        has_variations: (product as any).has_variations ?? false,
      }));
    },
  });

  const categoryNames = categories.map((cat) => cat.name);

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description &&
        product.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const { data: productCount = 0 } = useQuery({
    queryKey: ["productCount"],
    queryFn: async () => {
      const { count } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: categoryCount = 0 } = useQuery({
    queryKey: ["categoryCount"],
    queryFn: async () => {
      const { count } = await supabase
        .from("categories")
        .select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: addonCount = 0 } = useQuery({
    queryKey: ["addonCount"],
    queryFn: async () => {
      const { count } = await supabase
        .from("product_addons")
        .select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: groupCount = 0 } = useQuery({
    queryKey: ["groupCount"],
    queryFn: async () => {
      const { count } = await supabase
        .from("modifier_groups")
        .select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const handleEditProduct = (product: ProductCardProduct) => {
    setEditingProduct({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      image_url: product.image_url ?? product.imageUrl,
      category_id: product.category_id,
      available: product.available,
      featured: product.featured ?? false,
      extras_group_id: (product as any).extras_group_id,
      sides_group_id: (product as any).sides_group_id,
      has_variations: (product as any).has_variations,
    });
    setShowProductForm(true);
  };

  const handleProductFormClose = (shouldRefetch = false) => {
    setShowProductForm(false);
    setEditingProduct(null);

    if (shouldRefetch) {
      refetchProducts();
    }
  };

  const handleCategoryManagerClose = () => {
    setShowCategoryManager(false);
    refetchCategories();
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Produtos" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Total de Produtos"
            value={productCount}
            icon={Package2}
            description="Produtos cadastrados"
          />
          <StatCard
            title="Categorias"
            value={categoryCount}
            icon={Tags}
            description="Categorias ativas"
          />
          <StatCard
            title="Atributos"
            value={addonCount}
            icon={Puzzle}
            description="Atributos disponíveis"
          />
          <StatCard
            title="Grupos"
            value={groupCount}
            icon={Settings}
            description="Grupos de modificadores"
          />
        </div>

        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="products">Produtos</TabsTrigger>
            <TabsTrigger value="groups">Grupos</TabsTrigger>
            <TabsTrigger value="addons">Atributos</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center mb-6">
              <div className="relative w-full sm:w-auto max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar produtos..."
                  className="pl-8 w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={() => setShowCategoryManager(true)}
                  className="w-full sm:w-auto gap-2"
                >
                  <FolderPlus className="h-4 w-4" />
                  Categorias
                </Button>
                <Button
                  onClick={() => setShowProductForm(true)}
                  className="w-full sm:w-auto gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Novo Produto
                </Button>
              </div>
            </div>

            <CategoryFilter
              categories={categoryNames}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />

            <ProductGrid
              products={filteredProducts}
              onEdit={handleEditProduct}
              onProductsChange={refetchProducts}
            />

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  Nenhum produto encontrado
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="addons">
            <ProductAddonList />
          </TabsContent>

          <TabsContent value="groups">
            <ModifierGroupManager />
          </TabsContent>
        </Tabs>

        {showProductForm && (
          <ProductForm
            categories={categories}
            product={editingProduct}
            onClose={handleProductFormClose}
          />
        )}

        {showCategoryManager && (
          <CategoryManager
            open={showCategoryManager}
            onClose={handleCategoryManagerClose}
            onCategoriesUpdated={refetchCategories}
            categories={categories}
          />
        )}
      </div>
    </div>
  );
}



