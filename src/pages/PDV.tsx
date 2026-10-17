import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { PDVProductList } from '@/components/pdv/PDVProductList';
import { PDVCart } from '@/components/pdv/PDVCart';
import { Product, ProductAddon } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { shouldBlockTenantAccess } from '@/lib/trial';
import { Button } from '@/components/ui/button';

function generateCartItemKey(productId: string, notes: string | undefined, selectedAddons: ProductAddon[] | undefined): string {
  const addonIds = (selectedAddons || [])
    .map(a => a.id)
    .filter((id): id is string => id !== undefined)
    .sort();
  return `${productId}|${(notes || '').toLowerCase()}|${addonIds.join(',')}`;
}

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

  const handleAddToCart = useCallback((
    product: Product, 
    quantity = 1, 
    selectedAddons?: ProductAddon[], 
    notes?: string
  ) => {
    setCartItems(prev => {
      const newKey = generateCartItemKey(product.id, notes, selectedAddons);
      const existingIndex = prev.findIndex(item => generateCartItemKey(
        item.product.id, 
        item.notes, 
        item.selectedAddons
      ) === newKey);

      if (existingIndex >= 0) {
        return prev.map((item, index) => 
          index === existingIndex
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [...prev, { product, quantity, selectedAddons, notes }];
    });
  }, []);

  const handleRemoveFromCart = useCallback((productId: string) => {
    setCartItems(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  const handleClearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const handleUpdateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCartItems(prev => prev.filter(item => item.product.id !== productId));
      return;
    }
    setCartItems(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  }, []);

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
              onClearCart={handleClearCart}
            />
          </div>
        </div>
      )}
    </div>
  );
}