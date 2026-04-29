
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChartIcon, CircleHelp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Tooltip as TooltipUI } from "@/components/ui/tooltip";
import { TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function RevenueChart() {
  const { data } = useQuery({
    queryKey: ['daily-revenue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('created_at, total')
        .gte('created_at', subDays(new Date(), 7).toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      const dailyRevenue: Record<string, number> = {};
      
      data.forEach(order => {
        const day = format(parseISO(order.created_at), 'EEE', { locale: ptBR });
        dailyRevenue[day] = (dailyRevenue[day] || 0) + Number(order.total);
      });

      return Object.entries(dailyRevenue).map(([day, revenue]) => ({
        day: day.charAt(0).toUpperCase() + day.slice(1),
        revenue
      }));
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center space-x-2">
          <CardTitle className="text-sm font-medium">Receita da Semana</CardTitle>
          <TooltipProvider>
            <TooltipUI>
              <TooltipTrigger asChild>
                <CircleHelp className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Receita total por dia da semana</p>
              </TooltipContent>
            </TooltipUI>
          </TooltipProvider>
        </div>
        <LineChartIcon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 12 }} 
                tickLine={false} 
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }} 
                tickLine={false} 
                axisLine={false} 
                width={50}
                tickFormatter={(value) => `R$ ${value}`}
              />
              <Tooltip 
                formatter={(value) => [formatCurrency(Number(value)), "Receita"]}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#FF9800" 
                strokeWidth={2}
                dot={{ fill: '#FF9800', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#FF9800', stroke: 'white', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}



