
import React from 'react';
import { ProductAddon } from '@/types';
import { Button } from '@/components/ui/button';
import { Check, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductAddonsProps {
  addons: ProductAddon[];
  onSelect: (addon: ProductAddon, selected: boolean, quantity?: number) => void;
}

export function ProductAddons({ addons, onSelect }: ProductAddonsProps) {
  if (!addons || addons.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mt-3">
      <h4 className="font-medium text-sm">Adicionais</h4>
      <div className="space-y-2">
        {addons.map((addon) => (
          <div 
            key={addon.id} 
            className={cn(
              "flex items-center justify-between p-3 rounded-md border",
              addon.selected ? "border-delivery-500 bg-delivery-50" : "border-gray-200",
              !addon.available && "opacity-60"
            )}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h5 className="font-medium">{addon.name}</h5>
                {addon.selected && <Check className="h-4 w-4 text-delivery-500" />}
              </div>
              {addon.description && (
                <p className="text-sm text-muted-foreground">{addon.description}</p>
              )}
              <p className="text-sm font-medium text-delivery-700 mt-1">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                }).format(addon.price)}
              </p>
            </div>

            {addon.maxOptions && addon.maxOptions > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!addon.available || (addon.quantity || 0) <= 0}
                  onClick={() => {
                    const currentQuantity = addon.quantity || 0;
                    if (currentQuantity <= 1) {
                      // Remove addon if quantity becomes 0
                      onSelect(addon, false, 0);
                    } else {
                      // Decrease quantity
                      const newQuantity = currentQuantity - 1;
                      onSelect(addon, true, newQuantity);
                    }
                  }}
                  className="h-8 w-8"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-6 text-center font-medium">{addon.quantity || 0}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!addon.available || (addon.quantity || 0) >= (addon.maxOptions || 1)}
                  onClick={() => {
                    const currentQuantity = addon.quantity || 0;
                    const newQuantity = Math.min(addon.maxOptions || 1, currentQuantity + 1);
                    onSelect(addon, true, newQuantity);
                  }}
                  className="h-8 w-8"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant={addon.selected ? "default" : "outline"}
                size="sm"
                disabled={!addon.available}
                onClick={() => onSelect(addon, !addon.selected)}
                className={cn(
                  "min-w-[100px]",
                  addon.selected && "bg-delivery-500 hover:bg-delivery-600"
                )}
              >
                {addon.selected ? "Selecionado" : "Adicionar"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}



