import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Clock,
  Check,
  Package,
  Ban,
  Truck,
  MoreHorizontal,
  GripVertical,
  Printer,
  Eye,
  Phone,
  DollarSign,
  Store,
  Users,
  MapPin,
  Package2,
  MoveVertical,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PrintReceiptDialog } from "./PrintReceiptDialog";
import { OrderDetailsDialog } from "./OrderDetailsDialog";
import { OrderStatus } from "@/types";
import { usePaymentMethods } from "@/hooks/useOrders";

type KanbanOrder = {
  id: string;
  number: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  status: string;
  payment_status: string;
  payment_method: string;
  delivery_address?: string;
  table_number?: string;
  order_type?: string;
  notes?: string;
};

type KanbanColumn = {
  title: string;
  status: string;
  icon: React.ReactNode;
  orders: KanbanOrder[];
};

interface OrderKanbanProps {
  onUpdateOrderStatus?: (orderId: string, status: OrderStatus) => Promise<void>;
}

const getOrderTypeInfo = (order: KanbanOrder) => {
  if (order.order_type === "delivery" || order.delivery_address) {
    return {
      label: "Entrega",
      bgColor: "bg-green-100 text-green-700",
    };
  } else if (order.order_type === "dine_in" || order.table_number) {
    return {
      label: `Mesa ${order.table_number || ""}`,
      bgColor: "bg-purple-100 text-purple-700",
    };
  } else {
    return {
      label: "Retirada",
      bgColor: "bg-yellow-100 text-yellow-700",
    };
  }
};

export function OrderKanban({ onUpdateOrderStatus }: OrderKanbanProps) {
  const queryClient = useQueryClient();
  const [printOrderId, setPrintOrderId] = React.useState<string | null>(null);
  const [viewOrderId, setViewOrderId] = React.useState<string | null>(null);
  const { data: paymentMethods = [] } = usePaymentMethods();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["kanban-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .in("status", ["pending", "preparing", "ready"])
        .not("number", "like", "DELETED_%")
        .order("created_at", { ascending: true });

      if (error) throw error;

      return data;
    },
  });

  const handlePrint = (orderId: string) => {
    setPrintOrderId(orderId);
  };

  const handleViewDetails = (orderId: string) => {
    setViewOrderId(orderId);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      console.log('Updating order status:', { orderId, newStatus });
      
      // Otimista: Modificar o cache antes da solicitação para atualização imediata na UI
      queryClient.setQueryData(
        ["kanban-orders"],
        (oldData: KanbanOrder[] | undefined) => {
          if (!oldData) return [];
          return oldData.map((order: KanbanOrder) => {
            if (order.id === orderId) {
              return { ...order, status: newStatus };
            }
            return order;
          });
        }
      );

      // Usar a função fornecida via props se existir
      if (onUpdateOrderStatus) {
        await onUpdateOrderStatus(orderId, newStatus as OrderStatus);
      } else {
        // Usar a implementação padrão como fallback
        const { error, data } = await supabase
          .from("orders")
          .update({ status: newStatus })
          .eq("id", orderId)
          .select();

        if (error) throw error;
        
        console.log('Order updated successfully:', data);
        toast.success(`Pedido atualizado para ${newStatus}`);
        await queryClient.invalidateQueries({ queryKey: ["kanban-orders"] });
      }
    } catch (error: unknown) {
      console.error("Error updating order status:", error);
      toast.error("Erro ao atualizar status do pedido");

      // Reverter o cache em caso de erro
      await queryClient.invalidateQueries({ queryKey: ["kanban-orders"] });
    }
  };

  const handleConfirmOrder = async (orderId: string, currentStatus: string) => {
    const nextStatus = getNextStatus(currentStatus);
    await updateOrderStatus(orderId, nextStatus);
  };

  const handleCancelOrder = async (orderId: string) => {
    await updateOrderStatus(orderId, "canceled");
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return "preparing";
      case "preparing":
        return "ready";
      case "ready":
        return "out_for_delivery";
      default:
        return currentStatus;
    }
  };

  const getPaymentMethodLabel = (methodId: string) => {
    const method = paymentMethods.find((m) => m.id === methodId);
    return method ? method.name : methodId;
  };

  const columns: KanbanColumn[] = [
    {
      title: "Pedidos Pendentes",
      status: "pending",
      icon: <Clock className="h-5 w-5 text-yellow-500" />,
      orders: orders.filter(
        (order) =>
          order.status === "pending" && !order.number.startsWith("DELETED_")
      ),
    },
    {
      title: "Em Preparo",
      status: "preparing",
      icon: <Package className="h-5 w-5 text-blue-500" />,
      orders: orders.filter(
        (order) =>
          order.status === "preparing" && !order.number.startsWith("DELETED_")
      ),
    },
    {
      title: "Prontos para Entrega",
      status: "ready",
      icon: <Check className="h-5 w-5 text-green-500" />,
      orders: orders.filter(
        (order) =>
          order.status === "ready" && !order.number.startsWith("DELETED_")
      ),
    },
  ];

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, source, destination } = result;
    const sourceColumn = columns.find(
      (col) => col.status === source.droppableId
    );
    const destColumn = columns.find(
      (col) => col.status === destination.droppableId
    );

    if (
      !sourceColumn ||
      !destColumn ||
      source.droppableId === destination.droppableId
    )
      return;

    const order = sourceColumn.orders.find((o) => o.id === draggableId);
    if (!order) return;

    await updateOrderStatus(draggableId, destination.droppableId);
  };

  if (isLoading) {
    return (
      <div className="w-full p-8 flex justify-center items-center">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Carregando pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((column) => (
            <Card key={column.status} className="bg-muted/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {column.icon}
                  {column.title}
                  <Badge variant="secondary" className="ml-auto">
                    {column.orders.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <Droppable droppableId={column.status}>
                {(provided) => (
                  <CardContent
                    className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto p-3"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {column.orders.length === 0 ? (
                      <div className="text-center py-6 text-sm text-muted-foreground">
                        Nenhum pedido nesta coluna
                      </div>
                    ) : (
                      column.orders.map((order, index) => (
                        <Draggable
                          key={order.id}
                          draggableId={order.id}
                          index={index}
                        >
                          {(provided) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="bg-card shadow-sm hover:shadow-md transition-shadow"
                            >
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    <MoveVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                    <span className="font-medium">
                                      #{order.number}
                                    </span>
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <span className="font-medium">
                                      {new Intl.NumberFormat("pt-BR", {
                                        style: "currency",
                                        currency: "BRL",
                                      }).format(order.total)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {getPaymentMethodLabel(
                                        order.payment_method
                                      )}
                                    </span>
                                  </div>
                                </div>

                                <div className="mb-2">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "px-2 py-0.5 text-xs font-medium",
                                      getOrderTypeInfo(order).bgColor
                                    )}
                                  >
                                    {getOrderTypeInfo(order).label}
                                  </Badge>
                                </div>

                                <div>
                                  <p className="font-medium">
                                    {order.customer_name}
                                  </p>
                                  <div className="flex items-center text-sm text-muted-foreground mt-0.5">
                                    <Phone className="h-3 w-3 mr-1" />
                                    {order.customer_phone}
                                  </div>
                                </div>

                                {order.notes && order.notes.trim() !== "" && (
                                  <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
                                    <p className="line-clamp-2">
                                      {order.notes}
                                    </p>
                                  </div>
                                )}

                                <div className="flex justify-between mt-3">
                                  <div className="flex gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => handlePrint(order.id)}
                                    >
                                      <Printer className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() =>
                                        handleViewDetails(order.id)
                                      }
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                      onClick={() =>
                                        handleConfirmOrder(
                                          order.id,
                                          order.status
                                        )
                                      }
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() =>
                                        handleCancelOrder(order.id)
                                      }
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </CardContent>
                )}
              </Droppable>
            </Card>
          ))}
        </div>
      </DragDropContext>

      <PrintReceiptDialog
        orderId={printOrderId}
        open={printOrderId !== null}
        onClose={() => setPrintOrderId(null)}
      />

      <OrderDetailsDialog
        orderId={viewOrderId}
        open={viewOrderId !== null}
        onClose={() => setViewOrderId(null)}
      />
    </>
  );
}



