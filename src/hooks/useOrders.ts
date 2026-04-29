import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Order,
  PaymentMethod,
  OrderType,
  OrderStatus,
  PaymentStatus,
} from "@/types";

// Define database schema types
interface ProductFromDB {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id: string;
  image_url?: string;
  available: boolean;
  featured: boolean;
  created_at: string;
  updated_at: string;
}

interface AddonFromDB {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id?: string;
  available: boolean;
  created_at: string;
  updated_at: string;
}

type OrderFromDB = {
  id: string;
  number: string;
  customer_name: string;
  customer_phone: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  items?: OrderItemFromDB[];
  order_type: OrderType;
  table_number?: string;
};

type OrderItemFromDB = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  created_at: string;
  product: ProductFromDB;
  addons?: OrderItemAddonFromDB[];
};

type OrderItemAddonFromDB = {
  id: string;
  order_item_id: string;
  addon_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  addon: AddonFromDB;
};

// Define payment method types
export type PaymentMethodFromDB = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  enabled: boolean;
  display_order?: number;
  created_at?: string;
  updated_at?: string;
  restaurant_id?: string;
};

// Convert database schema to our app's type schema
function mapOrderFromDB(order: OrderFromDB): Order {
  return {
    id: order.id,
    number: order.number,
    customer: {
      id: "",
      name: order.customer_name,
      phone: order.customer_phone,
      email: "",
      createdAt: new Date(order.created_at),
    },
    items:
      order.items?.map((item) => ({
        id: item.id,
        product: {
          id: item.product.id,
          name: item.product.name,
          description: item.product.description,
          price: item.product.price,
          category: item.product.category_id,
          imageUrl: item.product.image_url,
          available: item.product.available,
          createdAt: new Date(item.product.created_at),
          updatedAt: new Date(item.product.updated_at),
        },
        quantity: item.quantity,
        price: item.total_price,
        basePrice: item.unit_price,
        addons:
          item.addons?.map((addon) => ({
            addon: {
              id: addon.addon.id,
              name: addon.addon.name,
              price: addon.addon.price,
            },
            quantity: addon.quantity,
            price: addon.total_price,
          })) || [],
        notes: item.notes,
      })) || [],
    status: order.status,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    subtotal: order.subtotal,
    deliveryFee: order.delivery_fee,
    discount: order.discount,
    total: order.total,
    notes: order.notes,
    createdAt: new Date(order.created_at),
    updatedAt: new Date(order.updated_at),
    orderType: order.order_type,
  };
}

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          items:order_items(
            *,
            product:products(*),
            addons:order_item_addons(
              *,
              addon:product_addons(*)
            )
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data as unknown as OrderFromDB[]).map(mapOrderFromDB);
    },
  });
}

interface PaginatedOrdersParams {
  page?: number;
  limit?: number;
  searchQuery?: string;
  statusFilter?: string;
}

interface PaginatedOrdersResult {
  orders: Order[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function usePaginatedOrders({
  page = 1,
  limit = 10,
  searchQuery = "",
  statusFilter = "all"
}: PaginatedOrdersParams = {}) {
  return useQuery({
    queryKey: ["orders", "paginated", page, limit, searchQuery, statusFilter],
    queryFn: async (): Promise<PaginatedOrdersResult> => {
      // Primeiro, vamos buscar o total de registros para calcular a paginação
      let countQuery = supabase
        .from("orders")
        .select("*", { count: "exact", head: true });

      // Aplicar filtros na contagem
      if (searchQuery) {
        countQuery = countQuery.or(
          `id.ilike.%${searchQuery}%,number.ilike.%${searchQuery}%,customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%`
        );
      }

      if (statusFilter !== "all") {
        countQuery = countQuery.eq("status", statusFilter);
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        throw countError;
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);
      const offset = (page - 1) * limit;

      // Agora buscar os dados paginados
      let dataQuery = supabase
        .from("orders")
        .select(
          `
          *,
          items:order_items(
            *,
            product:products(*),
            addons:order_item_addons(
              *,
              addon:product_addons(*)
            )
          )
        `
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      // Aplicar os mesmos filtros nos dados
      if (searchQuery) {
        dataQuery = dataQuery.or(
          `id.ilike.%${searchQuery}%,number.ilike.%${searchQuery}%,customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%`
        );
      }

      if (statusFilter !== "all") {
        dataQuery = dataQuery.eq("status", statusFilter);
      }

      const { data, error } = await dataQuery;

      if (error) {
        throw error;
      }

      const orders = (data as unknown as OrderFromDB[]).map(mapOrderFromDB);

      return {
        orders,
        totalCount,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      };
    },
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ["paymentMethods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("enabled", true)
        .order("display_order", { ascending: true });

      if (error) {
        throw error;
      }

      return data as PaymentMethodFromDB[];
    },
  });
}



