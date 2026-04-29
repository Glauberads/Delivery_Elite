import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  Clock,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { OrderStatus, PaymentStatus, Order } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";

interface OrderTableProps {
  orders: Order[];
  isLoading: boolean;
  onViewOrder: (order: Order) => void;
  onEditOrder: (order: Order) => void;
  onDeleteOrder: (order: Order) => void;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  onUpdatePaymentStatus: (orderId: string, status: PaymentStatus) => void;
  getStatusConfig: (status: OrderStatus) => {
    label: string;
    variant: BadgeVariant;
    icon: React.ElementType;
  };
  getPaymentStatusConfig: (status: PaymentStatus) => {
    label: string;
    variant: BadgeVariant;
  };
  getPaymentMethodLabel: (methodId: string) => string;
  getStatusActions: (order: Order) => Array<{ status: string; label: string }>;
  getPaymentActions: (order: Order) => Array<{ status: string; label: string }>;
}

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success";

export function OrderTable({
  orders,
  isLoading,
  onViewOrder,
  onEditOrder,
  onDeleteOrder,
  onUpdateOrderStatus,
  onUpdatePaymentStatus,
  getStatusConfig,
  getPaymentStatusConfig,
  getPaymentMethodLabel,
  getStatusActions,
  getPaymentActions,
}: OrderTableProps) {
  // Filtrar pedidos logicamente excluídos
  const filteredOrders = orders.filter(
    (order) => !order.number.startsWith("DELETED_")
  );

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

  if (filteredOrders.length === 0) {
    return (
      <div className="w-full p-8 flex justify-center items-center border rounded-md">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <p>Nenhum pedido encontrado</p>
          <p className="text-sm">
            Tente ajustar os filtros ou criar um novo pedido
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Número</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Pagamento</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-center w-[140px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredOrders.map((order) => {
            const statusConfig = getStatusConfig(order.status);
            const paymentStatusConfig = getPaymentStatusConfig(
              order.paymentStatus
            );
            const StatusIcon = statusConfig.icon;
            const statusActions = getStatusActions(order);
            const paymentActions = getPaymentActions(order);

            return (
              <TableRow key={order.id} className="hover:bg-muted/40">
                <TableCell className="font-medium">#{order.number}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{order.customer.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {order.customer.phone}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={statusConfig.variant}
                    className={cn(
                      "inline-flex items-center gap-1",
                      statusConfig.variant === "success" &&
                        "bg-success-500 hover:bg-success-600"
                    )}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="inline-flex items-center gap-1">
                    <div className="flex items-center gap-1 text-sm">
                      <CreditCard className="h-3 w-3" />
                      {getPaymentMethodLabel(order.paymentMethod)}
                    </div>
                    <Badge
                      variant={paymentStatusConfig.variant}
                      className={cn(
                        paymentStatusConfig.variant === "success" &&
                          "bg-success-500 hover:bg-success-600"
                      )}
                    >
                      {paymentStatusConfig.label}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(order.total)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {new Date(order.createdAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-center items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onViewOrder(order)}
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      title="Visualizar"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      id={`delete-order-${order.id}`}
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteOrder(order)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      title="Excluir permanentemente"
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {statusActions.length > 0 && (
                          <>
                            <DropdownMenuLabel className="flex items-center gap-2">
                              <StatusIcon className="h-4 w-4" />
                              Atualizar Status
                            </DropdownMenuLabel>
                            <DropdownMenuGroup>
                              {statusActions.map((action) => (
                                <DropdownMenuItem
                                  key={`status-${action.status}`}
                                  onClick={() =>
                                    onUpdateOrderStatus(
                                      order.id,
                                      action.status as OrderStatus
                                    )
                                  }
                                >
                                  {action.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuGroup>
                            {paymentActions.length > 0 && (
                              <DropdownMenuSeparator />
                            )}
                          </>
                        )}
                        {paymentActions.length > 0 && (
                          <>
                            <DropdownMenuLabel className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4" />
                              Atualizar Pagamento
                            </DropdownMenuLabel>
                            <DropdownMenuGroup>
                              {paymentActions.map((action) => (
                                <DropdownMenuItem
                                  key={`payment-${action.status}`}
                                  onClick={() =>
                                    onUpdatePaymentStatus(
                                      order.id,
                                      action.status as PaymentStatus
                                    )
                                  }
                                >
                                  {action.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuGroup>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}



