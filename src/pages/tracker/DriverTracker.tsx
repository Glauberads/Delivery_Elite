import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Navigation, SignalHigh, SignalZero, User, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DriverTracker() {
  const { tenantId, driverId } = useParams<{ tenantId: string; driverId: string }>();
  
  const [driverName, setDriverName] = useState<string>("");
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string>("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const watchIdRef = useRef<number | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    // Fetch driver info
    async function fetchDriver() {
      if (!tenantId || !driverId) {
        setError("Link de rastreamento inválido.");
        return;
      }
      
      const { data, error: dbError } = await supabase
        .from("drivers")
        .select("name, status")
        .eq("id", driverId)
        .eq("tenant_id", tenantId)
        .single();
        
      if (dbError || !data) {
        setError("Motoboy não encontrado neste restaurante.");
        return;
      }
      
      setDriverName(data.name);
    }
    
    fetchDriver();
    
    return () => {
      stopTracking();
    };
  }, [tenantId, driverId]);

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError("Seu navegador não suporta geolocalização.");
      return;
    }
    
    setError("");

    // Conectar ao Supabase Realtime
    const channel = supabase.channel(`radar:${tenantId}`, {
      config: {
        broadcast: { self: false },
      },
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log("Conectado ao Radar!");
      }
    });

    channelRef.current = channel;

    // Iniciar GPS
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lng: longitude });
        setIsTracking(true);
        
        // Emitir posição
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'location',
            payload: {
              driverId,
              driverName,
              lat: latitude,
              lng: longitude,
              timestamp: new Date().toISOString(),
            },
          });
        }
      },
      (err) => {
        console.error("Erro GPS:", err);
        setError("Não foi possível acessar seu GPS. Verifique as permissões do seu celular.");
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );

    watchIdRef.current = id;
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    setIsTracking(false);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-sm text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <SignalZero className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Erro no Rastreamento</h2>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-lg text-center space-y-8">
        
        <div className="space-y-2">
          <div className="w-20 h-20 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Olá, {driverName || "Motoboy"}</h1>
          <p className="text-slate-500">App de Rastreamento de Entregas</p>
        </div>

        {isTracking ? (
          <div className="space-y-6">
            <div className="relative w-32 h-32 mx-auto">
              <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-20"></div>
              <div className="relative w-full h-full bg-green-50 rounded-full flex items-center justify-center border-4 border-green-500">
                <Navigation className="w-12 h-12 text-green-500" />
              </div>
            </div>
            
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-green-600 flex items-center justify-center gap-2">
                <SignalHigh className="w-6 h-6" />
                Rastreamento Ativo
              </h2>
              <p className="text-sm text-slate-500 px-4">
                Mantenha esta tela aberta ou minimizada enquanto estiver fazendo as entregas.
              </p>
            </div>

            {location && (
              <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-400 font-mono flex items-center justify-center gap-2">
                <MapPin className="w-3 h-3" />
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </div>
            )}

            <Button 
              variant="destructive" 
              className="w-full rounded-xl h-14 text-base font-semibold"
              onClick={stopTracking}
            >
              <PowerOff className="w-5 h-5 mr-2" />
              Parar Rastreamento
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="w-32 h-32 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
              <Navigation className="w-12 h-12 text-slate-300" />
            </div>
            
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-700">Pronto para iniciar?</h2>
              <p className="text-sm text-slate-500">
                Toque no botão abaixo para começar a compartilhar sua localização com o restaurante.
              </p>
            </div>

            <Button 
              className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-14 text-base font-semibold"
              onClick={startTracking}
            >
              <Navigation className="w-5 h-5 mr-2" />
              Iniciar Expediente
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
