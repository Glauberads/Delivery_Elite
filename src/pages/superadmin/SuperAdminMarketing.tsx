import { Activity, MessageCircle, MousePointerClick, Users } from "lucide-react";
import { useMarketingDashboard } from "@/hooks/useMarketingDashboard";
import { MetricCard } from "@/components/superadmin/marketing/MetricCard";
import { TrafficSourcesChart } from "@/components/superadmin/marketing/TrafficSourcesChart";
import { LeadsTable } from "@/components/superadmin/marketing/LeadsTable";
import { RealtimeActivity } from "@/components/superadmin/marketing/RealtimeActivity";

export default function SuperAdminMarketing() {
  const { leads, events, onlineVisitors, loading } = useMarketingDashboard();

  // Calculate Metrics
  const today = new Date().toISOString().split("T")[0];

  const pageViewsToday = events.filter((e) => e.event_type === "PageView" && e.created_at.startsWith(today)).length;
  const ctaClicksToday = events.filter((e) => e.event_type === "Click" && e.created_at.startsWith(today)).length;
  const leadsToday = leads.filter((l) => l.created_at.startsWith(today)).length;

  const conversionRate = pageViewsToday > 0 ? ((leadsToday / pageViewsToday) * 100).toFixed(1) + "%" : "0%";

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Marketing & Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe a performance da sua landing page pública e a conversão de leads em tempo real.
          </p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-orange-500">
            <span className="w-4 h-4 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
            Sincronizando...
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard title="Visitantes Online" value={onlineVisitors} icon={Activity} isLive={true} />
        <MetricCard title="PageViews (Hoje)" value={pageViewsToday} icon={Users} />
        <MetricCard title="Cliques em CTA (Hoje)" value={ctaClicksToday} icon={MousePointerClick} />
        <MetricCard title="Leads (Hoje)" value={leadsToday} icon={MessageCircle} />
        <MetricCard title="Conversão" value={conversionRate} icon={Activity} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-foreground mb-6">Origem do Tráfego (UTM Source)</h3>
            <TrafficSourcesChart events={events} />
          </div>

          <div>
            <h3 className="font-bold text-foreground mb-4">Leads Capturados</h3>
            <LeadsTable leads={leads} />
          </div>
        </div>

        <div className="lg:col-span-1">
          <RealtimeActivity events={events} />
        </div>
      </div>
    </div>
  );
}
