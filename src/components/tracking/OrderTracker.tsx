import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Check,
  ChevronLeft,
  Clock,
  CookingPot,
  Package,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Tipos de status de pedido
type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "delivering"
  | "completed"
  | "cancelled"
  | "out_for_delivery"
  | "delivered";

// Interface do pedido
interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  order_type: "delivery" | "takeaway" | "instore";
  delivery_address?: string | null;
  table_number?: string | null;
  payment_method: string;
  payment_status: string;
  total: number;
  estimated_delivery_time?: string | null;
}

// Interface para os itens do pedido
interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string | null;
  product_name: string;
  product_image_url?: string | null;
}

// Adicionar interface para método de pagamento
interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

// Componente principal de rastreamento
export function OrderTracker() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(true);

  // Função para formatar o status do pedido em português
  const formatStatus = (status: OrderStatus) => {
    const statusMap: Record<string, string> = {
      pending: "Recebido",
      preparing: "Em preparação",
      ready: "Pronto para entrega/retirada",
      delivering: "Em entrega",
      out_for_delivery: "Em entrega",
      completed: "Entregue",
      delivered: "Entregue",
      cancelled: "Cancelado",
    };
    return statusMap[status] || status;
  };

  // Função para formatar o tipo de pedido em português
  const formatOrderType = (type: string) => {
    const typeMap: Record<string, string> = {
      delivery: "Entrega",
      takeaway: "Retirada",
      instore: "No local",
    };
    return typeMap[type] || type;
  };

  // Função para formatar valores em moeda brasileira
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Função para formatar data e hora
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Adicionar um efeito separado para buscar métodos de pagamento
  useEffect(() => {
    const fetchPaymentMethodsData = async () => {
      setLoadingPaymentMethods(true);
      try {
        console.log("Buscando métodos de pagamento");
        const { data, error } = await supabase
          .from("payment_methods")
          .select("*");

        if (error) {
          console.error("Erro ao buscar métodos de pagamento:", error);
          throw error;
        }

        console.log("Métodos de pagamento encontrados:", data);
        setPaymentMethods(data || []);
      } catch (error) {
        console.error("Erro ao buscar métodos de pagamento:", error);
        // Não definir erro global para não afetar o fluxo principal
      } finally {
        setLoadingPaymentMethods(false);
      }
    };

    fetchPaymentMethodsData();
  }, []);

  // Função para obter o nome do método de pagamento a partir do ID
  const getPaymentMethodName = (paymentMethodId: string): string => {
    if (!paymentMethodId) return "Não informado";

    // Se os métodos de pagamento ainda não foram carregados, exibir Carregando...
    if (paymentMethods.length === 0) {
      return "Carregando...";
    }

    const method = paymentMethods.find((m) => m.id === paymentMethodId);
    if (method) {
      return method.name;
    }

    // Tentar mapear com base em IDs comuns
    const commonMethods: Record<string, string> = {
      pix: "PIX",
      credit: "Cartão de Crédito",
      debit: "Cartão de Débito",
      cash: "Dinheiro",
      transfer: "Transferência Bancária",
    };

    if (paymentMethodId in commonMethods) {
      return commonMethods[paymentMethodId];
    }

    return "Método desconhecido";
  };

  // Carregar dados do pedido
  useEffect(() => {
    let interval: number | null = null;

    const fetchOrderData = async () => {
      if (!orderId) {
        setError("ID do pedido não fornecido");
        setLoading(false);
        return;
      }

      // Verificar se o orderId tem formato de UUID válido
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(orderId)) {
        setError("ID do pedido inválido");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        console.log("Buscando dados do pedido:", orderId);

        // Buscar dados do pedido
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single();

        if (orderError) {
          console.error("Erro ao buscar pedido:", orderError);
          throw new Error(orderError.message || "Erro ao buscar pedido");
        }

        if (!orderData) {
          console.error("Pedido não encontrado");
          throw new Error("Pedido não encontrado");
        }

        console.log("Dados do pedido encontrados:", orderData);
        setOrder(orderData as Order);

        // Buscar itens do pedido com join
        console.log("Buscando itens do pedido");
        const { data: orderItemsData, error: orderItemsError } = await supabase
          .from("order_items")
          .select(
            `
            *,
            products(name, image_url)
          `
          )
          .eq("order_id", orderId);

        if (orderItemsError) {
          console.error("Erro ao buscar itens do pedido:", orderItemsError);
          throw new Error(
            orderItemsError.message || "Erro ao buscar itens do pedido"
          );
        }

        console.log("Itens do pedido encontrados:", orderItemsData);

        // Transformar os dados obtidos no formato esperado para orderItems
        if (orderItemsData) {
          const formattedItems: OrderItem[] = orderItemsData.map((item) => ({
            id: item.id,
            order_id: item.order_id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            notes: item.notes,
            product_name: item.products?.name || "Produto indisponível",
            product_image_url: item.products?.image_url || null,
          }));

          setOrderItems(formattedItems);
        }
      } catch (error: unknown) {
        console.error("Erro ao carregar dados do pedido:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Erro ao carregar dados do pedido";
        setError(errorMessage);
        toast.error("Erro ao carregar dados do pedido");
      } finally {
        setLoading(false);
      }
    };

    // Executar a busca inicial
    fetchOrderData();

    // Configurar intervalo para atualização dos dados a cada 30 segundos
    interval = window.setInterval(() => {
      fetchOrderData();
    }, 30000);

    // Armazenar o intervalo no estado para controle
    setRefreshInterval(interval);

    // Limpar intervalo quando o componente for desmontado
    return () => {
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [orderId]);

  // Determinar o progresso atual do pedido
  const getOrderProgress = () => {
    if (!order) return 0;

    const statusOrder: OrderStatus[] = [
      "pending",
      "preparing",
      "ready",
      "delivering",
      "out_for_delivery",
      "completed",
      "delivered",
    ];

    // Ajustar para lidar com out_for_delivery e delivered
    let currentIndex = statusOrder.indexOf(order.status);

    // Se o status for out_for_delivery, considerar como o mesmo nível que delivering
    if (order.status === "out_for_delivery" && currentIndex > 0) {
      currentIndex = statusOrder.indexOf("delivering");
    }

    // Se o status for delivered, considerar como o mesmo nível que completed
    if (order.status === "delivered" && currentIndex > 0) {
      currentIndex = statusOrder.indexOf("completed");
    }

    // Se o status não for encontrado ou for cancelado, retornar 0
    if (currentIndex === -1 || order.status === "cancelled") return 0;

    // Calcular o progresso em percentual (0-100)
    // Ajustar para considerar delivered e completed como mesmo nível para cálculo
    const maxSteps = statusOrder.indexOf("completed") + 1;
    return Math.min(100, Math.round(((currentIndex + 1) / maxSteps) * 100));
  };

  // Função para determinar a cor de fundo do status
  const getStatusBackgroundColor = (status: OrderStatus) => {
    // Status concluídos com sucesso em verde
    if (status === "completed" || status === "delivered") {
      return "bg-green-50";
    }

    // Status de cancelado em vermelho claro
    if (status === "cancelled") {
      return "bg-red-50";
    }

    // Outros status em rosa claro (padrão)
    return "bg-delivery-50";
  };

  // Função para determinar a cor do texto do status
  const getStatusTextColor = (status: OrderStatus) => {
    // Status concluídos com sucesso em verde
    if (status === "completed" || status === "delivered") {
      return "text-green-600";
    }

    // Status de cancelado em vermelho
    if (status === "cancelled") {
      return "text-red-600";
    }

    // Outros status em preto (padrão)
    return "text-delivery-700";
  };

  // Se estiver carregando, mostrar um indicador de carregamento
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-delivery-500"></div>
      </div>
    );
  }

  // Se ocorrer um erro, mostrar mensagem de erro
  if (error || !order) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center">
        <h2 className="text-xl font-bold mb-4">Erro ao carregar pedido</h2>
        <p className="text-muted-foreground mb-6">
          {error || "Pedido não encontrado"}
        </p>
        <Button onClick={() => navigate("/")}>Voltar para o início</Button>
      </div>
    );
  }

  // Ícones para os diferentes status
  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case "pending":
        return <Clock className="h-6 w-6" />;
      case "preparing":
        return <CookingPot className="h-6 w-6" />;
      case "ready":
        return <ShoppingBag className="h-6 w-6" />;
      case "delivering":
        return <Truck className="h-6 w-6" />;
      case "out_for_delivery":
        return <Truck className="h-6 w-6" />;
      case "completed":
        return <Check className="h-6 w-6" />;
      case "delivered":
        return <Check className="h-6 w-6" />;
      case "cancelled":
        return <Package className="h-6 w-6" />;
      default:
        return <Clock className="h-6 w-6" />;
    }
  };

  // No componente de renderização, lidar com métodos de pagamento comuns diretamente
  const mapPaymentMethodToName = (paymentMethodId: string): string => {
    if (loadingPaymentMethods) {
      return "Carregando...";
    }

    // Verificar se temos o método nos dados carregados do banco
    const method = paymentMethods.find((m) => m.id === paymentMethodId);
    if (method) return method.name;

    // Mapeamento para métodos de pagamento comuns
    const commonMethods: Record<string, string> = {
      pix: "PIX",
      credit: "Cartão de Crédito",
      debit: "Cartão de Débito",
      cash: "Dinheiro",
      transfer: "Transferência Bancária",
    };

    // Verificar se é um dos métodos comuns
    return commonMethods[paymentMethodId] || paymentMethodId;
  };

  // Renderizar o componente de rastreamento
  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-6">
        <Button
          variant="ghost"
          className="mb-4 pl-0"
          onClick={() => navigate("/")}
        >
          <ChevronLeft className="mr-2 h-5 w-5" /> Voltar para o menu
        </Button>
        <h1 className="text-2xl font-bold">Acompanhar Pedido</h1>
        <p className="text-muted-foreground">
          Pedido #{order.number} • {formatDateTime(order.created_at)}
        </p>
      </div>

      {/* Status atual - Aplicar cores dinâmicas */}
      <div
        className={`p-4 rounded-lg mb-6 ${getStatusBackgroundColor(
          order.status
        )}`}
      >
        <div className="flex items-center gap-3">
          <div className={getStatusTextColor(order.status)}>
            {getStatusIcon(order.status)}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status atual</p>
            <h2
              className={`text-xl font-semibold ${getStatusTextColor(
                order.status
              )}`}
            >
              {formatStatus(order.status)}
            </h2>
          </div>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="mb-8">
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-delivery-500 h-2.5 rounded-full"
            style={{ width: `${getOrderProgress()}%` }}
          ></div>
        </div>
        <div className="mt-6 grid grid-cols-5 gap-2">
          {/* Etapas do pedido */}
          <StatusStep
            title="Recebido"
            isActive={[
              "pending",
              "preparing",
              "ready",
              "delivering",
              "out_for_delivery",
              "completed",
              "delivered",
            ].includes(order.status)}
            icon={
              <Clock
                className={`h-5 w-5 ${
                  [
                    "pending",
                    "preparing",
                    "ready",
                    "delivering",
                    "out_for_delivery",
                    "completed",
                    "delivered",
                  ].includes(order.status)
                    ? "text-delivery-500"
                    : "text-gray-400"
                }`}
              />
            }
          />
          <StatusStep
            title="Preparando"
            isActive={[
              "preparing",
              "ready",
              "delivering",
              "out_for_delivery",
              "completed",
              "delivered",
            ].includes(order.status)}
            icon={
              <CookingPot
                className={`h-5 w-5 ${
                  [
                    "preparing",
                    "ready",
                    "delivering",
                    "out_for_delivery",
                    "completed",
                    "delivered",
                  ].includes(order.status)
                    ? "text-delivery-500"
                    : "text-gray-400"
                }`}
              />
            }
          />
          <StatusStep
            title="Pronto"
            isActive={[
              "ready",
              "delivering",
              "out_for_delivery",
              "completed",
              "delivered",
            ].includes(order.status)}
            icon={
              <ShoppingBag
                className={`h-5 w-5 ${
                  [
                    "ready",
                    "delivering",
                    "out_for_delivery",
                    "completed",
                    "delivered",
                  ].includes(order.status)
                    ? "text-delivery-500"
                    : "text-gray-400"
                }`}
              />
            }
          />
          <StatusStep
            title={
              order.order_type === "delivery"
                ? "Em entrega"
                : "Aguardando retirada"
            }
            isActive={[
              "delivering",
              "out_for_delivery",
              "completed",
              "delivered",
            ].includes(order.status)}
            icon={
              order.order_type === "delivery" ? (
                <Truck
                  className={`h-5 w-5 ${
                    [
                      "delivering",
                      "out_for_delivery",
                      "completed",
                      "delivered",
                    ].includes(order.status)
                      ? "text-delivery-500"
                      : "text-gray-400"
                  }`}
                />
              ) : (
                <ShoppingBag
                  className={`h-5 w-5 ${
                    [
                      "delivering",
                      "out_for_delivery",
                      "completed",
                      "delivered",
                    ].includes(order.status)
                      ? "text-delivery-500"
                      : "text-gray-400"
                  }`}
                />
              )
            }
          />
          <StatusStep
            title={
              order.order_type === "delivery"
                ? "Entregue"
                : order.order_type === "takeaway"
                ? "Retirado"
                : "Servido"
            }
            isActive={["completed", "delivered"].includes(order.status)}
            icon={
              <Check
                className={`h-5 w-5 ${
                  ["completed", "delivered"].includes(order.status)
                    ? "text-delivery-500"
                    : "text-gray-400"
                }`}
              />
            }
          />
        </div>
      </div>

      {/* Detalhes do pedido */}
      <div className="border rounded-lg mb-6">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Detalhes do pedido</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tipo de pedido</span>
            <span>{formatOrderType(order.order_type)}</span>
          </div>

          {order.order_type === "delivery" && order.delivery_address && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Endereço de entrega</span>
              <span className="text-right">{order.delivery_address}</span>
            </div>
          )}

          {order.order_type === "instore" && order.table_number && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Número da mesa</span>
              <span>{order.table_number}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-muted-foreground">Forma de pagamento</span>
            <span>{mapPaymentMethodToName(order.payment_method)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Status do pagamento</span>
            <span>{order.payment_status === "paid" ? "Pago" : "Pendente"}</span>
          </div>
        </div>
      </div>

      {/* Itens do pedido */}
      <div className="border rounded-lg mb-6">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Itens do pedido</h3>
        </div>
        <div className="divide-y">
          {orderItems.map((item) => (
            <div key={item.id} className="p-4 flex items-center gap-3">
              {item.product_image_url ? (
                <div className="w-14 h-14 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden">
                  <img
                    src={item.product_image_url}
                    alt={item.product_name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-14 h-14 flex-shrink-0 bg-gray-100 rounded-md flex items-center justify-center text-gray-500">
                  <Package className="h-6 w-6" />
                </div>
              )}
              <div className="flex-1">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Qtd: {item.quantity}
                    </p>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground italic">
                        Obs: {item.notes}
                      </p>
                    )}
                  </div>
                  <p className="font-medium">
                    {formatCurrency(item.total_price)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Total do pedido */}
      <div className="border rounded-lg">
        <div className="p-4">
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente para cada etapa do rastreamento
interface StatusStepProps {
  title: string;
  isActive: boolean;
  icon: React.ReactNode;
}

function StatusStep({ title, isActive, icon }: StatusStepProps) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 ${
          isActive ? "bg-delivery-100" : "bg-gray-100"
        }`}
      >
        {icon}
      </div>
      <span
        className={`text-xs text-center ${
          isActive ? "text-delivery-700 font-medium" : "text-gray-500"
        }`}
      >
        {title}
      </span>
    </div>
  );
}



