
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Check, Search } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { usePaginatedDeliveries } from '@/hooks/usePaginatedDeliveries';

export function CompletedDeliveries() {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');

  // Hook para dados paginados
  const {
    deliveries: completedDeliveries,
    totalCount,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    isLoading
  } = usePaginatedDeliveries({
    page: currentPage,
    limit: itemsPerPage,
    status: 'completed',
    searchQuery
  });

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Finalizadas</CardTitle>
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
              <TableHead>Finalizada em</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : completedDeliveries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                  {searchQuery ? 'Nenhuma entrega encontrada para a busca realizada' : 'Nenhuma entrega finalizada encontrada'}
                </TableCell>
              </TableRow>
            ) : (
              completedDeliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell>{delivery.number}</TableCell>
                  <TableCell>{delivery.customer_name}</TableCell>
                  <TableCell>{delivery.delivery_address}</TableCell>
                  <TableCell>{delivery.region?.name}</TableCell>
                  <TableCell>{delivery.driver?.name}</TableCell>
                  <TableCell>
                    {delivery.delivery_completed_at && new Date(delivery.delivery_completed_at).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="success" className="bg-green-600">
                      <Check className="mr-1 h-3 w-3" />
                      Concluída
                    </Badge>
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
    </Card>
  );
}



