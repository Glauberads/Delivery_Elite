import React from "react";
import { Clock, Check, Truck, Ban } from "lucide-react";
import { Order, OrderStatus, PaymentStatus } from "@/types";

// Define BadgeVariant type to ensure consistency
type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success";
// Define LucideIcon type for Lucide React icons
type LucideIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export function useOrderStatuses() {
  const getStatusConfig = (
    status: OrderStatus
  ): { label: string; variant: BadgeVariant; icon: LucideIcon } => {
    switch (status) {
      case "pending":
        return { label: "Pendente", variant: "outline", icon: Clock };
      case "confirmed":
        return { label: "Confirmado", variant: "secondary", icon: Check };
      case "preparing":
        return { label: "Em preparo", variant: "default", icon: Clock };
      case "ready":
        return { label: "Retirada", variant: "default", icon: Check };
      case "out_for_delivery":
        return { label: "Em entrega", variant: "default", icon: Truck };
      case "delivered":
        return { label: "Entregue", variant: "success", icon: Check };
      case "canceled":
        return { label: "Cancelado", variant: "destructive", icon: Ban };
    }
  };

  const getPaymentStatusConfig = (
    status: PaymentStatus
  ): { label: string; variant: BadgeVariant } => {
    switch (status) {
      case "pending":
        return { label: "Pendente", variant: "outline" };
      case "paid":
        return { label: "Pago", variant: "success" };
      case "failed":
        return { label: "Falhou", variant: "destructive" };
      case "refunded":
        return { label: "Reembolsado", variant: "secondary" };
    }
  };

  const getStatusActions = (order: Order) => {
    const actions = [];

    if (order.status === "pending") {
      actions.push({ status: "preparing", label: "Iniciar Preparo" });
      actions.push({ status: "canceled", label: "Cancelar Pedido" });
    } else if (order.status === "confirmed") {
      actions.push({ status: "preparing", label: "Iniciar Preparo" });
      actions.push({ status: "canceled", label: "Cancelar Pedido" });
    } else if (order.status === "preparing") {
      actions.push({ status: "ready", label: "Marcar como Pronto" });
    } else if (order.status === "ready") {
      actions.push({
        status: "out_for_delivery",
        label: "Enviar para Entrega",
      });
    } else if (order.status === "out_for_delivery") {
      actions.push({ status: "delivered", label: "Confirmar Entrega" });
    }

    return actions;
  };

  const getPaymentActions = (order: Order) => {
    const actions = [];

    if (order.paymentStatus === "pending") {
      actions.push({ status: "paid", label: "Marcar como Pago" });
      actions.push({ status: "failed", label: "Marcar como Falhou" });
    } else if (order.paymentStatus === "paid") {
      actions.push({ status: "refunded", label: "Marcar como Reembolsado" });
    } else if (order.paymentStatus === "failed") {
      actions.push({ status: "pending", label: "Marcar como Pendente" });
    }

    return actions;
  };

  return {
    getStatusConfig,
    getPaymentStatusConfig,
    getStatusActions,
    getPaymentActions,
  };
}



