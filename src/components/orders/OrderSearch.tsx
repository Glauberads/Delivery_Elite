
import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';

interface OrderSearchProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}

export function OrderSearch({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: OrderSearchProps) {
  return (
    <div className="flex flex-1 gap-2 flex-col sm:flex-row w-full sm:w-auto">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar pedidos..."
          className="pl-8 w-full"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <SelectValue placeholder="Filtrar por status" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os Status</SelectItem>
          <SelectItem value="pending">Pendentes</SelectItem>
          <SelectItem value="confirmed">Confirmados</SelectItem>
          <SelectItem value="preparing">Em Preparo</SelectItem>
          <SelectItem value="ready">Prontos</SelectItem>
          <SelectItem value="out_for_delivery">Em Entrega</SelectItem>
          <SelectItem value="delivered">Entregues</SelectItem>
          <SelectItem value="canceled">Cancelados</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}



