import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OrderStatus, PaymentMethod } from "@/types";
import { usePaymentMethods } from "@/hooks/useOrders";

// Interfaces para os dados vindos do Supabase
interface OrderFromDB {
  id: string;
  number: string;
  customer_name: string;
  customer_phone: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: string;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  table_number?: string;
  delivery_address?: string;
  delivery_region?: {
    id: string;
    name: string;
    fee: number;
  };
  items?: OrderItemFromDB[];
}

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

interface OrderItemFromDB {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  basePrice?: number;
  total_price: number;
  notes?: string;
  created_at: string;
  product: ProductFromDB;
  addons?: OrderItemAddonFromDB[];
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

interface OrderItemAddonFromDB {
  id: string;
  order_item_id: string;
  addon_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  addon: AddonFromDB;
}

interface OrderDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
}

export function OrderDetailsDialog({
  open,
  onClose,
  orderId,
}: OrderDetailsDialogProps) {
  const { data: paymentMethods = [] } = usePaymentMethods();

  const { data: order } = useQuery({
    queryKey: ["order-details", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          delivery_region:delivery_regions (*),
          items:order_items (
            *,
            product:products (*),
            addons:order_item_addons (
              *,
              addon:product_addons (*)
            )
          )
        `
        )
        .eq("id", orderId)
        .single();

      if (error) throw error;
      return data as OrderFromDB;
    },
    enabled: !!orderId,
  });

  const getPaymentMethodLabel = (methodId: string) => {
    const method = paymentMethods.find((m) => m.id === methodId);
    return method ? method.name : methodId;
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Detalhes do Pedido #{order.number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Informações do Cliente */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Informações do Cliente</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Nome:</div>
              <div className="font-medium">{order.customer_name}</div>
              <div>Telefone:</div>
              <div className="font-medium">{order.customer_phone}</div>
              {order.delivery_address && (
                <>
                  <div>Endereço:</div>
                  <div className="font-medium">{order.delivery_address}</div>
                  {order.delivery_region && (
                    <>
                      <div>Região de Entrega:</div>
                      <div className="font-medium">
                        {order.delivery_region.name}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Itens do Pedido */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Itens do Pedido</h3>
            <div className="space-y-3">
              {order.items?.map((item: OrderItemFromDB) => (
                <div key={item.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <div>
                      {item.quantity}x {item.product.name}
                    </div>
                    <div className="font-medium">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(item.unit_price * item.quantity)}
                    </div>
                  </div>

                  {/* Display addons for this item */}
                  {item.addons && item.addons.length > 0 && (
                    <div className="pl-4 space-y-0.5">
                      {item.addons.map((addon: OrderItemAddonFromDB) => (
                        <div
                          key={addon.id}
                          className="flex justify-between text-xs text-muted-foreground"
                        >
                          <div>
                            + {addon.quantity}x {addon.addon.name}
                          </div>
                          <div>
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(addon.addon.price)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Display item notes if any */}
                  {item.notes && (
                    <div className="text-xs italic text-muted-foreground pl-4">
                      Obs: {item.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Resumo do Pedido */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Resumo do Pedido</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <div>Subtotal:</div>
                <div className="font-medium">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(order.subtotal)}
                </div>
              </div>
              {order.delivery_fee > 0 && (
                <div className="flex justify-between">
                  <div>Taxa de entrega ({order.delivery_region?.name}):</div>
                  <div className="font-medium">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(order.delivery_fee)}
                  </div>
                </div>
              )}
              <div className="flex justify-between text-base font-bold">
                <div>Total:</div>
                <div>
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(order.total)}
                </div>
              </div>
            </div>
          </div>

          {/* Informações Adicionais */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Informações Adicionais</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Status:</div>
              <div className="font-medium capitalize">{order.status}</div>
              <div>Forma de pagamento:</div>
              <div className="font-medium capitalize">
                {getPaymentMethodLabel(order.payment_method)}
              </div>
              <div>Data do pedido:</div>
              <div className="font-medium">
                {new Date(order.created_at).toLocaleString("pt-BR")}
              </div>
              {order.notes && order.notes.trim() !== "" && (
                <>
                  <div>Observações:</div>
                  <div className="font-medium">{order.notes}</div>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



