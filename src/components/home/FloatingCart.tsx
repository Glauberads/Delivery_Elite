import React, { useState, useEffect, useRef } from "react";
import { Product, ProductAddon } from "@/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  X,
  ArrowLeft,
  MapPin,
  Package2,
  AlignJustify,
  Phone,
  User,
  CreditCard,
  Banknote,
  QrCode,
  Landmark,
  Wallet,
  Check,
  Share2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { CheckoutDialog } from "../checkout/CheckoutDialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckoutForm } from "../checkout/CheckoutForm";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Icon, IconName } from "@/components/ui/icon";
import { useQueryClient } from "@tanstack/react-query";
import { OrderConfirmation } from "../checkout/OrderConfirmation";
import { useNavigate } from "react-router-dom";
import type { PublicRestaurant } from "@/hooks/usePublicTenant";

interface CartItem {
  product: Product;
  quantity: number;
  selectedAddons?: ProductAddon[];
  notes?: string;
}

interface FloatingCartProps {
  cartItems: CartItem[];
  onAddItem: (product: Product) => void;
  onRemoveItem: (productId: string, itemIndex: number) => void;
  totalItems: number;
  totalPrice: number;
  onOpenChange?: (isOpen: boolean) => void;
  tenantId: string | null;
  restaurant: PublicRestaurant | null;
  orderingBlocked?: boolean;
  orderingBlockedMessage?: string;
}

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
  city?: string;
  state?: string;
  // In-store fields
  tableNumber?: string;
  // Coupon
  coupon?: string;
  // Payment method
  paymentMethodId?: string;
}

// Schema de validação para o formulário
const formSchema = z.object({
  orderType: z.enum(["delivery", "takeaway", "instore"]),
  // Dados do cliente
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  phone: z.string().min(10, "Telefone inválido"),
  // Campos para delivery
  zipCode: z.string().optional(),
  streetName: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  // Campos para instore
  tableNumber: z.string().optional(),
  // Método de pagamento
  paymentMethodId: z.string().min(1, "Selecione um método de pagamento"),
  // Observações
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// Tipos de métodos de pagamento do banco de dados
interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

// Adicionar novo tipo para as etapas do carrinho
type CartStep = "cart" | "order-type" | "checkout" | "confirmation";

// Adicionar interface para dados do restaurante
// Interface para horários de funcionamento
interface BusinessHour {
  id: string;
  day_of_week: string;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

// Formatar número de telefone para exibição
const formatPhoneNumber = (phone: string | undefined): string => {
  if (!phone) return "";

  // Remove todos os caracteres não numéricos
  const numbers = phone.replace(/\D/g, "");

  // Formata o número para exibição (assumindo padrão BR)
  if (numbers.length === 11) {
    return `(${numbers.substring(0, 2)}) ${numbers.substring(
      2,
      7
    )}-${numbers.substring(7)}`;
  } else if (numbers.length === 10) {
    return `(${numbers.substring(0, 2)}) ${numbers.substring(
      2,
      6
    )}-${numbers.substring(6)}`;
  }

  return phone; // Retorna original se não conseguir formatar
};

// Formatar número para WhatsApp (apenas números com código do país)
const formatWhatsAppNumber = (phone: string | undefined): string => {
  if (!phone || phone.trim() === "") {
    toast.error("Número de telefone do estabelecimento não disponível");
    throw new Error("Número de telefone do estabelecimento não disponível");
  }

  // Remove todos os caracteres não numéricos
  const numbers = phone.replace(/\D/g, "");

  // Verifica se o número é válido
  if (numbers.length < 8) {
    toast.error("Número de telefone do estabelecimento inválido");
    throw new Error("Número de telefone do estabelecimento inválido");
  }

  // Adiciona código do país se não tiver
  if (!numbers.startsWith("55")) {
    return `55${numbers}`;
  }

  return numbers;
};

// Nova função para formatar telefone durante a digitação
const formatPhoneInput = (value: string): string => {
  // Remove todos os caracteres não numéricos
  const numbers = value.replace(/\D/g, "");

  if (numbers.length <= 2) {
    return numbers;
  }

  if (numbers.length <= 7) {
    return `(${numbers.substring(0, 2)}) ${numbers.substring(2)}`;
  }

  return `(${numbers.substring(0, 2)}) ${numbers.substring(
    2,
    7
  )}-${numbers.substring(7, 11)}`;
};

// Formatar CEP durante a digitação: 00000-000
const formatZipCodeInput = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.substring(0, 5)}-${digits.substring(5)}`;
};

// Nova função para preparar telefone ao enviar (adicionar 55 e remover formatação)
const preparePhoneForSubmission = (phone: string): string => {
  const numbers = phone.replace(/\D/g, "");

  // Se já começar com 55, retorna como está
  if (numbers.startsWith("55") && numbers.length >= 12) {
    return numbers;
  }

  // Adiciona 55 se não tiver
  return `55${numbers}`;
};

// Função para salvar o ID do pedido no localStorage
const saveOrderIdToLocalStorage = (orderId: string) => {
  try {
    localStorage.setItem("lastOrderId", orderId);
    localStorage.setItem("lastOrderTimestamp", Date.now().toString());
  } catch (error) {
    console.error("Erro ao salvar ID do pedido no localStorage:", error);
  }
};

// Função para recuperar o ID do pedido do localStorage
const getStoredOrderId = (): string | null => {
  try {
    const orderId = localStorage.getItem("lastOrderId");
    const timestamp = localStorage.getItem("lastOrderTimestamp");

    // Verificar se o pedido foi criado nas últimas 24 horas
    if (orderId && timestamp) {
      const createdAt = parseInt(timestamp);
      const now = Date.now();
      const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);

      // Retornar apenas se o pedido foi criado há menos de 24 horas
      if (hoursSinceCreation < 24) {
        return orderId;
      }
    }

    return null;
  } catch (error) {
    console.error("Erro ao recuperar ID do pedido do localStorage:", error);
    return null;
  }
};

export function FloatingCart({
  cartItems,
  onAddItem,
  onRemoveItem,
  totalItems,
  totalPrice,
  onOpenChange,
  tenantId,
  restaurant,
  orderingBlocked = false,
  orderingBlockedMessage = "Loja temporariamente indisponível para pedidos.",
}: FloatingCartProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>("delivery");
  const [isAnimating, setIsAnimating] = useState(false);
  const [cartStep, setCartStep] = useState<CartStep>("cart");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [orderTime, setOrderTime] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
  const [isLoadingBusinessHours, setIsLoadingBusinessHours] = useState(false);
  const queryClient = useQueryClient();
  const [orderItems, setOrderItems] = useState<CartItem[]>([]);
  const [orderSubtotal, setOrderSubtotal] = useState(0);
  const [orderData, setOrderData] = useState<FormValues | null>(null);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const navigate = useNavigate();
  const [orderCreatedId, setOrderCreatedId] = useState<string | null>(null);
  const submitLockRef = useRef(false);

  // Efeito para controlar o scroll da página quando o carrinho está aberto
  useEffect(() => {
    if (isOpen) {
      // Desabilitar scroll quando o carrinho está aberto
      document.body.style.overflow = "hidden";
    } else {
      // Habilitar scroll quando o carrinho está fechado
      document.body.style.overflow = "";
    }

    // Cleanup: garantir que o scroll seja habilitado quando o componente for desmontado
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!orderingBlocked) {
      return;
    }

    setIsOpen(false);
    setCartStep("cart");
    if (onOpenChange) {
      onOpenChange(false);
    }
  }, [onOpenChange, orderingBlocked]);

  // Valor padrão para taxa de entrega, será substituído pelos dados do restaurante quando carregados
  const deliveryFee = restaurant?.delivery_fee ?? 5.0;
  // A taxa de entrega só deve ser aplicada quando tivermos um tipo de pedido definido como delivery
  // No carrinho inicial, não devemos mostrar nem aplicar a taxa
  const finalTotal =
    cartStep === "cart"
      ? totalPrice
      : totalPrice +
        (totalItems > 0 && orderType === "delivery" ? deliveryFee : 0);

  // Inicializar o formulário
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orderType: "delivery",
      name: "",
      phone: "",
      zipCode: "",
      streetName: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      tableNumber: "",
      paymentMethodId: "",
      notes: "",
    },
  });

  // Efeito para carregar métodos de pagamento
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      if (!tenantId) {
        setPaymentMethods([]);
        return;
      }

      setIsLoadingPaymentMethods(true);
      try {
        const { data, error } = await supabase
          .from("payment_methods")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("enabled", true)
          .order("display_order");

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          setPaymentMethods(data);
          // Definir o primeiro método como padrão
          form.setValue("paymentMethodId", data[0].id);
        }
      } catch (error) {
        console.error("Erro ao carregar métodos de pagamento:", error);
        toast.error("Erro ao carregar métodos de pagamento");
        // Definir métodos de pagamento padrão em caso de erro
        setPaymentMethods([
          { id: "pix", name: "PIX", icon: "qr-code" },
          { id: "credit", name: "Cartão de Crédito", icon: "credit-card" },
          { id: "debit", name: "Cartão de Débito", icon: "credit-card" },
          { id: "cash", name: "Dinheiro", icon: "banknote" },
        ]);
        form.setValue("paymentMethodId", "pix");
      } finally {
        setIsLoadingPaymentMethods(false);
      }
    };

    fetchPaymentMethods();
  }, [form, tenantId]);

  // Efeito para carregar horários de funcionamento
  useEffect(() => {
    const fetchBusinessHours = async () => {
      if (!tenantId) {
        setBusinessHours([]);
        return;
      }

      setIsLoadingBusinessHours(true);
      try {
        const { data, error } = await supabase
          .from("business_hours")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("id");

        if (error) {
          throw error;
        }

        if (data) {
          setBusinessHours(data);
        }
      } catch (error) {
        console.error("Erro ao carregar horários de funcionamento:", error);
        toast.error("Erro ao carregar horários de funcionamento");
      } finally {
        setIsLoadingBusinessHours(false);
      }
    };

    fetchBusinessHours();
  }, [tenantId]);

  // Atualizar o tipo de pedido quando mudar
  useEffect(() => {
    form.setValue("orderType", orderType);
  }, [orderType, form]);

  // Efeito para animar o botão quando totalItems mudar
  useEffect(() => {
    if (totalItems > 0) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [totalItems]);

  const handleCheckoutComplete = async () => {
    try {
      if (orderingBlocked) {
        toast.error(orderingBlockedMessage);
        return;
      }

      if (submitLockRef.current || isSubmitting) return;
      // Validar o formulário
      await form.handleSubmit(submitOrder)();
    } catch (error) {
      console.error("Error during form validation:", error);
    }
  };

  const submitOrder = async (data: FormValues) => {
    if (orderingBlocked) {
      toast.error(orderingBlockedMessage);
      return;
    }

    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      if (!tenantId) {
        throw new Error("Tenant não identificado para este pedido.");
      }

      // Preparar o telefone para submissão (adicionar 55 se não tiver)
      const formattedPhone = preparePhoneForSubmission(data.phone);

      // Get the paymentMethodId directly - no mapping needed as we're using the ID from the database
      const paymentMethodId = data.paymentMethodId;

      // Calculate subtotal based on order items
      const subtotal = cartItems.reduce((sum, item) => {
        const basePrice = item.product.price;

        // Calcular o preço dos adicionais
        const addonsTotalPrice = (item.selectedAddons || []).reduce(
          (sum, addon) => {
            const behavior = String(addon.groupBehavior ?? "").toLowerCase();
            if (behavior === "fractional" || behavior === "flavor_mix") {
              return sum;
            }
            return sum + addon.price * (addon.quantity || 1);
          },
          0
        );

        // Preço total por unidade (produto base + adicionais)
        const unitPriceWithAddons = basePrice + addonsTotalPrice;

        // Preço total do item (incluindo quantidade)
        const totalItemPrice = unitPriceWithAddons * item.quantity;
        return sum + totalItemPrice;
      }, 0);

      // Calculate delivery fee based on orderType - only apply for delivery orders
      const deliveryFee =
        data.orderType === "delivery" ? restaurant?.delivery_fee ?? 5.0 : 0;

      // Calculate total
      const total = subtotal + deliveryFee;

      // Format delivery address if applicable
      let deliveryAddress = null;
      const deliveryRegionId = null;

      if (data.orderType === "delivery") {
        // Format address
        const addressParts = [
          data.streetName,
          data.number,
          data.complement,
          data.neighborhood,
          data.zipCode,
        ].filter(Boolean);

        deliveryAddress = addressParts.join(", ");
      }

      // Prepare order data
      const orderData = {
        tenant_id: tenantId,
        customer_name: data.name,
        customer_phone: formattedPhone, // Usar o número formatado com o código do país
        payment_method: paymentMethodId, // Usar o ID diretamente
        payment_status: "pending",
        status: "pending",
        notes: data.notes || null,
        subtotal: subtotal,
        total: total,
        delivery_fee: deliveryFee,
        discount: 0,
        order_type: data.orderType,
        table_number: data.orderType === "instore" ? data.tableNumber : null,
        delivery_address:
          data.orderType === "delivery" ? deliveryAddress : null,
        delivery_region_id: deliveryRegionId,
      };

      // Insert order into database
      const { data: createdOrder, error: orderError } = await supabase
        .from("orders")
        .insert([orderData])
        .select();

      if (orderError) {
        throw new Error(`[orders] ${orderError.message}`);
      }

      let orderId = null;
      if (createdOrder && createdOrder.length > 0) {
        orderId = createdOrder[0].id;
        console.log("Pedido criado com ID:", orderId);
        setOrderCreatedId(orderId); // Armazenar o ID do pedido criado

        // Salvar o ID do pedido no localStorage
        saveOrderIdToLocalStorage(orderId);
      } else {
        throw new Error(
          "Falha ao criar pedido. Nenhum ID de pedido retornado."
        );
      }

      // Insert order items
      for (const item of cartItems) {
        // Calcular o preço unitário e total corretamente
        const basePrice = item.product.price;

        // Calcular o preço dos adicionais
        const addonsTotalPrice = (item.selectedAddons || []).reduce(
          (sum, addon) => {
            const behavior = String(addon.groupBehavior ?? "").toLowerCase();
            if (behavior === "fractional" || behavior === "flavor_mix") {
              return sum;
            }
            return sum + addon.price * (addon.quantity || 1);
          },
          0
        );

        // Preço total por unidade (produto base + adicionais)
        const unitPriceWithAddons = basePrice + addonsTotalPrice;

        // Preço total do item (incluindo quantidade)
        const totalItemPrice = unitPriceWithAddons * item.quantity;

        // Insert order item
        const { data: orderItem, error: itemError } = await supabase
          .from("order_items")
          .insert({
            tenant_id: tenantId,
            order_id: orderId,
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: Number(unitPriceWithAddons.toFixed(2)),
            total_price: Number(totalItemPrice.toFixed(2)),
            notes: item.notes || null,
          })
          .select()
          .single();

        if (itemError) {
          throw new Error(`[order_items] ${itemError.message}`);
        }

        // Insert order item addons if any
        if (item.selectedAddons && item.selectedAddons.length > 0) {
          const addonsToInsert = item.selectedAddons
            .filter((addon) => {
              const behavior = String(addon.groupBehavior ?? "").toLowerCase();
              if (behavior === "fractional" || behavior === "flavor_mix") {
                return false;
              }
              return Boolean(addon.id);
            })
            .map((addon) => ({
              tenant_id: tenantId,
              order_item_id: orderItem.id,
              addon_id: addon.id,
              quantity: addon.quantity || 1,
              unit_price: Number(addon.price.toFixed(2)),
              total_price: Number(
                (addon.price * (addon.quantity || 1)).toFixed(2)
              ),
            }));

          if (addonsToInsert.length === 0) {
            continue;
          }

          const { error: addonsError } = await supabase
            .from("order_item_addons")
            .insert(addonsToInsert);

          if (addonsError) {
            throw new Error(`[order_item_addons] ${addonsError.message}`);
          }
        }
      }

      // Generate order number from created order
      setOrderNumber(
        createdOrder[0].number ||
          String(Math.floor(10000 + Math.random() * 90000))
      );

      // Define estimated delivery/pickup time
      const now = new Date();
      const estimatedTime = new Date(now.getTime() + 30 * 60000); // +30 minutes
      setOrderTime(
        estimatedTime.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      );

      // Success notification
      toast.success("Pedido realizado com sucesso!");

      // Salvar os itens do pedido antes de limpar o carrinho
      setOrderItems([...cartItems]);
      setOrderSubtotal(totalPrice);

      // Salvar os dados do formulário
      setOrderData({ ...data });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-orders"] });

      // Go to confirmation screen
      setCartStep("confirmation");

      // Clear cart
      [...cartItems].forEach((_, index) => {
        onRemoveItem(cartItems[0].product.id, 0);
      });

      // Reset form
      form.reset();
    } catch (error: unknown) {
      console.error("Erro ao enviar pedido:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao salvar pedido: " + errorMessage);
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  // Função para formatar valores em moeda brasileira
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleProceedToCheckout = () => {
    if (orderingBlocked) {
      toast.error(orderingBlockedMessage);
      return;
    }

    setCartStep("order-type");
  };

  const handleSelectOrderType = (type: OrderType) => {
    setOrderType(type);
    setCartStep("checkout");
  };

  const handleBackToCart = () => {
    setCartStep("cart");
  };

  const handleBackToOrderType = () => {
    setCartStep("order-type");
  };

  // Função para atualizar o estado isOpen e notificar o componente pai
  const updateIsOpen = (open: boolean) => {
    setIsOpen(open);
    if (onOpenChange) {
      onOpenChange(open);
    }
  };

  // Reset steps when closing cart
  const handleCloseCart = () => {
    updateIsOpen(false);
    setTimeout(() => {
      setCartStep("cart");
    }, 300); // Delay to allow animation to complete
  };

  // Função para lidar com erros do formulário
  const handleFormError = (errors: z.ZodFormattedError<FormValues>) => {
    console.error("Erros de validação:", errors);
    const firstError = Object.keys(errors)[0];
    if (firstError && firstError !== "_errors") {
      const fieldErrors = errors[firstError as keyof typeof errors];
      const errorMessage =
        fieldErrors &&
        typeof fieldErrors === "object" &&
        "_errors" in fieldErrors
          ? fieldErrors._errors[0]
          : "Erro de validação";
      toast.error(`Erro no campo: ${errorMessage}`);
    } else if (errors._errors?.length) {
      toast.error(`Erro: ${errors._errors[0]}`);
    } else {
      toast.error("Ocorreu um erro de validação");
    }
  };

  const PaymentMethodSelector = () => {
    const currentValue = form.watch("paymentMethodId");

    return (
      <div className="space-y-2">
        <FormLabel className="text-base font-semibold">
          Forma de Pagamento
        </FormLabel>

        {isLoadingPaymentMethods ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className={cn(
                  "cursor-pointer rounded-md border-2 border-muted bg-card p-3 transition-colors hover:border-border hover:bg-muted/40",
                  currentValue === method.id && "border-primary bg-primary/5"
                )}
                onClick={() => form.setValue("paymentMethodId", method.id)}
              >
                <div className="flex flex-col items-center gap-1">
                  <Icon
                    name={method.icon as IconName}
                    className="h-6 w-6 text-primary"
                  />
                  <span className="text-sm">{method.name}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {form.formState.errors.paymentMethodId && (
          <p className="text-sm font-medium text-destructive">
            {form.formState.errors.paymentMethodId.message}
          </p>
        )}
      </div>
    );
  };

  // Atualizar a seção do WhatsApp no componente de tela de confirmação para usar os dados corretos
  const handleWhatsAppClick = () => {
    try {
      // Usar dados do formulário salvos, ou os dados atuais do formulário como fallback
      const formData = orderData || form.getValues();

      // Buscar o nome do método de pagamento selecionado
      const paymentMethod = paymentMethods.find(
        (method) => method.id === formData.paymentMethodId
      );
      const paymentMethodName = paymentMethod?.name || "Não informado";

      // Usar os itens salvos em vez dos itens atuais do carrinho
      // (que já foram limpos após a confirmação)
      const itemsToUse = orderItems.length > 0 ? orderItems : cartItems;
      const subtotalToUse = orderSubtotal > 0 ? orderSubtotal : totalPrice;

      // Dados para a mensagem
      const orderInfo = {
        orderNumber,
        orderType: formData.orderType,
        name: formData.name || "Não informado",
        phone: formData.phone || "Não informado",
        address:
          formData.orderType === "delivery"
            ? `${formData.streetName || ""}, ${formData.number || ""}, ${
                formData.complement || ""
              }, ${formData.neighborhood || ""}, ${formData.zipCode || ""}`
            : "N/A",
        paymentMethod: paymentMethodName,
        deliveryFee: formData.orderType === "delivery" ? deliveryFee : 0,
        subtotal: subtotalToUse,
        totalPrice:
          formData.orderType === "delivery"
            ? subtotalToUse + deliveryFee
            : subtotalToUse,
        items: itemsToUse.map((item) => {
          // Calcular valor do item com adicionais
          const addonsTotalPrice = (item.selectedAddons || []).reduce(
            (sum, addon) => {
              const behavior = String(addon.groupBehavior ?? "").toLowerCase();
              if (behavior === "fractional" || behavior === "flavor_mix") {
                return sum;
              }
              return sum + addon.price * (addon.quantity || 1);
            },
            0
          );

          const itemPrice =
            (item.product.price + addonsTotalPrice) * item.quantity;

          // Formatar informações dos adicionais, se houver
          const addonsText =
            (item.selectedAddons || []).length > 0
              ? `\n    - Adicionais: ${item.selectedAddons
                  ?.map(
                    (addon) =>
                      `${addon.name} ${
                        addon.quantity > 1 ? `(${addon.quantity}x)` : ""
                      } ${formatCurrency(addon.price * (addon.quantity || 1))}`
                  )
                  .join(", ")}`
              : "";

          // Formatar observações do item, se houver
          const notesText = item.notes ? `\n    - Obs: ${item.notes}` : "";

          return `${item.quantity}x ${item.product.name} (${formatCurrency(
            itemPrice
          )})${addonsText}${notesText}`;
        }),
        restaurantName: restaurant?.name || "Nosso Restaurante",
        tableNumber: formData.tableNumber || "N/A",
        notes: formData.notes || "Nenhuma",
      };

      // Construir mensagem
      let message = `*Pedido #${orderInfo.orderNumber}*\n\n`;
      message += `*Restaurante:* ${orderInfo.restaurantName}\n`;
      message += `*Tipo de pedido:* ${
        orderInfo.orderType === "delivery"
          ? "Entrega"
          : orderInfo.orderType === "takeaway"
          ? "Retirada"
          : "No local"
      }\n`;

      if (orderInfo.orderType === "instore") {
        message += `*Mesa:* ${orderInfo.tableNumber}\n`;
      }

      if (orderInfo.orderType === "delivery") {
        message += `*Endereço de entrega:* ${orderInfo.address}\n`;
      }

      message += `*Nome:* ${orderInfo.name}\n`;
      message += `*Telefone:* ${orderInfo.phone}\n`;
      message += `*Forma de pagamento:* ${orderInfo.paymentMethod}\n`;
      message += `*Observações:* ${orderInfo.notes}\n\n`;

      message += "*Itens do pedido:*\n";

      // Se não houver itens no pedido, adicionar mensagem informativa
      if (orderInfo.items.length === 0) {
        message += "Nenhum item no pedido\n";
      } else {
        orderInfo.items.forEach((item, index) => {
          message += `${index + 1}. ${item}\n`;
        });
      }

      if (orderInfo.orderType === "delivery") {
        message += `\n*Taxa de entrega:* ${formatCurrency(
          orderInfo.deliveryFee
        )}\n`;
      }

      message += `*Subtotal:* ${formatCurrency(orderInfo.subtotal)}\n`;
      message += `*Total:* ${formatCurrency(orderInfo.totalPrice)}`;

      // Tentar obter o número do WhatsApp do restaurante
      if (!restaurant?.phone) {
        toast.error(
          "Número de telefone do estabelecimento não está disponível"
        );
        return;
      }

      const storeWhatsApp = formatWhatsAppNumber(restaurant.phone);

      // Abrir WhatsApp com a mensagem
      window.open(
        `https://wa.me/${storeWhatsApp}?text=${encodeURIComponent(message)}`,
        "_blank"
      );
    } catch (error) {
      console.error("Erro ao processar número de WhatsApp:", error);
      toast.error(
        "Não foi possível abrir o WhatsApp. Verifique se o estabelecimento possui um número válido."
      );
    }
  };

  const handleFinishOrder = () => {
    updateIsOpen(false);
    setTimeout(() => {
      setCartStep("cart");
    }, 300);
  };

  // Função auxiliar para formatar horário
  const formatTime = (timeString: string) => {
    if (!timeString) return "";

    try {
      const [hours, minutes] = timeString.split(":");
      return `${hours}h${minutes !== "00" ? minutes : ""}`;
    } catch (e) {
      return timeString;
    }
  };

  // Função para obter dias de funcionamento
  const getBusinessDays = () => {
    if (!businessHours || businessHours.length === 0) {
      return "Horário não disponível";
    }

    // Filtrar dias em que a loja está aberta
    const openDays = businessHours.filter((hour) => !hour.is_closed);

    if (openDays.length === 0) {
      return "Fechado todos os dias";
    }

    if (openDays.length === 7) {
      return "Todos os dias";
    }

    // Agrupar dias consecutivos
    const daysOfWeek = [
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
      "Domingo",
    ];
    const sortedOpenDays = openDays.sort(
      (a, b) =>
        daysOfWeek.indexOf(a.day_of_week) - daysOfWeek.indexOf(b.day_of_week)
    );

    // Simplificar para intervalo quando todos os dias úteis estão abertos
    const weekdaysOpen = [
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
    ].every((day) => sortedOpenDays.find((d) => d.day_of_week === day));

    const weekendOpen = ["Sábado", "Domingo"].every((day) =>
      sortedOpenDays.find((d) => d.day_of_week === day)
    );

    if (weekdaysOpen && weekendOpen) {
      return "Todos os dias";
    }

    if (weekdaysOpen) {
      return "Segunda a Sexta";
    }

    // Caso contrário, listar os dias abertos
    return sortedOpenDays
      .map((day) => day.day_of_week.split("-")[0])
      .join(", ");
  };

  // Função para formatar horário de funcionamento
  const getBusinessHours = () => {
    if (!businessHours || businessHours.length === 0) {
      return "Horário não disponível";
    }

    // Obter dia da semana atual em português
    const daysInPortuguese = [
      "Domingo",
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
    ];

    const today = new Date();
    const dayOfWeek = daysInPortuguese[today.getDay()];

    // Encontrar o registro para hoje
    const todayBusinessHour = businessHours.find(
      (hour) => hour.day_of_week === dayOfWeek
    );

    if (!todayBusinessHour) {
      return "Horário de hoje não disponível";
    }

    if (todayBusinessHour.is_closed) {
      return `Hoje ${dayOfWeek} estamos fechados`;
    }

    return `Hoje ${dayOfWeek} estamos abertos das ${formatTime(
      todayBusinessHour.open_time
    )} às ${formatTime(todayBusinessHour.close_time)}`;
  };

  // Componente para exibir informações do restaurante
  const RestaurantInfo = () => {
    if (isLoadingBusinessHours) {
      return (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (!restaurant) {
      return (
        <p className="text-sm text-muted-foreground">
          Informações do restaurante indisponíveis no momento.
        </p>
      );
    }

    return (
      <>
        <p className="text-sm text-muted-foreground">
          Nosso endereço: {restaurant.address}
        </p>
        <p className="text-sm text-muted-foreground">{getBusinessHours()}</p>
        {restaurant.phone && (
          <p className="text-sm text-muted-foreground">
            Telefone: {formatPhoneNumber(restaurant.phone)}
          </p>
        )}
      </>
    );
  };

  // Função para buscar endereço pelo CEP
  const fetchAddressByCep = async (cep: string) => {
    // Remover caracteres não numéricos do CEP
    const cleanCep = cep.replace(/\D/g, "");

    // Verificar se o CEP tem 8 dígitos numéricos
    if (cleanCep.length !== 8) {
      return;
    }

    setIsLoadingCep(true);

    try {
      const response = await fetch(
        `https://viacep.com.br/ws/${cleanCep}/json/`
      );
      const data = await response.json();

      // Verificar se a API retornou erro
      if (data.erro) {
        toast.error("CEP não encontrado");
        return;
      }

      // Preencher os campos do formulário com os dados retornados
      form.setValue("streetName", data.logradouro || "");
      form.setValue("neighborhood", data.bairro || "");
      form.setValue("city", data.localidade || "");
      form.setValue("state", data.uf || "");

      // Focar no campo número após preencher o endereço
      setTimeout(() => {
        const numberInput = document.querySelector(
          'input[name="number"]'
        ) as HTMLInputElement;
        if (numberInput) {
          numberInput.focus();
        }
      }, 100);

      toast.success("Endereço preenchido com sucesso");
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      toast.error("Erro ao buscar endereço pelo CEP");
    } finally {
      setIsLoadingCep(false);
    }
  };

  // Função para lidar com o evento de blur do campo CEP
  const handleCepBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value;
    if (cep && cep.length >= 8) {
      fetchAddressByCep(cep);
    }
  };

  // Função para navegar para a tela de rastreamento do pedido
  const handleTrackOrder = () => {
    console.log("ID do pedido para rastreamento:", orderCreatedId);

    // Tentar usar o ID do estado, ou recuperar do localStorage
    const trackingId = orderCreatedId || getStoredOrderId();

    if (trackingId) {
      // Navegar para a página de rastreamento com o ID do pedido
      navigate(`/track-order/${trackingId}`);
      // Fechar o carrinho após navegar
      handleFinishOrder();
    } else {
      console.error("ID do pedido não disponível para rastreamento");
      toast.error(
        "Não foi possível encontrar informações do pedido para rastrear"
      );
    }
  };

  return (
    <>
      {/* Botão flutuante do carrinho */}
      <Button
        onClick={() => updateIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full bg-delivery-500 hover:bg-delivery-600 shadow-lg z-50 flex items-center justify-center transition-transform duration-300",
          orderingBlocked && "cursor-not-allowed bg-muted hover:bg-muted",
          isAnimating && "scale-110"
        )}
        size="icon"
        disabled={orderingBlocked}
      >
        <ShoppingCart className="h-6 w-6" />
        {totalItems > 0 && (
          <Badge
            className={cn(
              "absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center font-bold bg-delivery-600 transition-all",
              isAnimating && "animate-pulse"
            )}
          >
            {totalItems}
          </Badge>
        )}
      </Button>

      {/* Overlay do carrinho */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-50 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => {
          if (cartStep === "cart") {
            handleCloseCart();
          }
        }}
      />

      {/* Drawer lateral do carrinho */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 flex h-full w-full max-w-full flex-col overflow-hidden border-l border-border bg-background shadow-xl transition-transform duration-300 ease-in-out sm:max-w-md",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header do drawer - muda conforme o passo */}
        <div className="sticky top-0 z-10 flex flex-shrink-0 items-center justify-between border-b bg-background/95 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            {cartStep !== "cart" && cartStep !== "confirmation" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={
                  cartStep === "order-type"
                    ? handleBackToCart
                    : handleBackToOrderType
                }
                className="rounded-full h-8 w-8 mr-1"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <ShoppingCart className="h-5 w-5 text-delivery-500" />
            <h2 className="font-bold text-xl">
              {cartStep === "cart" && "Seu pedido"}
              {cartStep === "order-type" && "Tipo de Pedido"}
              {cartStep === "checkout" && "Finalizar Pedido"}
              {cartStep === "confirmation" && "Pedido Confirmado"}
            </h2>
            {cartStep === "cart" && totalItems > 0 && (
              <p className="text-sm text-muted-foreground ml-1">
                {totalItems} {totalItems === 1 ? "item" : "itens"}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCloseCart}
            className="rounded-full h-8 w-8"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Conteúdo do drawer - muda conforme o passo */}
        {cartStep === "cart" && (
          <>
            {cartItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="mb-4 rounded-full bg-muted p-4">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-lg mb-1">
                  Seu carrinho está vazio
                </h3>
                <p className="text-muted-foreground text-sm max-w-xs">
                  Adicione alguns produtos do menu para começar seu pedido
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setIsOpen(false)}
                >
                  Voltar para o menu
                </Button>
              </div>
            ) : (
              <>
                <ScrollArea className="flex-1 overflow-y-auto">
                  <div className="p-4 space-y-4">
                    {cartItems.map((item, index) => (
                      <div
                        key={`${item.product.id}-${index}`}
                        className="flex gap-3"
                      >
                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
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

                          {item.selectedAddons &&
                            item.selectedAddons.length > 0 && (
                              <div className="mt-1 mb-2">
                                {item.selectedAddons.map((addon) => (
                                  <div
                                    key={addon.id}
                                    className="flex justify-between text-sm text-muted-foreground"
                                  >
                                    <span>
                                      {addon.name}{" "}
                                      {addon.quantity > 1
                                        ? `(${addon.quantity}x)`
                                        : ""}
                                    </span>
                                    <span>
                                      {new Intl.NumberFormat("pt-BR", {
                                        style: "currency",
                                        currency: "BRL",
                                      }).format(
                                        addon.price * (addon.quantity || 1)
                                      )}
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
                                onClick={() =>
                                  onRemoveItem(item.product.id, index)
                                }
                              >
                                {item.quantity === 1 ? (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                ) : (
                                  <Minus className="h-4 w-4" />
                                )}
                              </Button>
                              <span className="w-8 text-center">
                                {item.quantity}
                              </span>
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

                <div className="sticky bottom-0 flex-shrink-0 border-t bg-background/95 p-4 backdrop-blur-sm">
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(totalPrice)}</span>
                    </div>
                    {/* Não mostrar taxa de entrega no carrinho inicial */}
                    {cartStep !== "cart" && orderType === "delivery" && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Taxa de entrega
                        </span>
                        <span>{formatCurrency(deliveryFee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold pt-2 border-t">
                      <span>Total</span>
                      <span>{formatCurrency(finalTotal)}</span>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-delivery-500 hover:bg-delivery-600"
                    onClick={handleProceedToCheckout}
                    disabled={cartItems.length === 0 || orderingBlocked}
                  >
                    {orderingBlocked ? "Loja indisponível" : "Finalizar pedido"}
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {/* Tela de seleção de tipo de pedido */}
        {cartStep === "order-type" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="p-4 sm:p-6">
                <div className="space-y-4 sm:space-y-6">
                  <h3 className="text-lg sm:text-xl font-medium mb-2 sm:mb-4">
                    Como você deseja receber seu pedido?
                  </h3>

                  <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    <Button
                      className="relative flex h-auto min-h-[120px] flex-col items-center justify-center gap-2 overflow-hidden border border-border bg-card py-4 text-base text-foreground hover:bg-muted sm:min-h-[140px] sm:py-6 sm:text-lg"
                      onClick={() => handleSelectOrderType("delivery")}
                    >
                      <div className="absolute top-0 right-0 flex h-16 w-16 -mr-4 -mt-4 items-start justify-end rounded-bl-full bg-delivery-100 pt-1.5 pr-1.5 dark:bg-delivery-900/55 sm:h-20 sm:w-20 sm:-mr-5 sm:-mt-5 sm:pt-2 sm:pr-2">
                        <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-delivery-500" />
                      </div>
                      <div className="rounded-full bg-delivery-100 p-2.5 text-delivery-500 dark:bg-delivery-900/55 sm:p-3">
                        <MapPin className="h-6 w-6 sm:h-7 sm:w-7" />
                      </div>
                      <span className="font-medium mt-1 sm:mt-2">Delivery</span>
                      <p className="text-xs sm:text-sm text-muted-foreground text-center px-2">
                        Entrega no seu endereço
                      </p>
                    </Button>

                    <Button
                      className="relative flex h-auto min-h-[120px] flex-col items-center justify-center gap-2 overflow-hidden border border-border bg-card py-4 text-base text-foreground hover:bg-muted sm:min-h-[140px] sm:py-6 sm:text-lg"
                      onClick={() => handleSelectOrderType("takeaway")}
                    >
                      <div className="absolute top-0 right-0 flex h-16 w-16 -mr-4 -mt-4 items-start justify-end rounded-bl-full bg-delivery-100 pt-1.5 pr-1.5 dark:bg-delivery-900/55 sm:h-20 sm:w-20 sm:-mr-5 sm:-mt-5 sm:pt-2 sm:pr-2">
                        <Package2 className="h-4 w-4 sm:h-5 sm:w-5 text-delivery-500" />
                      </div>
                      <div className="rounded-full bg-delivery-100 p-2.5 text-delivery-500 dark:bg-delivery-900/55 sm:p-3">
                        <Package2 className="h-6 w-6 sm:h-7 sm:w-7" />
                      </div>
                      <span className="font-medium mt-1 sm:mt-2">Retirada</span>
                      <p className="text-xs sm:text-sm text-muted-foreground text-center px-2">
                        Retire seu pedido na loja
                      </p>
                    </Button>

                    <Button
                      className="relative flex h-auto min-h-[120px] flex-col items-center justify-center gap-2 overflow-hidden border border-border bg-card py-4 text-base text-foreground hover:bg-muted sm:min-h-[140px] sm:py-6 sm:text-lg"
                      onClick={() => handleSelectOrderType("instore")}
                    >
                      <div className="absolute top-0 right-0 flex h-16 w-16 -mr-4 -mt-4 items-start justify-end rounded-bl-full bg-delivery-100 pt-1.5 pr-1.5 dark:bg-delivery-900/55 sm:h-20 sm:w-20 sm:-mr-5 sm:-mt-5 sm:pt-2 sm:pr-2">
                        <AlignJustify className="h-4 w-4 sm:h-5 sm:w-5 text-delivery-500" />
                      </div>
                      <div className="rounded-full bg-delivery-100 p-2.5 text-delivery-500 dark:bg-delivery-900/55 sm:p-3">
                        <AlignJustify className="h-6 w-6 sm:h-7 sm:w-7" />
                      </div>
                      <span className="font-medium mt-1 sm:mt-2">No local</span>
                      <p className="text-xs sm:text-sm text-muted-foreground text-center px-2">
                        Consuma na loja, direto na mesa
                      </p>
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Tela de checkout */}
        {cartStep === "checkout" && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <div className="mb-4">
                <h3 className="text-lg font-medium">Finalizando seu pedido</h3>
                <p className="text-sm text-muted-foreground">
                  {orderType === "delivery" && "Entrega no seu endereço"}
                  {orderType === "takeaway" && "Retire seu pedido na loja"}
                  {orderType === "instore" && "Consuma na loja"}
                </p>
              </div>

              <Form {...form}>
                <form className="space-y-6">
                  {/* Dados do cliente - para todos os tipos de pedido */}
                  <div className="space-y-4">
                    <h3 className="text-md font-medium">Seus dados</h3>

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="Seu nome completo"
                                className="pl-10"
                                {...field}
                                disabled={isSubmitting}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="(00) 00000-0000"
                                className="pl-10"
                                {...field}
                                value={formatPhoneInput(field.value)}
                                onChange={(e) => {
                                  // Atualiza apenas os números no valor do campo
                                  const numbers = e.target.value.replace(
                                    /\D/g,
                                    ""
                                  );
                                  field.onChange(numbers);
                                }}
                                disabled={isSubmitting}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Campos específicos para entrega */}
                  {orderType === "delivery" && (
                    <div className="space-y-4 border-t pt-4">
                      <h3 className="text-md font-medium">
                        Endereço de entrega
                      </h3>

                      <FormField
                        control={form.control}
                        name="zipCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CEP (opcional)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  placeholder="00000-000"
                                  {...field}
                                  value={formatZipCodeInput(field.value || "")}
                                  onChange={(e) => {
                                    field.onChange(formatZipCodeInput(e.target.value));
                                  }}
                                  onBlur={(e) => {
                                    field.onBlur();
                                    handleCepBlur(e);
                                  }}
                                  disabled={isSubmitting || isLoadingCep}
                                />
                                {isLoadingCep && (
                                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                  </div>
                                )}
                              </div>
                            </FormControl>
                            <FormMessage />
                            <p className="text-xs text-muted-foreground mt-1">
                              Digite o CEP para preenchimento automático do
                              endereço
                            </p>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="streetName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rua</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Nome da rua"
                                {...field}
                                disabled={isSubmitting || isLoadingCep}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="number"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Número</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="123"
                                  {...field}
                                  disabled={isSubmitting}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="complement"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Complemento</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Apto, bloco..."
                                  {...field}
                                  disabled={isSubmitting}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="neighborhood"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bairro</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Nome do bairro"
                                {...field}
                                disabled={isSubmitting || isLoadingCep}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Esconder os campos de cidade e estado com display:none */}
                      <div
                        className="grid grid-cols-2 gap-3"
                        style={{ display: "none" }}
                      >
                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cidade</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Cidade"
                                  {...field}
                                  disabled={isSubmitting || isLoadingCep}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Estado</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="UF"
                                  {...field}
                                  disabled={isSubmitting || isLoadingCep}
                                  maxLength={2}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {/* Campos específicos para retirada na loja */}
                  {orderType === "takeaway" && (
                    <div className="space-y-4 border-t pt-4">
                      <h3 className="text-md font-medium">Retirada na loja</h3>
                      <RestaurantInfo />
                    </div>
                  )}

                  {/* Campos específicos para consumo no local */}
                  {orderType === "instore" && (
                    <div className="space-y-4 border-t pt-4">
                      <h3 className="text-md font-medium">Consumo no local</h3>

                      <RestaurantInfo />

                      <FormField
                        control={form.control}
                        name="tableNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número da Mesa</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ex: 10"
                                {...field}
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Método de pagamento - para todos os tipos de pedido */}
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-md font-medium">Método de Pagamento</h3>

                    <PaymentMethodSelector />
                  </div>

                  {/* Observações - para todos os tipos de pedido */}
                  <div className="space-y-4 border-t pt-4">
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observações (opcional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Alguma instrução adicional?"
                              {...field}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </form>
              </Form>

              <div className="space-y-3 mt-6 mb-4 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(totalPrice)}</span>
                </div>
                {orderType === "delivery" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Taxa de entrega
                    </span>
                    <span>{formatCurrency(deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>
                    {formatCurrency(
                      orderType === "delivery" ? finalTotal : totalPrice
                    )}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleBackToOrderType}
                  disabled={isSubmitting}
                >
                  Voltar
                </Button>
                <Button
                  className="flex-1 bg-delivery-500 hover:bg-delivery-600"
                  onClick={handleCheckoutComplete}
                  disabled={isSubmitting || orderingBlocked}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Processando...
                    </span>
                  ) : (
                    "Confirmar Pedido"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tela de confirmação */}
        {cartStep === "confirmation" && (
          <ScrollArea className="flex-1">
            <div className="flex flex-col items-center justify-center p-4 sm:p-6 text-center min-h-full">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 sm:mb-4 sm:h-16 sm:w-16 dark:bg-green-900/40">
                <Check className="h-6 w-6 text-green-600 dark:text-green-300 sm:h-8 sm:w-8" />
              </div>

              <h3 className="text-lg sm:text-xl font-bold mb-2">Pedido Confirmado!</h3>
              <div className="mb-4 w-full rounded-lg bg-green-50 p-3 dark:bg-green-950/35 sm:mb-6 sm:p-4">
                <p className="text-base font-medium text-green-800 dark:text-green-200 sm:text-lg">
                  #{orderNumber}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">Código do pedido</p>
              </div>

              {/* <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-delivery-500" />
                <p className="text-xs sm:text-sm text-center">
                  {orderType === "delivery"
                    ? "Horário estimado de chegada"
                    : orderType === "takeaway"
                    ? "Retirada disponível para"
                    : "Pedido disponível em"}{" "}
                  <span className="font-medium ml-1">{orderTime}</span>
                </p>
              </div> */}

              <div className="space-y-2 sm:space-y-3 w-full mt-3 sm:mt-4">
                <Button
                  className="w-full gap-2 bg-green-500 hover:bg-green-600 h-10 sm:h-11 text-sm sm:text-base"
                  onClick={handleWhatsAppClick}
                >
                  <Share2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  Enviar pedido por WhatsApp
                </Button>

                <Button
                  className="w-full gap-2 bg-delivery-500 hover:bg-delivery-600 h-10 sm:h-11 text-sm sm:text-base"
                  onClick={handleTrackOrder}
                >
                  <Package2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  Acompanhar Pedido
                </Button>

                <Button
                  variant="outline"
                  className="w-full gap-2 h-10 sm:h-11 text-sm sm:text-base"
                  onClick={handleFinishOrder}
                >
                  <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                  Concluir
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </div>
    </>
  );
}



