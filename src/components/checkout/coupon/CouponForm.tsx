
import React from 'react';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { UseFormReturn } from 'react-hook-form';

interface CouponFormProps {
  form: UseFormReturn<any>;
  isSubmitting: boolean;
}

export function CouponForm({ form, isSubmitting }: CouponFormProps) {
  return (
    <div className="bg-blue-50 p-4 rounded-md">
      <FormField
        control={form.control}
        name="coupon"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cupom</FormLabel>
            <FormControl>
              <Input placeholder="Código do cupom" {...field} disabled={isSubmitting} />
            </FormControl>
            <p className="text-xs text-muted-foreground mt-1">
              Se você tem um cupom de desconto, adicione aqui.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}



