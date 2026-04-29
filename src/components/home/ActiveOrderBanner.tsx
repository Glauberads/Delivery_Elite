import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock, Package2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ActiveOrderBannerProps {
  className?: string;
}

export function ActiveOrderBanner({ className }: ActiveOrderBannerProps) {
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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

  // Formatação de status para exibição
  const formatStatus = (status: string): string => {
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

  // Verificar se há um pedido ativo
  useEffect(() => {
    const checkForActiveOrder = async () => {
      setIsLoading(true);
      const storedOrderId = getStoredOrderId();

      if (!storedOrderId) {
        setIsLoading(false);
        return;
      }

      try {
        // Buscar informações atualizadas do pedido no banco de dados
        const { data, error } = await supabase
          .from("orders")
          .select("id, number, status")
          .eq("id", storedOrderId)
          .single();

        if (error) {
          console.error("Erro ao buscar pedido:", error);
          setIsLoading(false);
          return;
        }

        if (data) {
          // Verificar se o pedido está em um status ativo (não completado ou cancelado)
          const isActiveStatus = ![
            "completed",
            "delivered",
            "cancelled",
          ].includes(data.status);

          // Só mostrar o banner se o pedido ainda estiver ativo
          if (isActiveStatus) {
            setOrderId(data.id);
            setOrderNumber(data.number);
            setOrderStatus(data.status);
          }
        }
      } catch (err) {
        console.error("Erro ao processar pedido:", err);
      } finally {
        setIsLoading(false);
      }
    };

    checkForActiveOrder();

    // Verificar novamente a cada 2 minutos
    const interval = setInterval(checkForActiveOrder, 120000);

    return () => clearInterval(interval);
  }, []);

  // Se não há pedido ativo ou está carregando, não mostrar nada
  if (isLoading || !orderId || !orderNumber) {
    return null;
  }

  return (
    <div
      className={`mb-6 rounded-lg border border-delivery-200/70 bg-delivery-50 p-4 shadow-sm dark:border-delivery-900/70 dark:bg-delivery-950/35 ${className}`}
    >
      <div className="flex items-start gap-3">
        <Package2 className="h-5 w-5 text-delivery-500 mt-1" />
        <div className="flex-1">
          <h3 className="text-base font-medium text-foreground">
            Você tem um pedido em andamento
          </h3>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <span>#{orderNumber}</span>
            <span className="mx-1">•</span>
            <span>Status: {formatStatus(orderStatus || "")}</span>
          </div>
        </div>
        <Button
          className="bg-delivery-500 hover:bg-delivery-600"
          onClick={() => navigate(`/track-order/${orderId}`)}
        >
          <Clock className="mr-2 h-4 w-4" />
          Acompanhar
        </Button>
      </div>
    </div>
  );
}



