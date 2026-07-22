import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShoppingCart,
  Search,
  Clock,
  MapPin,
  Star,
  ChevronRight,
} from "lucide-react";
import { ProductList } from "@/components/home/ProductList";
import { RestaurantHeader } from "@/components/home/RestaurantHeader";
import { CategoryFilter } from "@/components/home/CategoryFilter";
import { FloatingCart } from "@/components/home/FloatingCart";
import { ActiveOrderBanner } from "@/components/home/ActiveOrderBanner";
import { ProductDetailDialog } from "@/components/home/ProductDetailDialog";
import { Product, ProductAddon } from "@/types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePublicTenant } from "@/hooks/usePublicTenant";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Interface para horários de funcionamento
interface BusinessHour {
  id: string;
  day_of_week: string;
  open_time: string;
  close_time: string;
  is_closed: boolean;
  updated_at?: string;
}

// Interface para restaurant
interface Restaurant {
  id: string;
  name: string;
  address: string | null;
  banner_url: string | null;
  logo_url: string | null;
  open_time: string | null;
  close_time: string | null;
  delivery_fee: number | null;
  description: string | null;
  phone: string | null;
}

export default function Home({ overrideSlug }: { overrideSlug?: string }) {
  const {
    slug,
    tenantId,
    tenant,
    restaurant,
    isLoading: isLoadingTenant,
    isNotFound,
    isError: isPublicTenantError,
    isBillingBlocked,
    isOutsideBusinessHours,
  } = usePublicTenant(overrideSlug);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cartItems, setCartItems] = useState<
    {
      product: Product;
      quantity: number;
      selectedAddons?: ProductAddon[];
      notes?: string;
    }[]
  >([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
  const [isLoadingBusinessHours, setIsLoadingBusinessHours] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const orderingBlocked = isBillingBlocked || isOutsideBusinessHours;
  const orderingBlockedByBusinessHours = !isBillingBlocked && isOutsideBusinessHours;
  const orderingBlockedMessage = isBillingBlocked
    ? "Loja temporariamente indisponível. Todos os itens e pedidos estão pausados."
    : "Loja fechada no momento. Novos pedidos serão liberados dentro do horário de atendimento.";
  const orderingBlockedToastMessage = isBillingBlocked
    ? "Loja temporariamente indisponível para pedidos."
    : "Loja fechada no momento. Aguarde o horário de atendimento.";

  interface Variation { id: string; name: string; price: number; sort_order: number; }

  // Função para formatar horário
  const formatTime = (timeString: string) => {
    if (!timeString) return "";
    try {
      const [hours, minutes] = timeString.split(":");
      return `${hours}h${minutes !== "00" ? minutes : ""}`;
    } catch (e) {
      return timeString;
    }
  };

  // Função para obter horário do dia atual
  const getTodayBusinessHours = () => {
    if (!businessHours || businessHours.length === 0) {
      return "Horário não disponível";
    }

    // Obter dia da semana atual em português
    const daysInPortuguese = [
      "Domingo",
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
    ];

    // Configurar a data para o timezone de São Paulo (UTC-3)
    const today = new Date();
    const dayOfWeek = daysInPortuguese[today.getDay()];

    // Formatar a data no padrão brasileiro (dia/mês/ano)
    const formattedDate = format(today, "dd/MM/yyyy", { locale: ptBR });

    // Encontrar o registro para hoje
    const todayBusinessHour = businessHours.find(
      (hour) => hour.day_of_week === dayOfWeek
    );

    if (!todayBusinessHour) {
      return `Hoje dia ${formattedDate}, ${dayOfWeek} - Horário não disponível`;
    }

    if (todayBusinessHour.is_closed) {
      return `Hoje dia ${formattedDate}, ${dayOfWeek} estamos fechados`;
    }

    return `Hoje dia ${formattedDate}, ${dayOfWeek} estamos abertos das ${formatTime(
      todayBusinessHour.open_time
    )} às ${formatTime(todayBusinessHour.close_time)}`;
  };

  // Efeito para carregar horários de funcionamento
  useEffect(() => {
    const fetchBusinessHours = async () => {
      if (!tenantId) {
        setBusinessHours([]);
        return;
      }

      setIsLoadingBusinessHours(true);

      try {
        const { data, error } = await supabase
          .from("business_hours")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("id");

        if (error) {
          throw error;
        }

        if (data) {
          setBusinessHours(data);
        }
      } catch (error) {
        console.error("Erro ao carregar horários de funcionamento:", error);
        toast.error("Erro ao carregar horários de funcionamento");
      } finally {
        setIsLoadingBusinessHours(false);
      }
    };

    fetchBusinessHours();
  }, [tenantId]);

  useEffect(() => {
    if (!fetchAttempted && tenantId) {
      const fetchProducts = async () => {
        try {
          setLoading(true);
          setFetchAttempted(true);

          // Public storefront must use tenant-explicit RPC (slug -> tenantId)
          const { data: productsData, error: productsError } = await supabase.rpc(
            "get_product_full_by_tenant",
            { p_tenant_id: tenantId }
          );

          if (productsError) throw productsError;

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

          const formattedProducts = (productsData || []).map((product: any) => ({
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
                groupBehavior: g.behavior_type
              })))
          }));

          setProducts(formattedProducts);

          const uniqueCategories = [
            ...new Set(formattedProducts.map((product) => product.category)),
          ];
          setCategories(uniqueCategories);

          setError(false);
        } catch (error) {
          console.error("Error fetching products:", error);
          setError(true);
          toast.error("Erro ao carregar produtos.");
        } finally {
          setLoading(false);
        }
      };

      fetchProducts();
    }
  }, [fetchAttempted, tenantId]);

  useEffect(() => {
    setFetchAttempted(false);
    setProducts([]);
    setCategories([]);
    setSelectedCategory("all");
  }, [tenantId]);

  useEffect(() => {
    if (!orderingBlocked) {
      return;
    }

    setSelectedProduct(null);
    setCartOpen(false);
  }, [orderingBlocked]);

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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

  const handleAddToCart = (
    product: Product,
    quantity = 1,
    selectedAddons?: ProductAddon[],
    notes?: string,
    variation?: { id: string; name: string; price: number; sort_order: number }
  ) => {
    if (orderingBlocked) {
      toast.error(orderingBlockedToastMessage);
      return;
    }

    const hasModifiers = shouldOpenProductDialog(product);
    const hasVariationSelection = Boolean(variation);
    const isQuickAdd =
      hasModifiers &&
      !hasVariationSelection &&
      (!selectedAddons || selectedAddons.length === 0);

    if (isQuickAdd) {
      setCartItems((prevItems) => {
        const existingItemIndex = prevItems.findIndex(
          (item) =>
            item.product.id === product.id &&
            (!item.selectedAddons || item.selectedAddons.length === 0)
        );

        if (existingItemIndex >= 0) {
          const updatedItems = [...prevItems];
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            quantity: updatedItems[existingItemIndex].quantity + 1,
          };
          return updatedItems;
        } else {
          return [...prevItems, { product, quantity: 1 }];
        }
      });
    } else {
      setCartItems((prevItems) => {
        const existingItemIndex = prevItems.findIndex((item) => {
          if (item.product.id !== product.id) return false;

          if (item.notes !== notes) return false;

          if (
            (!item.selectedAddons && selectedAddons) ||
            (item.selectedAddons && !selectedAddons)
          )
            return false;

          if (!item.selectedAddons && !selectedAddons) return true;

          if (item.selectedAddons && selectedAddons) {
            if (item.selectedAddons.length !== selectedAddons.length)
              return false;

            return item.selectedAddons.every((itemAddon) => {
              const matchingAddon = selectedAddons.find(
                (a) => a.id === itemAddon.id
              );
              return (
                matchingAddon && matchingAddon.quantity === itemAddon.quantity
              );
            });
          }

          return false;
        });

        if (existingItemIndex >= 0) {
          const updatedItems = [...prevItems];
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            quantity: updatedItems[existingItemIndex].quantity + quantity,
          };
          return updatedItems;
        } else {
          return [
            ...prevItems,
            {
              product,
              quantity,
              selectedAddons,
              notes,
            },
          ];
        }
      });
    }

    toast.success(`${product.name} foi adicionado ao seu pedido`);
  };

  const handleRemoveFromCart = (productId: string, itemIndex: number) => {
    setCartItems((prevItems) => {
      const targetItem = prevItems[itemIndex];

      if (targetItem.quantity > 1) {
        return prevItems.map((item, idx) =>
          idx === itemIndex ? { ...item, quantity: item.quantity - 1 } : item
        );
      } else {
        return prevItems.filter((_, idx) => idx !== itemIndex);
      }
    });
  };

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const totalPrice = cartItems.reduce((sum, item) => {
    let itemTotal = item.product.price * item.quantity;

    if (item.selectedAddons && item.selectedAddons.length > 0) {
      const addonsTotal = item.selectedAddons.reduce(
        (addonSum, addon) => {
          const behavior = String(addon.groupBehavior ?? "").toLowerCase();
          if (behavior === "fractional" || behavior === "flavor_mix") {
            return addonSum;
          }
          return addonSum + addon.price * (addon.quantity || 1);
        },
        0
      );
      itemTotal += addonsTotal * item.quantity;
    }

    return sum + itemTotal;
  }, 0);

  // Handler para rastrear quando o carrinho é aberto ou fechado
  const handleCartToggle = (isOpen: boolean) => {
    setCartOpen(isOpen);
  };

  if (isLoadingTenant) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 text-foreground">
        <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card px-6 py-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Carregando loja...</h1>
          <p className="mt-2 text-sm text-muted-foreground">Estamos validando o endereço público.</p>
        </div>
      </div>
    );
  }

  if (isPublicTenantError) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 text-foreground">
        <div className="mx-auto max-w-2xl rounded-xl border border-amber-200/80 bg-card px-6 py-8 text-center shadow-sm dark:border-amber-800/80">
          <h1 className="text-xl font-semibold text-amber-700 dark:text-amber-300">Erro ao carregar a loja</h1>
          <p className="mt-2 text-sm text-muted-foreground">Tente atualizar a página novamente.</p>
        </div>
      </div>
    );
  }

  if (isNotFound || !tenant) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 text-foreground">
        <div className="mx-auto max-w-2xl rounded-xl border border-red-200/80 bg-card px-6 py-8 text-center shadow-sm dark:border-red-800/80">
          <h1 className="text-xl font-semibold text-red-700 dark:text-red-300">Loja não encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O link <strong>/r/{slug ?? ""}</strong> não corresponde a uma loja válida.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col min-h-screen bg-background text-foreground ${
        cartOpen ? "overflow-hidden h-screen" : ""
      }`}
    >
      <RestaurantHeader overrideSlug={overrideSlug} />

      <div className="flex flex-col flex-1">
        <div className="flex-1 p-4">
          <div className="max-w-5xl mx-auto">
            <ActiveOrderBanner />

            <div className="mb-6">
              <Tabs defaultValue="menu">
                <TabsList className="w-full">
                  <TabsTrigger value="menu" className="flex-1">
                    Menu
                  </TabsTrigger>
                  {/* <TabsTrigger value="reviews" className="flex-1">
                    Avaliações
                  </TabsTrigger> */}
                  <TabsTrigger value="info" className="flex-1">
                    Informações
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="menu" className="pt-4">
                  {orderingBlocked && (
                    <div
                      className={`mb-4 rounded-xl px-4 py-3 text-sm ${
                        orderingBlockedByBusinessHours
                          ? "border border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                          : "border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
                      }`}
                    >
                      {orderingBlockedMessage}
                    </div>
                  )}

                  <div className="mb-4 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar produtos..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      disabled={orderingBlocked}
                    />
                  </div>

                  <CategoryFilter
                    categories={categories}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                  />

                  <ProductList
                    products={filteredProducts}
                    orderingBlocked={orderingBlocked}
                    onAddToCart={(product, quantity, addons, notes, variation) => {
                      const fromConfiguredSelection =
                        quantity !== undefined ||
                        (addons && addons.length > 0) ||
                        Boolean(notes) ||
                        Boolean(variation);

                      if (shouldOpenProductDialog(product) && !fromConfiguredSelection) {
                        setSelectedProduct(product);
                      } else {
                        handleAddToCart(product, quantity, addons, notes, variation);
                      }
                    }}
                    isLoading={loading || isLoadingTenant}
                    isError={error}
                  />

                  <ProductDetailDialog
                    product={selectedProduct}
                    open={!!selectedProduct && !orderingBlocked}
                    onOpenChange={(isOpen) => !isOpen && setSelectedProduct(null)}
                    orderingBlocked={orderingBlocked}
                    onAddToCart={handleAddToCart}
                  />
                </TabsContent>
                <TabsContent value="reviews">
                  <div className="py-8 text-center">
                    <h3 className="text-lg font-medium mb-2">
                      Avaliações dos clientes
                    </h3>
                    <div className="flex justify-center items-center gap-2 mb-4">
                      <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      <Star className="h-5 w-5 text-muted-foreground" />
                      {/* <span className="text-lg font-bold ml-2">4.2</span> */}
                    </div>
                    <p className="text-muted-foreground">
                      Baseado em 120 avaliações
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="info">
                  <div className="py-6">
                    <h3 className="text-lg font-medium mb-4">
                      Informações do restaurante
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-delivery-500 mt-0.5" />
                        <div>
                          <p className="text-muted-foreground">
                            {restaurant?.address || "Endereço não disponível"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Clock className="h-5 w-5 text-delivery-500 mt-0.5" />
                        <div>
                          <p className="text-muted-foreground">
                            {getTodayBusinessHours()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>

      <FloatingCart
        cartItems={cartItems}
        onAddItem={handleAddToCart}
        onRemoveItem={handleRemoveFromCart}
        totalItems={totalItems}
        totalPrice={totalPrice}
        onOpenChange={handleCartToggle}
        tenantId={tenantId}
        restaurant={restaurant}
        orderingBlocked={orderingBlocked}
        orderingBlockedMessage={orderingBlockedToastMessage}
      />
    </div>
  );
}



