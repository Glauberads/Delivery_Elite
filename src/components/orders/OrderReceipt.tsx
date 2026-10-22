import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import JsBarcode from "jsbarcode";
import { Badge } from "@/components/ui/badge";
import { OrderItem, OrderStatus, PaymentMethod, OrderType } from "@/types";
import { MapPin, Package2, Users } from "lucide-react";
import { usePaymentMethods } from "@/hooks/useOrders";
import { useAuth } from "@/contexts/AuthContext";

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
  paperWidth?: "58mm" | "80mm";
  fontSize?: "normal" | "large" | "xlarge";
}

export function OrderReceipt({
  orderId,
  paperWidth = "58mm",
  fontSize = "large",
}: OrderReceiptProps) {
  const { data: paymentMethods = [] } = usePaymentMethods();
  const { user } = useAuth();

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant-info", user?.tenantId],
    queryFn: async () => {
      if (!user?.tenantId) throw new Error("Tenant ID is required");
      
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
        .eq("tenant_id", user.tenantId)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      return {
        id: data.id,
        address: data.address ?? null,
        name: data.tenant?.name ?? "",
        phone: data.tenant?.phone ?? null,
      } as RestaurantFromDB;
    },
    enabled: !!user?.tenantId,
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
        const is58mm = paperWidth === "58mm";
        JsBarcode(canvas, order.number.padStart(7, "0"), {
          format: "CODE128",
          width: is58mm ? 1.3 : 2,
          height: is58mm ? 36 : 50,
          fontSize: is58mm ? 12 : 14,
          displayValue: true,
          margin: 0,
          background: "#ffffff",
        });
        canvas.style.maxWidth = "100%";
        canvas.style.height = "auto";
        canvas.style.display = "block";
        canvas.style.margin = "0 auto";
        const barcodeContainer = document.getElementById(
          "barcode-container-" + order.id
        );
        if (barcodeContainer) {
          barcodeContainer.innerHTML = "";
          barcodeContainer.appendChild(canvas);
        }
      }, 100);
    }
  }, [order?.number, order?.id, paperWidth]);

  // Determine the order type based on order properties
  const getOrderType = (order: OrderFromDB): OrderTypeDisplay => {
    if (order.delivery_address) {
      return {
        type: "delivery",
        label: "Entrega",
        icon: <MapPin className="h-3.5 w-3.5 mr-1" />,
        className: "bg-green-100 text-green-700",
      };
    } else if (order.table_number) {
      return {
        type: "table",
        label: `Mesa ${order.table_number}`,
        icon: <Users className="h-3.5 w-3.5 mr-1" />,
        className: "bg-purple-100 text-purple-700",
      };
    } else {
      return {
        type: "pickup",
        label: "Retirada",
        icon: <Package2 className="h-3.5 w-3.5 mr-1" />,
        className: "bg-yellow-100 text-yellow-700",
      };
    }
  };

  if (!order || !restaurant) return null;

  const orderType = getOrderType(order);
  const is58mm = paperWidth === "58mm";

  // Classes para tamanhos de fonte
  const sizeConfig = {
    normal: {
      root: "text-sm leading-normal",
      title: "text-lg font-bold",
      subtitle: "text-xs",
      orderNum: "text-base font-bold",
      badge: "text-xs font-bold",
      sectionTitle: "text-sm font-bold",
      item: "text-sm",
      itemAddon: "text-xs",
      total: "text-base font-bold",
      notes: "text-xs font-bold",
    },
    large: {
      root: "text-base leading-snug",
      title: "text-xl font-black",
      subtitle: "text-sm",
      orderNum: "text-lg font-black",
      badge: "text-sm font-bold",
      sectionTitle: "text-base font-bold",
      item: "text-base",
      itemAddon: "text-sm",
      total: "text-lg font-black",
      notes: "text-sm font-bold",
    },
    xlarge: {
      root: "text-lg leading-snug",
      title: "text-2xl font-black",
      subtitle: "text-base",
      orderNum: "text-xl font-black",
      badge: "text-base font-bold",
      sectionTitle: "text-lg font-bold",
      item: "text-lg",
      itemAddon: "text-base",
      total: "text-xl font-black",
      notes: "text-base font-bold",
    },
  }[fontSize] || {
    root: "text-base leading-snug",
    title: "text-xl font-black",
    subtitle: "text-sm",
    orderNum: "text-lg font-black",
    badge: "text-sm font-bold",
    sectionTitle: "text-base font-bold",
    item: "text-base",
    itemAddon: "text-sm",
    total: "text-lg font-black",
    notes: "text-sm font-bold",
  };

  return (
    <div
      className={`receipt-wrapper font-mono text-black bg-white mx-auto ${
        is58mm ? "w-[240px] max-w-[240px] p-2" : "w-[310px] max-w-[310px] p-4"
      } ${sizeConfig.root} print:p-0 print:w-full`}
      style={{ boxSizing: "border-box" }}
    >
      {/* Restaurant Info */}
      <div className="text-center mb-4">
        <div className={`${sizeConfig.title} uppercase mb-1`}>{restaurant.name}</div>
        {restaurant.phone && <div className={sizeConfig.subtitle}>Tel: {restaurant.phone}</div>}
        {restaurant.address && <div className={sizeConfig.subtitle}>{restaurant.address}</div>}
      </div>

      {/* Separator */}
      <div className="border-t-2 border-dashed border-black my-3"></div>

      {/* Order Info */}
      <div className="mb-4 space-y-1">
        <div className="flex items-center justify-between gap-1 mb-2">
          <div className={`${sizeConfig.orderNum} tracking-tight`}>
            PEDIDO #{order.number}
          </div>
          <div className={`inline-flex items-center border-2 border-black px-1.5 py-0.5 rounded ${sizeConfig.badge} uppercase tracking-wider`}>
            {orderType.label}
          </div>
        </div>
        <div>
          <span className="font-bold">Data: </span>
          {new Date(order.created_at).toLocaleString("pt-BR")}
        </div>
        <div>
          <span className="font-bold">Cliente: </span>
          {order.customer_name}
        </div>
        <div>
          <span className="font-bold">Telefone: </span>
          {order.customer_phone}
        </div>
        {order.delivery_address && (
          <div>
            <span className="font-bold">Endereço: </span>
            {order.delivery_address}
          </div>
        )}
        {order.delivery_region && (
          <div>
            <span className="font-bold">Região: </span>
            {order.delivery_region.name}
          </div>
        )}
        {order.table_number && (
          <div>
            <span className="font-bold">Mesa: </span>
            {order.table_number}
          </div>
        )}
        {order.notes && (
          <div className={`mt-3 p-2 border-2 border-black border-dashed rounded font-bold uppercase text-center ${sizeConfig.notes}`}>
            ⚠️ OBS: {order.notes}
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="border-t-2 border-dashed border-black my-3"></div>

      {/* Items */}
      <div className="mb-4">
        <div className={`${sizeConfig.sectionTitle} uppercase mb-2 border-b border-black pb-1`}>
          ITENS DO PEDIDO
        </div>
        {order.items?.map((item: OrderItemFromDB) => (
          <div key={item.id} className="mb-3">
            <div className={`flex justify-between items-start font-bold ${sizeConfig.item}`}>
              <div className="pr-1 flex-1 break-words">
                {item.quantity}x {item.product.name}
              </div>
              <div className="shrink-0 text-right whitespace-nowrap">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format((item.basePrice || item.unit_price) * item.quantity)}
              </div>
            </div>

            {/* Display addons for this item */}
            {item.addons && item.addons.length > 0 && (
              <div className={`pl-3 space-y-1 my-1 ${sizeConfig.itemAddon}`}>
                {item.addons.map((addon: OrderItemAddonFromDB) => (
                  <div key={addon.id} className="flex justify-between items-start">
                    <div className="pr-1 flex-1 break-words">
                      + {addon.quantity}x {addon.addon.name}
                    </div>
                    <div className="shrink-0 text-right whitespace-nowrap">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(addon.addon.price * addon.quantity)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Display item notes if any */}
            {item.notes && (
              <div className={`pl-3 mt-1 italic font-semibold ${sizeConfig.itemAddon}`}>
                Obs: {item.notes}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Separator */}
      <div className="border-t-2 border-dashed border-black my-3"></div>

      {/* Totals */}
      <div className="mb-4 space-y-1">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(order.subtotal)}
          </span>
        </div>
        {order.delivery_fee > 0 && (
          <div className="flex justify-between">
            <span>Taxa entrega ({order.delivery_region?.name || "Entrega"}):</span>
            <span>
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(order.delivery_fee)}
            </span>
          </div>
        )}
        {order.discount > 0 && (
          <div className="flex justify-between">
            <span>Desconto:</span>
            <span>
              -{new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(order.discount)}
            </span>
          </div>
        )}
        <div className={`flex justify-between border-t-2 border-black pt-1.5 mt-2 ${sizeConfig.total}`}>
          <span>TOTAL:</span>
          <span>
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(order.total)}
          </span>
        </div>
        <div className="pt-2">
          <span className="font-bold">Pagamento: </span>
          <span>{getPaymentMethodLabel(order.payment_method)}</span>
        </div>
      </div>

      {/* Barcode */}
      <div
        className="text-center my-4"
        id={`barcode-container-${order.id}`}
      ></div>

      {/* Footer */}
      <div className="text-center mt-4 space-y-1">
        <div className="font-bold">Obrigado pela preferência!</div>
        <div className="text-xs text-black">
          Pedido gerado em: {new Date(order.created_at).toLocaleString("pt-BR")}
        </div>
      </div>
    </div>
  );
}



