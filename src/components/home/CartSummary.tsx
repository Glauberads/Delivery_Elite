import React, { useState } from "react";
import { Product, ProductAddon } from "@/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { CheckoutDialog } from "../checkout/CheckoutDialog";

interface CartItem {
  product: Product;
  quantity: number;
  selectedAddons?: ProductAddon[];
  notes?: string;
}

interface CartSummaryProps {
  cartItems: CartItem[];
  onAddItem: (product: Product) => void;
  onRemoveItem: (productId: string, itemIndex: number) => void;
  totalItems: number;
  totalPrice: number;
}

export function CartSummary({
  cartItems,
  onAddItem,
  onRemoveItem,
  totalItems,
  totalPrice,
}: CartSummaryProps) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const deliveryFee = 5.0;
  const finalTotal = totalPrice + (totalItems > 0 ? deliveryFee : 0);

  const handleCheckoutComplete = () => {
    // Reset cart items by removing all items one by one
    [...cartItems].forEach((_, index) => {
      onRemoveItem(cartItems[0].product.id, 0);
    });

    setCheckoutOpen(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-delivery-500" />
          <h2 className="font-bold text-xl">Seu pedido</h2>
        </div>
        {totalItems > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            {totalItems} {totalItems === 1 ? "item" : "itens"} no carrinho
          </p>
        )}
      </div>

      {cartItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-gray-100 p-4 rounded-full mb-4">
            <ShoppingCart className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-lg mb-1">Seu carrinho está vazio</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            Adicione alguns produtos do menu para começar seu pedido
          </p>
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {cartItems.map((item, index) => (
                <div key={`${item.product.id}-${index}`} className="flex gap-3">
                  <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-md overflow-hidden">
                    <img
                      src={item.product.imageUrl || "/placeholder.svg"}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <h4 className="font-medium">{item.product.name}</h4>
                      <p className="font-medium">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(item.product.price * item.quantity)}
                      </p>
                    </div>

                    {item.selectedAddons && item.selectedAddons.length > 0 && (
                      <div className="mt-1 mb-2">
                        {item.selectedAddons.map((addon) => (
                          <div
                            key={addon.id}
                            className="flex justify-between text-sm text-muted-foreground"
                          >
                            <span>
                              {addon.name}{" "}
                              {addon.quantity > 1 ? `(${addon.quantity}x)` : ""}
                            </span>
                            <span>
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(addon.price * (addon.quantity || 1))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {item.notes && (
                      <p className="text-xs text-muted-foreground italic mt-1">
                        Obs: {item.notes}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border rounded-md">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-none"
                          onClick={() => onRemoveItem(item.product.id, index)}
                        >
                          {item.quantity === 1 ? (
                            <Trash2 className="h-4 w-4 text-red-500" />
                          ) : (
                            <Minus className="h-4 w-4" />
                          )}
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-none"
                          onClick={() => onAddItem(item.product)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="p-4 border-t bg-white sticky bottom-0">
            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(totalPrice)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxa de entrega</span>
                <span>
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t">
                <span>Total</span>
                <span>
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(finalTotal)}
                </span>
              </div>
            </div>
            <Button
              className="w-full bg-delivery-500 hover:bg-delivery-600"
              onClick={() => setCheckoutOpen(true)}
            >
              Finalizar pedido
            </Button>
          </div>
        </>
      )}

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        cartItems={cartItems}
        totalPrice={finalTotal}
        onOrderComplete={handleCheckoutComplete}
      />
    </div>
  );
}



