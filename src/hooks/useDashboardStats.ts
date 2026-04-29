
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';

export function useDashboardStats() {
  const sevenDaysAgo = subDays(new Date(), 7);
  const previousSevenDaysAgo = subDays(sevenDaysAgo, 7);

  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      // Get orders from last 7 days
      const { data: currentOrders, error: currentError } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (currentError) throw currentError;

      // Get orders from previous 7 days for comparison
      const { data: previousOrders, error: previousError } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', previousSevenDaysAgo.toISOString())
        .lt('created_at', sevenDaysAgo.toISOString());

      if (previousError) throw previousError;

      // Calculate current period stats
      const totalOrders = currentOrders.length;
      const deliveredOrders = currentOrders.filter(order => order.status === 'delivered').length;
      const totalRevenue = currentOrders.reduce((sum, order) => sum + Number(order.total), 0);
      const averageTicket = totalOrders ? totalRevenue / totalOrders : 0;

      // Calculate previous period stats for trend comparison
      const previousTotalOrders = previousOrders.length;
      const previousDeliveredOrders = previousOrders.filter(order => order.status === 'delivered').length;
      const previousTotalRevenue = previousOrders.reduce((sum, order) => sum + Number(order.total), 0);
      const previousAverageTicket = previousTotalOrders ? previousTotalRevenue / previousTotalOrders : 0;

      // Calculate trends (percentage change)
      const calculateTrend = (current: number, previous: number) => {
        if (previous === 0) return 0;
        return ((current - previous) / previous) * 100;
      };

      return {
        totalOrders: {
          value: totalOrders,
          trend: calculateTrend(totalOrders, previousTotalOrders)
        },
        deliveredOrders: {
          value: deliveredOrders,
          trend: calculateTrend(deliveredOrders, previousDeliveredOrders)
        },
        totalRevenue: {
          value: totalRevenue,
          trend: calculateTrend(totalRevenue, previousTotalRevenue)
        },
        averageTicket: {
          value: averageTicket,
          trend: calculateTrend(averageTicket, previousAverageTicket)
        }
      };
    }
  });
}



