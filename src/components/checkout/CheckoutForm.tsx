import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CustomerForm } from "./customer/CustomerForm";
import { OrderTypeSelector } from "./order-type/OrderTypeSelector";
import { DeliveryForm } from "./delivery/DeliveryForm";
import { InstoreForm } from "./instore/InstoreForm";
import { CouponForm } from "./coupon/CouponForm";
import { OrderSummary } from "./order-summary/OrderSummary";
import { PaymentMethodSelector } from "./payment/PaymentMethodSelector";
import { PaymentMethodFromDB } from "@/hooks/useOrders";

type OrderType = "delivery" | "takeaway" | "instore";

interface CheckoutFormData {
  orderType: OrderType;
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
}

interface CheckoutFormProps {
  subtotal: number;
  deliveryFee: number;
  onSubmit: (data: CheckoutFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function CheckoutForm({
  subtotal,
  deliveryFee,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: CheckoutFormProps) {
  const [orderType, setOrderType] = useState<OrderType>("delivery");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodFromDB[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Initialize form with default values
  const form = useForm<CheckoutFormData>({
    defaultValues: {
      orderType: "delivery",
      name: "",
      phone: "",
    },
  });

  // Fetch payment methods once on component mount
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      // Skip if we already have payment methods
      if (paymentMethods.length > 0) return;

      setIsLoading(true);
      try {
        console.log("Fetching payment methods from Supabase...");
        const { data, error } = await supabase
          .from("payment_methods")
          .select("id, name, icon")
          .eq("enabled", true)
          .order("display_order", { ascending: true });

        if (error) throw error;

        console.log("Payment methods fetched:", data);
        setPaymentMethods(data as PaymentMethodFromDB[]);
      } catch (error: any) {
        console.error("Error fetching payment methods:", error);
        toast({
          variant: "destructive",
          title: "Erro ao carregar métodos de pagamento",
          description: error.message,
        });
        // Set fallback payment methods in case of error
        setPaymentMethods([
          { id: "pix", name: "PIX", icon: "qr-code", enabled: true },
          {
            id: "credit",
            name: "Cartão de Crédito",
            icon: "credit-card",
            enabled: true,
          },
          { id: "cash", name: "Dinheiro", icon: "banknote", enabled: true },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaymentMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const handleOrderTypeChange = (value: OrderType) => {
    setOrderType(value);
    form.setValue("orderType", value);
  };

  const handleSubmit = (data: CheckoutFormData) => {
    console.log("Form submitted with data:", data);
    onSubmit({
      ...data,
      orderType,
    });
  };

  return (
    <div className="space-y-4">
      <OrderTypeSelector
        orderType={orderType}
        onChange={handleOrderTypeChange}
        isSubmitting={isSubmitting}
      />

      <div className="border-t pt-4">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <CustomerForm form={form} isSubmitting={isSubmitting} />

            {orderType === "delivery" && (
              <DeliveryForm form={form} isSubmitting={isSubmitting} />
            )}

            {orderType === "instore" && (
              <InstoreForm form={form} isSubmitting={isSubmitting} />
            )}

            <PaymentMethodSelector
              form={form}
              paymentMethods={paymentMethods}
              isSubmitting={isSubmitting || isLoading}
            />

            <CouponForm form={form} isSubmitting={isSubmitting} />

            <div className="border-t pt-4">
              <OrderSummary
                subtotal={subtotal}
                deliveryFee={deliveryFee}
                orderType={orderType}
              />
            </div>

            <FormActions onCancel={onCancel} isSubmitting={isSubmitting} />
          </form>
        </Form>
      </div>
    </div>
  );
}

function FormActions({
  onCancel,
  isSubmitting,
}: {
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="flex gap-3 pt-4 sticky bottom-0 bg-white pb-2">
      <Button
        type="button"
        variant="outline"
        className="flex-1"
        onClick={onCancel}
        disabled={isSubmitting}
      >
        Voltar
      </Button>
      <Button
        type="submit"
        className={`flex-1 bg-red-500 hover:bg-red-600 ${
          isSubmitting ? "opacity-70 cursor-not-allowed" : ""
        }`}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Processando..." : "Finalizar Pedido"}
      </Button>
    </div>
  );
}



