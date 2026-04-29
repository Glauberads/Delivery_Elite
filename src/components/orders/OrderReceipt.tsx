import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import JsBarcode from "jsbarcode";
import { Badge } from "@/components/ui/badge";
import { OrderItem, OrderStatus, PaymentMethod, OrderType } from "@/types";
import { MapPin, Package2, Users } from "lucide-react";
import { usePaymentMethods } from "@/hooks/useOrders";

// Interfaces para os dados vindos do Supabase
interface RestaurantFromDB {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
}

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

interface OrderTypeDisplay {
  type: string;
  label: string;
  icon: React.ReactNode;
  className: string;
}

interface OrderReceiptProps {
  orderId: string;
}

export function OrderReceipt({ orderId }: OrderReceiptProps) {
  const { data: paymentMethods = [] } = usePaymentMethods();

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant-info"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select(`
          id,
          address,
          tenant:tenants (
            name,
            phone
          )
        `)
        .single();

      if (error) throw error;
      return {
        id: data.id,
        address: data.address ?? null,
        name: data.tenant?.name ?? "",
        phone: data.tenant?.phone ?? null,
      } as RestaurantFromDB;
    },
  });

  const { data: order } = useQuery({
    queryKey: ["order-receipt", orderId],
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

  // Function to get payment method name from ID
  const getPaymentMethodLabel = (methodId: string) => {
    const method = paymentMethods.find((m) => m.id === methodId);
    return method ? method.name : methodId;
  };

  React.useEffect(() => {
    if (order?.number) {
      setTimeout(() => {
        const canvas = document.createElement("canvas");
        JsBarcode(canvas, order.number.padStart(7, "0"), {
          format: "CODE128",
          width: 2,
          height: 50,
          displayValue: true,
          margin: 0,
          background: "#ffffff",
        });
        const barcodeContainer = document.getElementById(
          "barcode-container-" + order.id
        );
        if (barcodeContainer) {
          barcodeContainer.innerHTML = "";
          barcodeContainer.appendChild(canvas);
        }
      }, 100);
    }
  }, [order?.number, order?.id]);

  // Determine the order type based on order properties
  const getOrderType = (order: OrderFromDB): OrderTypeDisplay => {
    if (order.delivery_address) {
      return {
        type: "delivery",
        label: "Entrega",
        icon: <MapPin className="h-3 w-3 mr-1" />,
        className: "bg-green-100 text-green-700",
      };
    } else if (order.table_number) {
      return {
        type: "table",
        label: `Mesa ${order.table_number}`,
        icon: <Users className="h-3 w-3 mr-1" />,
        className: "bg-purple-100 text-purple-700",
      };
    } else {
      return {
        type: "pickup",
        label: "Retirada",
        icon: <Package2 className="h-3 w-3 mr-1" />,
        className: "bg-yellow-100 text-yellow-700",
      };
    }
  };

  if (!order || !restaurant) return null;

  const orderType = getOrderType(order);

  return (
    <div className="w-[300px] p-4 font-mono text-sm leading-tight print:p-0 print:w-full print:text-black">
      {/* Restaurant Info */}
      <div className="text-center mb-6">
        <div className="text-xl font-bold mb-2">{restaurant.name}</div>
        <div className="mb-1">{restaurant.phone}</div>
        <div>{restaurant.address}</div>
      </div>

      {/* Separator */}
      <div className="border-t border-dashed my-5"></div>

      {/* Order Info */}
      <div className="mb-5 space-y-1">
        <div className="flex items-center justify-between mb-2">
          <div className="font-bold">PEDIDO #{order.number}</div>
          <div
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border-0 font-semibold"
            style={{
              backgroundColor: orderType.className.split(" ")[0],
              color: orderType.className.split(" ")[1],
            }}
          >
            {orderType.icon}
            {orderType.label}
          </div>
        </div>
        <div className="mb-1">
          Data: {new Date(order.created_at).toLocaleString("pt-BR")}
        </div>
        <div className="mb-1">Cliente: {order.customer_name}</div>
        <div className="mb-1">Telefone: {order.customer_phone}</div>
        {order.delivery_address && (
          <>
            <div className="mb-1">Endereço: {order.delivery_address}</div>
            {order.delivery_region && (
              <div className="mb-1">Região: {order.delivery_region.name}</div>
            )}
          </>
        )}
        {order.table_number && (
          <div className="mb-1">Mesa: {order.table_number}</div>
        )}
      </div>

      {/* Separator */}
      <div className="border-t border-dashed my-5"></div>

      {/* Items */}
      <div className="mb-5">
        <div className="font-bold mb-3">ITENS DO PEDIDO</div>
        {order.items?.map((item: OrderItemFromDB) => (
          <div key={item.id} className="mb-4">
            <div className="flex justify-between mb-1">
              <div>
                {item.quantity}x {item.product.name}
              </div>
              <div>
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format((item.basePrice || item.unit_price) * item.quantity)}
              </div>
            </div>

            {/* Display addons for this item */}
            {item.addons && item.addons.length > 0 && (
              <div className="pl-4 text-xs space-y-1 my-2">
                {item.addons.map((addon: OrderItemAddonFromDB) => (
                  <div key={addon.id} className="flex justify-between">
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
              <div className="text-xs pl-4 mt-1">Obs: {item.notes}</div>
            )}
          </div>
        ))}
      </div>

      {/* Separator */}
      <div className="border-t border-dashed my-4"></div>

      {/* Totals */}
      <div className="mb-5 space-y-2">
        <div className="flex justify-between">
          <div>Sub-total:</div>
          <div>
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(order.subtotal)}
          </div>
        </div>
        {order.delivery_fee > 0 && (
          <div className="flex justify-between">
            <div>Taxa de entrega ({order.delivery_region?.name}):</div>
            <div>
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(order.delivery_fee)}
            </div>
          </div>
        )}
        <div className="flex justify-between font-bold pt-1">
          <div>TOTAL:</div>
          <div>
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(order.total)}
          </div>
        </div>
        <div className="mt-3 pt-1">
          <div>
            Forma de pagamento: {getPaymentMethodLabel(order.payment_method)}
          </div>
        </div>
      </div>

      {/* Barcode */}
      <div
        className="text-center mb-5"
        id={`barcode-container-${order.id}`}
      ></div>

      {/* Footer */}
      <div className="text-center mt-5 space-y-2">
        <div className="font-bold">Obrigado pela preferência!</div>
        <div className="text-xs mt-2">
          Pedido gerado em: {new Date(order.created_at).toLocaleString("pt-BR")}
        </div>
      </div>
    </div>
  );
}



