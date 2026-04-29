
import React from 'react';

interface OrderSummaryProps {
  subtotal: number;
  deliveryFee: number;
  orderType: 'delivery' | 'takeaway' | 'instore';
}

export function OrderSummary({ subtotal, deliveryFee, orderType }: OrderSummaryProps) {
  const totalAmount = subtotal + (orderType === 'delivery' ? deliveryFee : 0);

  return (
    <div className="mb-4 space-y-2">
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span className="font-medium">
          {new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(subtotal)}
        </span>
      </div>
      
      <div className="flex justify-between">
        <span>Taxa de entrega</span>
        <span className="font-medium">
          {orderType === 'delivery' ? (
            new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(deliveryFee)
          ) : (
            new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(0)
          )}
        </span>
      </div>
      
      <div className="flex justify-between font-bold text-lg pt-2 border-t">
        <span>Total</span>
        <span>
          {new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }).format(totalAmount)}
        </span>
      </div>
    </div>
  );
}



