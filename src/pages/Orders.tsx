import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderKanban } from "@/components/orders/OrderKanban";
import { OrderTable } from "@/components/orders/OrderTable";
import { OrderSearch } from "@/components/orders/OrderSearch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  ShoppingCart,
  BadgeCheck,
  BadgeAlert,
  Loader2,
} from "lucide-react";
import { useOrders, usePaymentMethods, usePaginatedOrders } from "@/hooks/useOrders";
import { useOrderStatuses } from "@/hooks/useOrderStatuses";
import { CreateOrderDialog } from "@/components/orders/CreateOrderDialog";
import { Order, OrderStatus, PaymentStatus } from "@/types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { shouldBlockTenantAccess } from "@/lib/trial";

interface OrderUpdate {
  status?: OrderStatus;
  delivery_status?: string;
  payment_status?: PaymentStatus;
}

interface ApiError {
  message: string;
}

export default function Orders() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"kanban" | "table">("kanban");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Estados de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Usar hook paginado para dados da tabela
  const { 
    data: paginatedData, 
    isLoading: isLoadingOrders 
  } = usePaginatedOrders({
    page: currentPage,
    limit: itemsPerPage,
    searchQuery,
    statusFilter
  });
  
  // Manter hook original para estatísticas (sem paginação)
  const { data: allOrders = [] } = useOrders();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const queryClient = useQueryClient();
  const accessBlocked =
    !user?.isSuperAdmin &&
    shouldBlockTenantAccess({
      trialEndsAt: user?.trialEndsAt,
      tenantStatus: user?.tenantStatus,
      subscriptionPeriodEnd: user?.subscriptionCurrentPeriodEnd,
      subscriptionStatus: user?.subscriptionStatus,
    });
  const {
    getStatusConfig,
    getPaymentStatusConfig,
    getStatusActions,
    getPaymentActions,
  } = useOrderStatuses();

  const getPaymentMethodLabel = (methodId: string) => {
    const method = paymentMethods.find((m) => m.id === methodId);
    return method ? method.name : methodId;
  };

  // Usar dados paginados do hook
  const orders = paginatedData?.orders || [];
  const totalCount = paginatedData?.totalCount || 0;
  const totalPages = paginatedData?.totalPages || 0;
  const hasNextPage = paginatedData?.hasNextPage || false;
  const hasPreviousPage = paginatedData?.hasPreviousPage || false;
  
  // Filtrar pedidos logicamente excluídos
  const filteredOrders = orders.filter((order) => {
    return !order.number.startsWith("DELETED_");
  });
  
  // Para estatísticas, usar todos os pedidos filtrados
  const allFilteredOrders = allOrders.filter((order) => {
    if (order.number.startsWith("DELETED_")) return false;
    
    const matchesSearch =
      order.id.includes(searchQuery) ||
      order.number.includes(searchQuery) ||
      order.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.phone.includes(searchQuery);

    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const updates: OrderUpdate = { status };

      if (status === "out_for_delivery") {
        updates.delivery_status = "pending";
      }

      const { error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", orderId);

      if (error) throw error;

      toast.success(`Status atualizado para ${getStatusConfig(status).label}`);

      // Imediatamente invalida o cache para atualizar todas as visualizações
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["active-deliveries"] });
    } catch (error) {
      const apiError = error as ApiError;
      console.error("Error updating order status:", error);
      toast.error("Erro ao atualizar status: " + apiError.message);
    }
  };

  const updatePaymentStatus = async (
    orderId: string,
    paymentStatus: PaymentStatus
  ) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ payment_status: paymentStatus })
        .eq("id", orderId);

      if (error) throw error;

      toast.success(
        `Status de pagamento atualizado para ${
          getPaymentStatusConfig(paymentStatus).label
        }`
      );
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (error) {
      const apiError = error as ApiError;
      console.error("Error updating payment status:", error);
      toast.error("Erro ao atualizar status de pagamento: " + apiError.message);
    }
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsViewDialogOpen(true);
  };

  const handleEditOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsEditDialogOpen(true);
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete) {
      toast.error("Erro: Nenhum pedido selecionado para exclusão");
      setIsDeleting(false);
      return;
    }

    setIsDeleting(true);

    try {
      // Verificação adicional para garantir que o pedido existe
      const { data: orderExists, error: orderCheckError } = await supabase
        .from("orders")
        .select("id, number")
        .eq("id", orderToDelete.id)
        .single();

      if (orderCheckError) {
        console.error(
          "Erro ao verificar existência do pedido:",
          orderCheckError
        );
        toast.error(
          "Erro ao verificar existência do pedido: " + orderCheckError.message
        );
        setIsDeleting(false);
        return;
      }

      if (!orderExists) {
        toast.error("Erro: Pedido não encontrado no banco de dados");
        setIsDeleting(false);
        return;
      }

      // 1. Buscar todos os itens do pedido
      const { data: orderItems, error: orderItemsError } = await supabase
        .from("order_items")
        .select("id")
        .eq("order_id", orderToDelete.id);

      if (orderItemsError) {
        console.error("Erro ao buscar itens do pedido:", orderItemsError);
        toast.error(
          "Erro ao buscar itens do pedido: " + orderItemsError.message
        );
        setIsDeleting(false);
        return;
      }

      // 2. Para cada item do pedido, excluir seus adicionais
      if (orderItems && orderItems.length > 0) {
        const orderItemIds = orderItems.map((item) => item.id);

        // Excluir todos os adicionais dos itens do pedido
        const { error: addonsDeleteError } = await supabase
          .from("order_item_addons")
          .delete()
          .in("order_item_id", orderItemIds);

        if (addonsDeleteError) {
          console.error(
            "Erro ao excluir adicionais dos itens:",
            addonsDeleteError
          );
          toast.error(
            "Erro ao excluir adicionais dos itens: " + addonsDeleteError.message
          );
          // Continuar mesmo com erro para tentar limpar o máximo possível
        }

        // 3. Excluir os itens do pedido
        const { error: itemsDeleteError } = await supabase
          .from("order_items")
          .delete()
          .eq("order_id", orderToDelete.id);

        if (itemsDeleteError) {
          console.error("Erro ao excluir itens do pedido:", itemsDeleteError);
          toast.error(
            "Erro ao excluir itens do pedido: " + itemsDeleteError.message
          );
          // Continuar mesmo com erro para tentar a exclusão do pedido
        }
      }

      // 4. Excluir definitivamente o pedido principal
      const { error: deleteError } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderToDelete.id);

      if (deleteError) {
        console.error("Erro ao excluir o pedido:", deleteError);
        toast.error("Erro ao excluir pedido: " + deleteError.message);
        setIsDeleting(false);
        return;
      }

      toast.success("Pedido excluído permanentemente com sucesso");

      // Atualizar a lista de pedidos
      await queryClient.invalidateQueries({ queryKey: ["orders"] });

      // Esperar um momento antes de fechar o diálogo
      setTimeout(() => {
        setDeleteDialogOpen(false);
        setOrderToDelete(null);
        setIsDeleting(false);
      }, 500);
    } catch (error) {
      const apiError = error as ApiError;
      console.error("Erro ao excluir pedido:", error);
      toast.error("Erro ao excluir pedido: " + apiError.message);
      setIsDeleting(false);
    }
  };

  const confirmDelete = (order: Order) => {
    setOrderToDelete(order);
    setTimeout(() => {
      setDeleteDialogOpen(true);
    }, 100);
  };

  const pendingOrdersCount = allFilteredOrders.filter((order) =>
    ["pending", "confirmed", "preparing"].includes(order.status)
  ).length;

  const completedOrdersCount = allFilteredOrders.filter((order) =>
    ["delivered", "ready"].includes(order.status)
  ).length;

  const canceledOrdersCount = allFilteredOrders.filter(
    (order) => order.status === "canceled"
  ).length;
  
  // Funções de paginação
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  const handleItemsPerPageChange = (items: string) => {
    setItemsPerPage(Number(items));
    setCurrentPage(1); // Reset para primeira página
  };
  
  // Reset página quando filtros mudam
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  React.useEffect(() => {
    const orderId = searchParams.get("orderId");

    if (!orderId || allOrders.length === 0) {
      return;
    }

    const targetOrder = allOrders.find((order) => order.id === orderId);

    if (!targetOrder) {
      return;
    }

    setActiveTab("table");
    setSelectedOrder(targetOrder);
    setIsViewDialogOpen(true);
  }, [allOrders, searchParams]);

  // Renderização do modal de visualização do pedido
  const renderOrderViewDialog = () => {
    if (!selectedOrder) return null;

    return (
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pedido #{selectedOrder.number}</DialogTitle>
          <DialogDescription>
            Detalhes do pedido de {selectedOrder.customer.name}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Informações do Cliente</h3>
            <div className="text-sm">
              <p>
                <span className="font-medium">Nome:</span>{" "}
                {selectedOrder.customer.name}
              </p>
              <p>
                <span className="font-medium">Telefone:</span>{" "}
                {selectedOrder.customer.phone}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Informações do Pedido</h3>
            <div className="text-sm">
              <p>
                <span className="font-medium">Data:</span>{" "}
                {new Date(selectedOrder.createdAt).toLocaleString("pt-BR")}
              </p>
              <p>
                <span className="font-medium">Status:</span>{" "}
                {getStatusConfig(selectedOrder.status).label}
              </p>
              <p>
                <span className="font-medium">Pagamento:</span>{" "}
                {getPaymentMethodLabel(selectedOrder.paymentMethod)}
              </p>
              <p>
                <span className="font-medium">Status de Pagamento:</span>{" "}
                {getPaymentStatusConfig(selectedOrder.paymentStatus).label}
              </p>
            </div>
          </div>
        </div>

        <div className="border rounded-md p-4 space-y-4">
          <h3 className="text-sm font-medium">Itens do Pedido</h3>
          <div className="space-y-4">
            {selectedOrder.items.map((item) => (
              <div
                key={item.id}
                className="border-b pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex justify-between">
                  <div className="font-medium">
                    {item.quantity}x {item.product.name}
                  </div>
                  <div className="font-medium">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(
                      (item.basePrice || item.product.price) * item.quantity
                    )}
                  </div>
                </div>

                {item.addons && item.addons.length > 0 && (
                  <div className="pl-4 mt-1">
                    {item.addons.map((addon) => (
                      <div
                        key={addon.addon.id}
                        className="text-sm text-muted-foreground flex justify-between"
                      >
                        <span>+ {addon.addon.name}</span>
                        <span>
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(addon.addon.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {item.notes && (
                  <div className="text-sm text-muted-foreground mt-1 pl-4">
                    <span className="font-medium">Obs:</span> {item.notes}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(selectedOrder.subtotal)}
              </span>
            </div>

            {selectedOrder.deliveryFee > 0 && (
              <div className="flex justify-between text-sm">
                <span>Taxa de entrega</span>
                <span>
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(selectedOrder.deliveryFee)}
                </span>
              </div>
            )}

            {selectedOrder.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span>Desconto</span>
                <span>
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(selectedOrder.discount)}
                </span>
              </div>
            )}

            <div className="flex justify-between font-medium pt-1">
              <span>Total</span>
              <span>
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(selectedOrder.total)}
              </span>
            </div>
          </div>

          {selectedOrder.notes && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium">Observações:</p>
              <p className="text-sm">{selectedOrder.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Pedidos" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Pedidos Ativos"
            value={pendingOrdersCount}
            icon={ShoppingCart}
            description="Pedidos em andamento"
          />
          <StatCard
            title="Pedidos Concluídos"
            value={completedOrdersCount}
            icon={BadgeCheck}
            description="Pedidos entregues ou prontos"
          />
          <StatCard
            title="Pedidos Cancelados"
            value={canceledOrdersCount}
            icon={BadgeAlert}
            description="Pedidos cancelados"
          />
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "kanban" | "table")}
          className="w-full"
        >
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="table">Lista</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-6">
            <OrderKanban onUpdateOrderStatus={updateOrderStatus} />
          </TabsContent>

          <TabsContent value="table" className="mt-6 space-y-4">
            <div className="flex justify-between items-center">
              <OrderSearch
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              />
              <Button onClick={() => setIsCreateDialogOpen(true)} disabled={accessBlocked}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Pedido
              </Button>
            </div>

            {isLoadingOrders ? (
              <div className="w-full p-8 flex justify-center items-center border rounded-md">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Carregando pedidos...
                  </p>
                </div>
              </div>
            ) : (
              <>
                <OrderTable
                  orders={filteredOrders}
                  isLoading={false}
                  onViewOrder={handleViewOrder}
                  onEditOrder={handleEditOrder}
                  onDeleteOrder={confirmDelete}
                  onUpdateOrderStatus={updateOrderStatus}
                  onUpdatePaymentStatus={updatePaymentStatus}
                  getStatusConfig={getStatusConfig}
                  getPaymentStatusConfig={getPaymentStatusConfig}
                  getPaymentMethodLabel={getPaymentMethodLabel}
                  getStatusActions={getStatusActions}
                  getPaymentActions={getPaymentActions}
                />
                
                {/* Paginação */}
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium">Linhas por página</p>
                    <Select
                      value={`${itemsPerPage}`}
                      onValueChange={handleItemsPerPageChange}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder={itemsPerPage} />
                      </SelectTrigger>
                      <SelectContent side="top">
                        {[10, 20, 30, 40, 50].map((pageSize) => (
                          <SelectItem key={pageSize} value={`${pageSize}`}>
                            {pageSize}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center space-x-6 lg:space-x-8">
                     <div className="flex items-center justify-center text-sm text-muted-foreground">
                       {totalCount === 0 ? (
                         "Nenhum resultado encontrado"
                       ) : (
                         `Mostrando ${Math.min((currentPage - 1) * itemsPerPage + 1, totalCount)} a ${Math.min(currentPage * itemsPerPage, totalCount)} de ${totalCount} resultados`
                       )}
                     </div>
                     
                     <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                       Página {currentPage} de {totalPages}
                     </div>
                    
                    <div className="flex items-center space-x-2">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious 
                              onClick={() => handlePageChange(currentPage - 1)}
                              className={!hasPreviousPage ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                          
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                            if (pageNumber <= totalPages) {
                              return (
                                <PaginationItem key={pageNumber}>
                                  <PaginationLink
                                    onClick={() => handlePageChange(pageNumber)}
                                    isActive={currentPage === pageNumber}
                                    className="cursor-pointer"
                                  >
                                    {pageNumber}
                                  </PaginationLink>
                                </PaginationItem>
                              );
                            }
                            return null;
                          })}
                          
                          <PaginationItem>
                            <PaginationNext 
                              onClick={() => handlePageChange(currentPage + 1)}
                              className={!hasNextPage ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog para visualizar o pedido */}
      <Dialog
        open={isViewDialogOpen}
        onOpenChange={(open) => {
          setIsViewDialogOpen(open);

          if (!open && searchParams.get("orderId")) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete("orderId");
            setSearchParams(nextParams);
          }
        }}
      >
        {renderOrderViewDialog()}
      </Dialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        {isCreateDialogOpen && !accessBlocked ? (
          <CreateOrderDialog
            onClose={() => setIsCreateDialogOpen(false)}
          />
        ) : null}
      </Dialog>

      {/* Dialog para editar o pedido */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        {selectedOrder && (
          <CreateOrderDialog
            onClose={() => setIsEditDialogOpen(false)}
            order={selectedOrder}
          />
        )}
      </Dialog>

      {/* Dialog para confirmar exclusão */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setOrderToDelete(null);
          }
          setDeleteDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão permanente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente o pedido #
              {orderToDelete?.number}? Esta ação não pode ser desfeita e todos
              os dados relacionados serão completamente removidos do banco de
              dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteOrder();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir Permanentemente"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



