import React from "react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CreditCard, Banknote, QrCode, Landmark, Wallet } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { PaymentMethodFromDB } from "@/hooks/useOrders";

interface PaymentMethodSelectorProps {
  form: UseFormReturn<any>;
  isSubmitting?: boolean;
  paymentMethods: PaymentMethodFromDB[];
}

export function PaymentMethodSelector({
  form,
  isSubmitting = false,
  paymentMethods,
}: PaymentMethodSelectorProps) {
  if (!paymentMethods || paymentMethods.length === 0) {
    return null;
  }

  const getIcon = (iconName: string | undefined) => {
    switch (iconName) {
      case "credit-card":
        return <CreditCard className="h-5 w-5" />;
      case "banknote":
        return <Banknote className="h-5 w-5" />;
      case "qr-code":
        return <QrCode className="h-5 w-5" />;
      case "landmark":
        return <Landmark className="h-5 w-5" />;
      case "wallet":
        return <Wallet className="h-5 w-5" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  // Set default payment method on component mount, but only once
  React.useEffect(() => {
    // Only set default if no value is currently set and we have payment methods
    if (paymentMethods.length > 0 && !form.getValues("paymentMethodId")) {
      console.log("Setting default payment method:", paymentMethods[0].id);
      form.setValue("paymentMethodId", paymentMethods[0].id, {
        shouldValidate: true,
      });
    }
    // Remove form from dependency array to prevent infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethods]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Método de Pagamento</h3>

      <FormField
        control={form.control}
        name="paymentMethodId"
        render={({ field }) => (
          <FormItem className="space-y-2">
            <FormLabel>Selecione como deseja pagar</FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={(value) => {
                  console.log("Selected payment method:", value);
                  field.onChange(value);
                }}
                value={field.value || ""}
                className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                disabled={isSubmitting}
              >
                {paymentMethods.map((method) => (
                  <div key={method.id} className="relative">
                    <RadioGroupItem
                      value={method.id}
                      id={`payment-${method.id}`}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={`payment-${method.id}`}
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                      {getIcon(method.icon)}
                      <span className="mt-2 text-center font-medium">
                        {method.name}
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}



