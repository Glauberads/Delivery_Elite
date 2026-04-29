import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UsePaginatedDeliveriesParams {
  page: number;
  limit: number;
  status: 'active' | 'completed';
  searchQuery?: string;
}

interface PaginatedDeliveriesResult {
  deliveries: any[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isLoading: boolean;
  error: any;
}

export function usePaginatedDeliveries({
  page,
  limit,
  status,
  searchQuery = ''
}: UsePaginatedDeliveriesParams): PaginatedDeliveriesResult {
  const offset = (page - 1) * limit;

  // Query para contar o total de registros
  const { data: totalCount = 0 } = useQuery({
    queryKey: ['deliveries-count', status, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      // Filtrar por status de entrega
      if (status === 'active') {
        query = query.in('delivery_status', ['pending', 'in_progress']);
      } else {
        query = query.eq('delivery_status', 'completed');
      }

      // Aplicar filtro de busca se fornecido
      if (searchQuery.trim()) {
        query = query.or(`customer_name.ilike.%${searchQuery}%,number.ilike.%${searchQuery}%,delivery_address.ilike.%${searchQuery}%`);
      }

      const { count, error } = await query;
      
      if (error) throw error;
      return count || 0;
    },
  });

  // Query para buscar os dados paginados
  const { data: deliveries = [], isLoading, error } = useQuery({
    queryKey: ['deliveries-paginated', page, limit, status, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          driver:delivery_driver_id(id, name, status, vehicle),
          region:delivery_region_id(name, fee)
        `);

      // Filtrar por status de entrega
      if (status === 'active') {
        query = query.in('delivery_status', ['pending', 'in_progress']);
      } else {
        query = query.eq('delivery_status', 'completed');
      }

      // Aplicar filtro de busca se fornecido
      if (searchQuery.trim()) {
        query = query.or(`customer_name.ilike.%${searchQuery}%,number.ilike.%${searchQuery}%,delivery_address.ilike.%${searchQuery}%`);
      }

      // Ordenação
      if (status === 'active') {
        query = query.order('created_at', { ascending: false });
      } else {
        query = query.order('delivery_completed_at', { ascending: false });
      }

      // Paginação
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
  });

  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  return {
    deliveries,
    totalCount,
    totalPages,
    currentPage: page,
    hasNextPage,
    hasPreviousPage,
    isLoading,
    error
  };
}

// Hook para buscar dados auxiliares (motoristas e regiões)
export function useDeliveryData() {
  const { data: availableDrivers = [] } = useQuery({
    queryKey: ['available-drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .not('status', 'eq', 'Em Entrega')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: regions = [] } = useQuery({
    queryKey: ['delivery-regions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_regions')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  return {
    availableDrivers,
    regions
  };
}


