
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChartIcon, CircleHelp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Tooltip as TooltipUI } from "@/components/ui/tooltip";
import { TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays } from 'date-fns';

export function OrderStatusChart() {
  const { data: orders } = useQuery({
    queryKey: ['orders-by-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('status')
        .gte('created_at', subDays(new Date(), 7).toISOString());

      if (error) throw error;

      const statusCounts: Record<string, number> = {};
      data.forEach(order => {
        statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
      });

      return [
        { status: 'Pendente', value: statusCounts['pending'] || 0, color: '#FF9800' },
        { status: 'Em preparo', value: statusCounts['preparing'] || 0, color: '#2196F3' },
        { status: 'Pronto', value: statusCounts['ready'] || 0, color: '#4CAF50' },
        { status: 'Em entrega', value: statusCounts['out_for_delivery'] || 0, color: '#9C27B0' },
        { status: 'Entregue', value: statusCounts['delivered'] || 0, color: '#4CAF50' },
        { status: 'Cancelado', value: statusCounts['canceled'] || 0, color: '#F44336' },
      ];
    }
  });

  // Use empty array as fallback when orders data is undefined
  const chartData = orders || [];

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center space-x-2">
          <CardTitle className="text-sm font-medium">Status dos Pedidos</CardTitle>
          <TooltipProvider>
            <TooltipUI>
              <TooltipTrigger asChild>
                <CircleHelp className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Distribuição de pedidos por status nos últimos 7 dias</p>
              </TooltipContent>
            </TooltipUI>
          </TooltipProvider>
        </div>
        <BarChartIcon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="status" 
                tick={{ fontSize: 12 }} 
                tickLine={false} 
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }} 
                tickLine={false} 
                axisLine={false} 
                width={30}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Bar 
                dataKey="value" 
                name="Quantidade"
                radius={[4, 4, 0, 0]}
                barSize={30}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}



