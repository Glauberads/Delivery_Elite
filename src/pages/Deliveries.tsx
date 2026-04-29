
import React from 'react';
import { Header } from '@/components/layout/Header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeliverySettings } from '@/components/deliveries/DeliverySettings';
import { ActiveDeliveries } from '@/components/deliveries/ActiveDeliveries';
import { CompletedDeliveries } from '@/components/deliveries/CompletedDeliveries';
import { StatCard } from '@/components/dashboard/StatCard';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarDays, CheckCircle, DollarSign, Users } from 'lucide-react';
import { startOfDay } from 'date-fns';

export default function Deliveries() {
  // Fetch deliveries for today
  const { data: todayDeliveries = 0 } = useQuery({
    queryKey: ['today-deliveries'],
    queryFn: async () => {
      const startOfToday = startOfDay(new Date()).toISOString();
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfToday)
        .not('delivery_status', 'eq', null);
      
      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch completed deliveries
  const { data: completedDeliveries = 0 } = useQuery({
    queryKey: ['completed-deliveries-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('delivery_status', 'completed');
      
      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch total delivery fees
  const { data: totalFees = 0 } = useQuery({
    queryKey: ['total-delivery-fees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('delivery_fee')
        .not('delivery_fee', 'is', null);
      
      if (error) throw error;
      return data.reduce((sum, order) => sum + (order.delivery_fee || 0), 0);
    },
  });

  // Fetch active drivers
  const { data: activeDrivers = 0 } = useQuery({
    queryKey: ['active-drivers-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('drivers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Ativo');
      
      if (error) throw error;
      return count || 0;
    },
  });

  return (
    <div className="flex flex-col h-full">
      <Header title="Movimentação" />
      
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Entregas Hoje"
            value={todayDeliveries.toString()}
            icon={CalendarDays}
          />
          <StatCard
            title="Entregas Concluídas"
            value={completedDeliveries.toString()}
            icon={CheckCircle}
          />
          <StatCard
            title="Total em Taxas"
            value={new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(totalFees)}
            icon={DollarSign}
          />
          <StatCard
            title="Entregadores Ativos"
            value={activeDrivers.toString()}
            icon={Users}
          />
        </div>
        
        <Tabs defaultValue="active" className="w-full space-y-4">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="active">Em Andamento</TabsTrigger>
            <TabsTrigger value="completed">Finalizadas</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>
          
          <TabsContent value="active">
            <ActiveDeliveries />
          </TabsContent>
          
          <TabsContent value="completed">
            <CompletedDeliveries />
          </TabsContent>
          
          <TabsContent value="settings">
            <DeliverySettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}



