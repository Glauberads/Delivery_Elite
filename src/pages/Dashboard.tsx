import React from 'react';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/dashboard/StatCard';
import { OrderStatusChart } from '@/components/dashboard/OrderStatusChart';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { RecentOrders } from '@/components/dashboard/RecentOrders';
import { MostSoldItems } from '@/components/dashboard/MostSoldItems';
import { ShoppingBag, Truck, CreditCard, TrendingUp } from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboardStats';

export default function Dashboard() {
  const { data: stats } = useDashboardStats();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total de Pedidos"
            value={stats?.totalOrders.value.toString() ?? "0"}
            description="7 dias"
            icon={ShoppingBag}
            trend={stats?.totalOrders.trend >= 0 ? "up" : "down"}
            trendValue={`${Math.abs(stats?.totalOrders.trend ?? 0).toFixed(1)}% do último período`}
          />
          <StatCard
            title="Entregas Realizadas"
            value={stats?.deliveredOrders.value.toString() ?? "0"}
            description="7 dias"
            icon={Truck}
            trend={stats?.deliveredOrders.trend >= 0 ? "up" : "down"}
            trendValue={`${Math.abs(stats?.deliveredOrders.trend ?? 0).toFixed(1)}% do último período`}
          />
          <StatCard
            title="Receita Total"
            value={formatCurrency(stats?.totalRevenue.value ?? 0)}
            description="7 dias"
            icon={CreditCard}
            trend={stats?.totalRevenue.trend >= 0 ? "up" : "down"}
            trendValue={`${Math.abs(stats?.totalRevenue.trend ?? 0).toFixed(1)}% do último período`}
          />
          <StatCard
            title="Ticket Médio"
            value={formatCurrency(stats?.averageTicket.value ?? 0)}
            description="7 dias"
            icon={TrendingUp}
            trend={stats?.averageTicket.trend >= 0 ? "up" : "down"}
            trendValue={`${Math.abs(stats?.averageTicket.trend ?? 0).toFixed(1)}% do último período`}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <OrderStatusChart />
          <RevenueChart />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <RecentOrders />
          <MostSoldItems />
        </div>
      </div>
    </div>
  );
}



