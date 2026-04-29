import React, { useState } from "react";
import { Product, ProductAddon } from "@/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  MinusCircle,
  PlusCircle,
  Trash2,
  Receipt,
  PlusCircle as Plus,
  MinusCircle as Minus,
  CreditCard,
  Banknote,
  QrCode,
  Wallet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePaymentMethods } from "@/hooks/useOrders";
import { useAuth } from "@/contexts/AuthContext";

interface PDVCartProps {
  items: {
    product: Product;
    quantity: number;
    selectedAddons?: ProductAddon[];
    notes?: string;
  }[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

export function PDVCart({ items, onUpdateQuantity, onRemove }: PDVCartProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taxPercentage, setTaxPercentage] = useState(0);
  const [discountValue, setDiscountValue] = useState(0);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const { data: paymentMethods = [], isLoading: loadingPaymentMethods } =
    usePaymentMethods();

  // Definir o método de pagamento padrão quando os métodos são carregados
  React.useEffect(() => {
    if (paymentMethods.length > 0 && !paymentMethodId) {
      setPaymentMethodId(paymentMethods[0].id);
    }
  }, [paymentMethods, paymentMethodId]);

  const subtotal = items.reduce((sum, item) => {
    let itemTotal = item.product.price * item.quantity;
    if (item.selectedAddons) {
      itemTotal +=
        item.selectedAddons.reduce(
          (addonSum, addon) => {
            const behavior = String(addon.groupBehavior ?? "").toLowerCase();
            if (behavior === "fractional" || behavior === "flavor_mix") {
              return addonSum;
            }
            return addonSum + addon.price * (addon.quantity || 1);
          },
          0
        ) * item.quantity;
    }
    return sum + itemTotal;
  }, 0);

  const taxAmount = (subtotal * taxPercentage) / 100;
  const totalAfterTax = subtotal + taxAmount;
  const finalTotal = Math.max(0, totalAfterTax - discountValue);

  const getIconForPaymentMethod = (iconName?: string) => {
    switch (iconName) {
      case "credit-card":
        return <CreditCard className="h-4 w-4 mr-2" />;
      case "banknote":
        return <Banknote className="h-4 w-4 mr-2" />;
      case "qr-code":
        return <QrCode className="h-4 w-4 mr-2" />;
      case "wallet":
        return <Wallet className="h-4 w-4 mr-2" />;
      default:
        return <CreditCard className="h-4 w-4 mr-2" />;
    }
  };

  const handleFinishOrder = async () => {
    if (items.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione produtos ao carrinho para finalizar o pedido",
        variant: "destructive",
      });
      return;
    }

    if (!paymentMethodId) {
      toast({
        title: "Selecione um método de pagamento",
        description: "É necessário selecionar um método de pagamento",
        variant: "destructive",
      });
      return;
    }

    if (!user?.tenantId) {
      toast({
        title: "Loja não identificada",
        description: "Não foi possível identificar o tenant da sessão atual.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          tenant_id: user.tenantId,
          customer_name: "Cliente Balcão",
          customer_phone: "-",
          status: "pending",
          payment_method: paymentMethodId,
          payment_status: "paid",
          subtotal,
          delivery_fee: 0,
          discount: discountValue,
          total: finalTotal,
          order_type: "instore",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Criar itens do pedido sem os adicionais
      const orderItems = items.map((item) => ({
        tenant_id: user.tenantId,
        order_id: order.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
        notes: item.notes ?? null,
      }));

      // Inserir itens do pedido
      const { data: insertedItems, error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems)
        .select();

      if (itemsError) throw itemsError;

      // Processar adicionais para cada item
      if (insertedItems) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const insertedItem = insertedItems[i];

          // Se o item tem adicionais, inserir na tabela order_item_addons
          if (
            item.selectedAddons &&
            item.selectedAddons.length > 0 &&
            insertedItem
          ) {
            const addonsToInsert = item.selectedAddons.map((addon) => ({
              tenant_id: user.tenantId,
              order_item_id: insertedItem.id,
              addon_id: addon.id,
              quantity: addon.quantity || 1,
              unit_price: addon.price,
              total_price: addon.price * (addon.quantity || 1),
            }));

            const { error: addonsError } = await supabase
              .from("order_item_addons")
              .insert(addonsToInsert);

            if (addonsError) {
              console.error("Erro ao inserir adicionais:", addonsError);
              // Continuar mesmo com erro nos adicionais
            }
          }
        }
      }

      toast({
        title: "Pedido finalizado",
        description: `Pedido #${order.number} criado com sucesso!`,
      });

      // Clear cart
      items.forEach((item) => onRemove(item.product.id));
      // Resetar outros valores
      setTaxPercentage(0);
      setDiscountValue(0);
    } catch (error) {
      console.error("Error creating order:", error);
      toast({
        title: "Erro ao criar pedido",
        description: "Não foi possível finalizar o pedido",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Carrinho</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {items.length > 0 ? (
          <div className="space-y-4">
            {items.map(({ product, quantity, selectedAddons }) => (
              <div key={product.id} className="flex items-start gap-2">
                <div className="flex-1 space-y-1">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(product.price)}
                  </p>
                  {selectedAddons &&
                    selectedAddons.map((addon) => (
                      <p
                        key={addon.id}
                        className="text-sm text-muted-foreground"
                      >
                        + {addon.name}
                        {addon.quantity > 1 ? ` (${addon.quantity}x)` : ""} -
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(addon.price * addon.quantity)}
                      </p>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onUpdateQuantity(product.id, quantity - 1)}
                  >
                    <MinusCircle className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onUpdateQuantity(product.id, quantity + 1)}
                  >
                    <PlusCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onRemove(product.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Nenhum item no carrinho
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <div className="w-full space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Taxa (%)</Label>
              <Input
                type="number"
                min="0"
                value={taxPercentage}
                onChange={(e) => setTaxPercentage(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Desconto (R$)</Label>
              <Input
                type="number"
                min="0"
                max={totalAfterTax}
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            {loadingPaymentMethods ? (
              <div className="py-2 text-center text-sm text-muted-foreground">
                Carregando métodos de pagamento...
              </div>
            ) : (
              <RadioGroup
                value={paymentMethodId}
                onValueChange={setPaymentMethodId}
                className="grid grid-cols-2 gap-4"
              >
                {paymentMethods.map((method) => (
                  <div key={method.id} className="flex items-center space-x-2">
                    <RadioGroupItem
                      value={method.id}
                      id={`payment-${method.id}`}
                    />
                    <Label
                      htmlFor={`payment-${method.id}`}
                      className="flex items-center"
                    >
                      {getIconForPaymentMethod(method.icon)}
                      {method.name}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </div>

          <div className="space-y-2 pt-4 border-t">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(subtotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Taxa ({taxPercentage}%)
              </span>
              <span>
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(taxAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Desconto</span>
              <span className="text-green-600">
                -
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(discountValue)}
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
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={handleFinishOrder}
          disabled={items.length === 0 || isSubmitting || !paymentMethodId}
        >
          {isSubmitting ? "Processando..." : "Finalizar Venda"}
        </Button>
      </CardFooter>
    </Card>
  );
}



