import React from 'react';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/dashboard/StatCard';
import { OrderStatusChart } from '@/components/dashboard/OrderStatusChart';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { RecentOrders } from '@/components/dashboard/RecentOrders';
import { MostSoldItems } from '@/components/dashboard/MostSoldItems';
import { ShoppingBag, Truck, CreditCard, TrendingUp, MapPin, Megaphone, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
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

        <div className="grid gap-4 md:grid-cols-2">
          <Link to="/radar" className="group relative overflow-hidden rounded-xl border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent p-6 hover:border-orange-500/30 transition-all hover:shadow-lg hover:shadow-orange-500/5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 rounded-lg text-orange-500">
                <MapPin className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-orange-500 dark:text-orange-400">
                  Novo: Radar de Entregas
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Acompanhe seus motoboys em tempo real e elimine reclamações.</p>
              </div>
              <ArrowRight className="h-5 w-5 text-orange-500/50 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
            </div>
          </Link>

          <Link to="/admin/marketing" className="group relative overflow-hidden rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent p-6 hover:border-blue-500/30 transition-all hover:shadow-lg hover:shadow-blue-500/5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
                <Megaphone className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-blue-500 dark:text-blue-400">
                  Novo: Módulo de Marketing
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Integre Pixel e Analytics para recuperar clientes com tráfego pago.</p>
              </div>
              <ArrowRight className="h-5 w-5 text-blue-500/50 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </div>
          </Link>
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



