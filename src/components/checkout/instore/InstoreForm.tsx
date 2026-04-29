
import React from 'react';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { UseFormReturn } from 'react-hook-form';

interface InstoreFormProps {
  form: UseFormReturn<any>;
  isSubmitting: boolean;
}

export function InstoreForm({ form, isSubmitting }: InstoreFormProps) {
  return (
    <div className="border-t pt-4">
      <h3 className="text-lg font-medium mb-3">Informações da Loja</h3>
      <FormField
        control={form.control}
        name="tableNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Número da Mesa</FormLabel>
            <FormControl>
              <Input placeholder="Ex: 10" {...field} required disabled={isSubmitting} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}



