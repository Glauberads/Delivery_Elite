import React, { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CheckoutForm } from "./CheckoutForm";
import { OrderConfirmation } from "./OrderConfirmation";
import { Product, ProductAddon } from "@/types";

interface CartItem {
  product: Product;
  quantity: number;
  selectedAddons?: ProductAddon[];
  notes?: string;
}

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartItems: CartItem[];
  totalPrice: number;
  onOrderComplete: () => void;
}

// Interface para corresponder aos dados recebidos do formulário de checkout
interface CustomerData {
  orderType: "delivery" | "takeaway" | "instore";
  name: string;
  phone: string;
  // Delivery fields
  zipCode?: string;
  streetName?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  // In-store fields
  tableNumber?: string;
  // Coupon
  coupon?: string;
  // Payment method
  paymentMethodId?: string;
  // Notas adicionais
  notes?: string;
}

// Interface para corresponder ao esquema do Supabase para a tabela orders
interface OrderData {
  customer_name: string;
  customer_phone: string;
  status: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  notes: string | null;
  order_type: string;
  delivery_address?: string;
  table_number?: string;
}

// Interface para corresponder ao esquema do Supabase para a tabela order_items
interface OrderItem {
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
}

// Interface para corresponder ao esquema do Supabase para a tabela order_item_addons
interface OrderItemAddon {
  order_item_id: string;
  addon_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

// Interface para os itens retornados da consulta ao Supabase
interface InsertedOrderItem {
  id: string;
  product_id: string;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  cartItems,
  totalPrice,
  onOrderComplete,
}: CheckoutDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const subtotal = totalPrice - 5.0; // Assuming delivery fee is 5.00
  const deliveryFee = 5.0;

  const handleCheckout = async (customerData: CustomerData) => {
    if (cartItems.length === 0) {
      toast.error("Seu carrinho está vazio");
      return;
    }

    setIsSubmitting(true);
    try {
      // Map the payment method from the form to a valid database value
      // Make sure this matches the allowed values in the database constraint
      const paymentMethodMapping: Record<string, string> = {
        pix: "pix",
        credit: "credit_card",
        debit: "debit_card",
        cash: "cash",
        bank: "bank_transfer",
        app: "app_payment",
      };

      // Get the paymentMethod from customerData, defaulting to 'pix' if not provided
      const paymentMethodId = customerData.paymentMethodId || "pix";
      // Map to database value, defaulting to 'pix' if mapping not found
      const dbPaymentMethod = paymentMethodMapping[paymentMethodId] || "pix";

      console.log("Using payment method:", dbPaymentMethod);

      // Prepare order data based on order type
      const orderData: OrderData = {
        customer_name: customerData.name,
        customer_phone: customerData.phone,
        status: "pending",
        payment_method: dbPaymentMethod,
        payment_status: "pending",
        subtotal,
        delivery_fee: customerData.orderType === "delivery" ? deliveryFee : 0,
        discount: 0,
        total:
          customerData.orderType === "delivery"
            ? totalPrice
            : totalPrice - deliveryFee,
        notes: customerData.notes || null,
        order_type: customerData.orderType, // Add the order type
      };

      // Add specific fields based on order type
      if (customerData.orderType === "delivery") {
        // Format delivery address
        const addressParts = [
          customerData.streetName,
          customerData.number,
          customerData.complement,
          customerData.neighborhood,
          customerData.zipCode,
        ].filter(Boolean);

        orderData.delivery_address = addressParts.join(", ");
      } else if (customerData.orderType === "instore") {
        orderData.table_number = customerData.tableNumber;
      }

      // Insert order
      const { data: createdOrder, error: orderError } = await supabase
        .from("orders")
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert order items
      const orderItems: OrderItem[] = cartItems.map((item) => ({
        order_id: createdOrder.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
        notes: item.notes || null,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Insert order item addons if any
      const orderItemAddons: OrderItemAddon[] = [];

      // Get the inserted order items to associate addons with them
      const { data: insertedItems } = await supabase
        .from("order_items")
        .select("id, product_id")
        .eq("order_id", createdOrder.id);

      if (insertedItems) {
        // Map each cart item's addons to their corresponding order item
        cartItems.forEach((cartItem) => {
          if (cartItem.selectedAddons && cartItem.selectedAddons.length > 0) {
            // Find the corresponding inserted order item
            const orderItem = insertedItems.find(
              (item) => item.product_id === cartItem.product.id
            );

            if (orderItem) {
              cartItem.selectedAddons.forEach((addon) => {
                orderItemAddons.push({
                  order_item_id: orderItem.id,
                  addon_id: addon.id,
                  quantity: addon.quantity || 1,
                  unit_price: addon.price,
                  total_price: addon.price * (addon.quantity || 1),
                });
              });
            }
          }
        });

        // Insert addons if there are any
        if (orderItemAddons.length > 0) {
          const { error: addonsError } = await supabase
            .from("order_item_addons")
            .insert(orderItemAddons);

          if (addonsError) throw addonsError;
        }
      }

      toast.success("Pedido realizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setOrderNumber(createdOrder.number);
      setOrderCompleted(true);
    } catch (error: unknown) {
      console.error("Error creating order:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao criar pedido: " + errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOrderDone = () => {
    setOrderCompleted(false);
    setOrderNumber(null);
    onOpenChange(false);
    onOrderComplete();
  };

  const handleSendToWhatsApp = () => {
    // This is just a placeholder function - you could implement WhatsApp integration here
    toast.info("Enviando pedido para WhatsApp...");
  };

  const handleTrackOrder = () => {
    // This is just a placeholder function - you could implement order tracking here
    toast.info("Acompanhando pedido...");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg p-0 overflow-y-auto"
      >
        {orderCompleted ? (
          <OrderConfirmation
            orderNumber={orderNumber || ""}
            estimatedTime="30-45 minutos"
            onSendToWhatsApp={handleSendToWhatsApp}
            onTrackOrder={handleTrackOrder}
            onClose={handleOrderDone}
          />
        ) : (
          <div className="px-4 py-6 h-full overflow-y-auto">
            <CheckoutForm
              subtotal={subtotal}
              deliveryFee={deliveryFee}
              onSubmit={handleCheckout}
              onCancel={() => onOpenChange(false)}
              isSubmitting={isSubmitting}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}



