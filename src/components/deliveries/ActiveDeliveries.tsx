
import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Check, Truck, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { usePaginatedDeliveries, useDeliveryData } from '@/hooks/usePaginatedDeliveries';

export function ActiveDeliveries() {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  // Hook para dados paginados
  const {
    deliveries: activeDeliveries,
    totalCount,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    isLoading
  } = usePaginatedDeliveries({
    page: currentPage,
    limit: itemsPerPage,
    status: 'active',
    searchQuery
  });

  // Hook para dados auxiliares
  const { availableDrivers, regions } = useDeliveryData();

  // Reset da página quando a busca muda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const assignDriver = async (orderId: string, driverId: string) => {
    try {
      // Atualizar status do pedido
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          delivery_driver_id: driverId,
          delivery_status: 'in_progress',
          delivery_started_at: new Date().toISOString()
        })
        .eq('id', orderId);
      
      if (orderError) throw orderError;

      // Atualizar status do entregador
      const { error: driverError } = await supabase
        .from('drivers')
        .update({ status: 'Em Entrega' })
        .eq('id', driverId);
      
      if (driverError) throw driverError;

      toast.success('Entregador atribuído com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['deliveries-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries-count'] });
      queryClient.invalidateQueries({ queryKey: ['available-drivers'] });
      
    } catch (error: any) {
      console.error('Erro ao atribuir entregador:', error);
      toast.error('Erro ao atribuir entregador: ' + error.message);
    }
  };

  const handleConfirmDelivery = (delivery: any) => {
    setSelectedDelivery(delivery);
    setConfirmDialogOpen(true);
  };

  const confirmDelivery = async () => {
    if (!selectedDelivery) return;
    
    try {
      // Atualizar status do pedido
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          delivery_status: 'completed',
          delivery_completed_at: new Date().toISOString(),
          status: 'delivered' // Atualiza também o status geral do pedido
        })
        .eq('id', selectedDelivery.id);
      
      if (orderError) throw orderError;

      // Atualizar status do entregador
      const { error: driverError } = await supabase
        .from('drivers')
        .update({ status: 'Ativo' })
        .eq('id', selectedDelivery.delivery_driver_id);
      
      if (driverError) throw driverError;

      toast.success('Entrega concluída com sucesso!');
      setConfirmDialogOpen(false);
      
      // Atualizar os dados em cache
      queryClient.invalidateQueries({ queryKey: ['deliveries-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries-count'] });
      queryClient.invalidateQueries({ queryKey: ['available-drivers'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      
    } catch (error: any) {
      console.error('Erro ao confirmar entrega:', error);
      toast.error('Erro ao confirmar entrega: ' + error.message);
    }
  };

  const handleSelectRegion = async (orderId: string, regionId: string) => {
    try {
      // Buscar taxa da região selecionada
      const region = regions.find(r => r.id === regionId);
      if (!region) throw new Error('Região não encontrada');

      // Atualizar o pedido com a região e taxa de entrega
      const { error } = await supabase
        .from('orders')
        .update({
          delivery_region_id: regionId,
          delivery_fee: region.fee,
          delivery_status: 'pending'
        })
        .eq('id', orderId);
      
      if (error) throw error;

      toast.success('Região atribuída com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['deliveries-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries-count'] });
      
    } catch (error: any) {
      console.error('Erro ao selecionar região:', error);
      toast.error('Erro ao selecionar região: ' + error.message);
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case 'pending': return 'Aguardando';
      case 'in_progress': return 'Em Entrega';
      default: return status;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Em Andamento</CardTitle>
        <div className="flex items-center space-x-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, pedido ou endereço..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead>Região</TableHead>
              <TableHead>Entregador</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : activeDeliveries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                  {searchQuery ? 'Nenhuma entrega encontrada para a busca realizada' : 'Não há entregas em andamento'}
                </TableCell>
              </TableRow>
            ) : (
              activeDeliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell>{delivery.number}</TableCell>
                  <TableCell>{delivery.customer_name}</TableCell>
                  <TableCell>{delivery.delivery_address}</TableCell>
                  <TableCell>
                    {delivery.region ? (
                      <span>{delivery.region.name}</span>
                    ) : (
                      <Select 
                        onValueChange={(value) => handleSelectRegion(delivery.id, value)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Selecionar região" />
                        </SelectTrigger>
                        <SelectContent>
                          {regions.map((region) => (
                            <SelectItem key={region.id} value={region.id}>
                              {region.name} - {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL'
                              }).format(region.fee)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {delivery.driver ? (
                      <span>{delivery.driver.name}</span>
                    ) : delivery.region ? (
                      <Select 
                        onValueChange={(value) => assignDriver(delivery.id, value)}
                        disabled={!delivery.region}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Selecionar entregador" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableDrivers.map((driver) => (
                            <SelectItem key={driver.id} value={driver.id}>
                              {driver.name} ({driver.vehicle})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-muted-foreground text-sm">Selecione uma região primeiro</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={delivery.delivery_status === 'in_progress' ? 'default' : 'outline'}>
                      {formatStatus(delivery.delivery_status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {delivery.delivery_status === 'in_progress' && (
                      <Button 
                        onClick={() => handleConfirmDelivery(delivery)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Confirmar Entrega
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        
        {/* Paginação */}
        {totalCount > 0 && (
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
                        className={!hasPreviousPage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
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
                        className={!hasNextPage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar entrega</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja confirmar esta entrega como concluída?
              {selectedDelivery && (
                <span className="mt-2 text-foreground block">
                  <span className="block"><strong>Pedido:</strong> #{selectedDelivery.number}</span>
                  <span className="block"><strong>Cliente:</strong> {selectedDelivery.customer_name}</span>
                  <span className="block"><strong>Entregador:</strong> {selectedDelivery.driver?.name}</span>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelivery} className="bg-green-600 hover:bg-green-700">
              <Check className="mr-2 h-4 w-4" />
              Concluir Entrega
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}



