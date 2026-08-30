import React, { useEffect, useState, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Navigation, AlertTriangle, ExternalLink, MapPin, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Custom icon for Motoboy
const driverIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3204/3204369.png", // Helmet/Moto icon
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -38],
});

interface DriverLocation {
  driverId: string;
  driverName: string;
  lat: number;
  lng: number;
  timestamp: string;
}

export default function Radar() {
  const { user } = useAuth();
  const [locations, setLocations] = useState<Record<string, DriverLocation>>({});
  const channelRef = useRef<any>(null);

  // Verificando se o tenant tem acesso ao radar
  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant-radar-access", user?.tenantId],
    enabled: !!user?.tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("driver_tracking_enabled")
        .eq("id", user?.tenantId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!user?.tenantId || !tenant?.driver_tracking_enabled) return;

    // Connect to Supabase Realtime Channel
    const channel = supabase.channel(`radar:${user.tenantId}`, {
      config: {
        broadcast: { ack: false },
      },
    });

    channel
      .on("broadcast", { event: "location" }, ({ payload }) => {
        const data = payload as DriverLocation;
        setLocations((prev) => ({
          ...prev,
          [data.driverId]: data,
        }));
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [user?.tenantId, tenant?.driver_tracking_enabled]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Radar de Entregas" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Carregando permissões...
        </div>
      </div>
    );
  }

  if (!tenant?.driver_tracking_enabled) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <Header title="Radar de Entregas" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 text-center relative overflow-hidden border border-slate-100">
            {/* Efeito de brilho de fundo */}
            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-blue-50 to-transparent -z-10" />

            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner ring-8 ring-blue-50">
              <MapPin className="w-10 h-10" />
            </div>
            
            <h2 className="text-2xl font-extrabold text-slate-800 mb-3 tracking-tight">
              Onde estão seus motoboys <span className="text-blue-600">agora?</span>
            </h2>
            
            <p className="text-slate-500 mb-6 text-sm leading-relaxed">
              Desbloqueie o <strong className="text-slate-700">Radar em Tempo Real</strong> e tenha o controle absoluto da sua logística. Sem achismos, apenas precisão.
            </p>
            
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-left space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <p className="text-sm text-slate-700"><strong className="text-slate-900 block">Segurança Total</strong> Acompanhe todas as rotas ao vivo no mapa e proteja suas entregas.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <p className="text-sm text-slate-700"><strong className="text-slate-900 block">Fim das Reclamações</strong> Saiba exatamente responder aos clientes sem precisar ligar pro motoboy.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <p className="text-sm text-slate-700"><strong className="text-slate-900 block">Agilidade Extra</strong> Descubra quais motoristas estão parados ou fazendo caminhos longos.</p>
              </div>
            </div>

            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 h-14 text-base font-bold rounded-xl transition-all hover:scale-[1.02]"
              onClick={() => window.open("https://wa.me/5522981711078?text=gostaria%20de%20habilitar%20o%20radar%20pra%20aacompnhar%20meus%20moto%20boys", "_blank")}
            >
              Quero Habilitar o Radar Agora
            </Button>
            
            <p className="text-xs text-slate-400 mt-4 font-medium">
              Fale diretamente com nosso suporte comercial no WhatsApp
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate bounds to fit all drivers on map
  const activeDrivers = Object.values(locations);
  const centerLat = activeDrivers.length > 0 ? activeDrivers[0].lat : -23.55052; // Default to São Paulo if no drivers
  const centerLng = activeDrivers.length > 0 ? activeDrivers[0].lng : -46.633309;

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))]">
      <Header title="Radar de Entregas" />
      
      <div className="flex-1 p-4 md:p-6 pb-20 md:pb-6 relative z-0">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden h-full border border-border flex flex-col">
          
          <div className="p-4 border-b border-border bg-slate-50 flex justify-between items-center">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <Navigation className="w-4 h-4 text-orange-500" />
                Mapa ao Vivo
              </h2>
              <p className="text-sm text-muted-foreground">
                {activeDrivers.length} {activeDrivers.length === 1 ? 'entregador ativo' : 'entregadores ativos'}
              </p>
            </div>
          </div>

          <div className="flex-1 bg-slate-100 relative">
            <MapContainer
              center={[centerLat, centerLng]}
              zoom={13}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {activeDrivers.map((driver) => (
                <Marker 
                  key={driver.driverId} 
                  position={[driver.lat, driver.lng]} 
                  icon={driverIcon}
                >
                  <Popup>
                    <div className="font-semibold">{driver.driverName}</div>
                    <div className="text-xs text-slate-500">
                      Visto às {new Date(driver.timestamp).toLocaleTimeString()}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

        </div>
      </div>
    </div>
  );
}
