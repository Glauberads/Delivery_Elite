
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { PDVProductList } from '@/components/pdv/PDVProductList';
import { PDVCart } from '@/components/pdv/PDVCart';
import { Product, ProductAddon } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { shouldBlockTenantAccess } from '@/lib/trial';
import { Button } from '@/components/ui/button';

export default function PDV() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<{
    product: Product;
    quantity: number;
    selectedAddons?: ProductAddon[];
    notes?: string;
  }[]>([]);
  const accessBlocked =
    !user?.isSuperAdmin &&
    shouldBlockTenantAccess({
      trialEndsAt: user?.trialEndsAt,
      tenantStatus: user?.tenantStatus,
      subscriptionPeriodEnd: user?.subscriptionCurrentPeriodEnd,
      subscriptionStatus: user?.subscriptionStatus,
    });

  const handleAddToCart = (
    product: Product, 
    quantity = 1, 
    selectedAddons?: ProductAddon[], 
    notes?: string
  ) => {
    setCartItems(prev => {
      const existingItemIndex = prev.findIndex(item => {
        if (item.product.id !== product.id) return false;
        if (item.notes !== notes) return false;
        if ((!item.selectedAddons && selectedAddons) || 
            (item.selectedAddons && !selectedAddons)) return false;
        if (!item.selectedAddons && !selectedAddons) return true;
        if (item.selectedAddons && selectedAddons) {
          if (item.selectedAddons.length !== selectedAddons.length) return false;
          return item.selectedAddons.every(itemAddon => {
            const matchingAddon = selectedAddons.find(a => a.id === itemAddon.id);
            return matchingAddon && matchingAddon.quantity === itemAddon.quantity;
          });
        }
        return false;
      });

      if (existingItemIndex >= 0) {
        return prev.map((item, index) => 
          index === existingItemIndex
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [...prev, { product, quantity, selectedAddons, notes }];
    });
  };

  const handleRemoveFromCart = (productId: string) => {
    setCartItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveFromCart(productId);
      return;
    }
    setCartItems(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="PDV - Ponto de Venda" />
      {accessBlocked ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-lg rounded-xl border bg-card p-6 text-center shadow-sm">
            <h2 className="text-xl font-semibold">PDV temporariamente bloqueado</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Seu acesso foi bloqueado por assinatura. Regularize o pagamento para continuar vendendo.
            </p>
            <Button className="mt-5" onClick={() => navigate("/admin/profile?billing=renew")}>
              Ir para o checkout
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 lg:grid lg:grid-cols-[3fr_2fr]">
          <div className="overflow-auto">
            <PDVProductList onAddToCart={handleAddToCart} />
          </div>
          <div className="overflow-auto lg:min-w-0">
            <PDVCart
              items={cartItems}
              onUpdateQuantity={handleUpdateQuantity}
              onRemove={handleRemoveFromCart}
            />
          </div>
        </div>
      )}
    </div>
  );
}



