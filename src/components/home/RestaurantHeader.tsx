import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Bike } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicTenant } from "@/hooks/usePublicTenant";
import { ThemeToggle } from "@/components/ui/theme-toggle";

// Interface para horários de funcionamento
interface BusinessHour {
  id: string;
  day_of_week: string;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

// Interface para tempos de entrega
interface DeliveryTime {
  id: string;
  min_time: number;
  max_time: number;
  day_of_week: string | null;
}

export function RestaurantHeader() {
  const { tenantId, restaurant, isLoading: isLoadingTenant } = usePublicTenant();
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
  const [deliveryTimes, setDeliveryTimes] = useState<DeliveryTime[]>([]);
  const [error, setError] = useState(false);
  const [isLoadingBusinessHours, setIsLoadingBusinessHours] = useState(false);
  const [isLoadingDeliveryTimes, setIsLoadingDeliveryTimes] = useState(false);

  // Efeito para carregar horários de funcionamento
  useEffect(() => {
    const fetchBusinessHours = async () => {
      if (!tenantId) {
        setBusinessHours([]);
        return;
      }

      setIsLoadingBusinessHours(true);

      try {
        const { data, error } = await supabase
          .from("business_hours")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("id");

        if (error) {
          throw error;
        }

        if (data) {
          setBusinessHours(data);
        }
      } catch (error) {
        console.error("Erro ao carregar horários de funcionamento:", error);
      } finally {
        setIsLoadingBusinessHours(false);
      }
    };

    fetchBusinessHours();
  }, [tenantId]);

  // Efeito para carregar tempos de entrega
  useEffect(() => {
    const fetchDeliveryTimes = async () => {
      if (!tenantId) {
        setDeliveryTimes([]);
        return;
      }

      setIsLoadingDeliveryTimes(true);

      try {
        const { data, error } = await supabase
          .from("delivery_times")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("id");

        if (error) {
          throw error;
        }

        if (data) {
          setDeliveryTimes(data);
        }
      } catch (error) {
        console.error("Erro ao carregar tempos de entrega:", error);
      } finally {
        setIsLoadingDeliveryTimes(false);
      }
    };

    fetchDeliveryTimes();
  }, [tenantId]);

  useEffect(() => {
    setError(Boolean(tenantId === null && !isLoadingTenant));
  }, [tenantId, isLoadingTenant]);

  // Format time from HH:MM:SS to HH:MM
  const formatTime = (timeString: string | null) => {
    if (!timeString) return "";
    return timeString.substring(0, 5);
  };

  // Obter o dia da semana atual em português
  const getCurrentDayOfWeek = () => {
    const daysInPortuguese = [
      "Domingo",
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
    ];

    const today = new Date();
    return daysInPortuguese[today.getDay()];
  };

  // Função para obter tempo de entrega atual baseado no dia da semana
  const getCurrentDeliveryTime = () => {
    if (!deliveryTimes || deliveryTimes.length === 0) {
      // Valor padrão caso não tenha dados
      return { min: 30, max: 50 };
    }

    const currentDayOfWeek = getCurrentDayOfWeek();

    // Primeiro verifica se há um tempo específico para o dia atual
    const todayDeliveryTime = deliveryTimes.find(
      (time) => time.day_of_week === currentDayOfWeek
    );

    if (todayDeliveryTime) {
      return {
        min: todayDeliveryTime.min_time,
        max: todayDeliveryTime.max_time,
      };
    }

    // Se não encontrar específico para o dia, usa o tempo padrão (sem day_of_week)
    const defaultDeliveryTime = deliveryTimes.find(
      (time) => time.day_of_week === null || time.day_of_week === ""
    );

    if (defaultDeliveryTime) {
      return {
        min: defaultDeliveryTime.min_time,
        max: defaultDeliveryTime.max_time,
      };
    }

    // Se não encontrar nenhum, usa o primeiro da lista
    return {
      min: deliveryTimes[0].min_time,
      max: deliveryTimes[0].max_time,
    };
  };

  // Check if restaurant is currently open based on business_hours
  const isOpenNow = () => {
    if (!businessHours || businessHours.length === 0) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    const currentDayOfWeek = getCurrentDayOfWeek();

    // Encontrar o registro para hoje
    const todayBusinessHour = businessHours.find(
      (hour) => hour.day_of_week === currentDayOfWeek
    );

    if (!todayBusinessHour) return false;
    if (todayBusinessHour.is_closed) return false;

    return (
      currentTime >= formatTime(todayBusinessHour.open_time) &&
      currentTime <= formatTime(todayBusinessHour.close_time)
    );
  };

  // Get today's open and close times
  const getTodayHours = () => {
    if (!businessHours || businessHours.length === 0) return null;

    const currentDayOfWeek = getCurrentDayOfWeek();

    return businessHours.find((hour) => hour.day_of_week === currentDayOfWeek);
  };

  const todayHours = getTodayHours();

  return (
    <div className="relative">
      {/* Banner do restaurante */}
      <div className="relative h-48 overflow-hidden bg-muted">
        {isLoadingTenant ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <>
            <img
              src={
                restaurant?.banner_url ||
                "/lovable-uploads/8a37f084-d95b-43c3-95c1-387e15d14916.png"
              }
              alt="Comidas do restaurante"
              className="w-full h-full object-cover"
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                e.currentTarget.src =
                  "/lovable-uploads/8a37f084-d95b-43c3-95c1-387e15d14916.png";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          </>
        )}
      </div>

      {/* Informações do restaurante */}
      <div className="container max-w-5xl mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-4 -mt-16 md:-mt-12 mb-4">
          {/* Logo */}
          <div className="flex-shrink-0 z-10">
            {isLoadingTenant ? (
              <Skeleton className="w-24 h-24 rounded-xl" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border-4 border-background bg-delivery-100 text-delivery-700 shadow-md dark:bg-delivery-900/50 dark:text-delivery-200">
                {restaurant?.logo_url ? (
                  <img
                    src={restaurant.logo_url}
                    alt={restaurant?.name || "Logo do restaurante"}
                    className="w-full h-full object-cover rounded-lg"
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                      const target = e.currentTarget;
                      // Default to icon if logo fails to load
                      target.style.display = "none";
                      const parent = target.parentElement;
                      if (parent) {
                        const svg = document.createElementNS(
                          "http://www.w3.org/2000/svg",
                          "svg"
                        );
                        svg.setAttribute("viewBox", "0 0 24 24");
                        svg.setAttribute("class", "h-12 w-12");
                        svg.setAttribute("fill", "none");
                        svg.setAttribute("stroke", "currentColor");
                        svg.setAttribute("stroke-width", "2");
                        svg.setAttribute("stroke-linecap", "round");
                        svg.setAttribute("stroke-linejoin", "round");

                        const path1 = document.createElementNS(
                          "http://www.w3.org/2000/svg",
                          "path"
                        );
                        path1.setAttribute("d", "M7 11V7a5 5 0 0 1 10 0v4");

                        const path2 = document.createElementNS(
                          "http://www.w3.org/2000/svg",
                          "path"
                        );
                        path2.setAttribute(
                          "d",
                          "M4 11h16a1 1 0 0 1 1 1v.5c0 1.5-1.1 2.77-2.5 3l-.5.1"
                        );

                        const path3 = document.createElementNS(
                          "http://www.w3.org/2000/svg",
                          "path"
                        );
                        path3.setAttribute("d", "M6 18h12");

                        const path4 = document.createElementNS(
                          "http://www.w3.org/2000/svg",
                          "path"
                        );
                        path4.setAttribute("d", "M6 15h12");

                        svg.appendChild(path1);
                        svg.appendChild(path2);
                        svg.appendChild(path3);
                        svg.appendChild(path4);

                        parent.appendChild(svg);
                      }
                    }}
                  />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-12 w-12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    <path d="M4 11h16a1 1 0 0 1 1 1v.5c0 1.5-1.1 2.77-2.5 3l-.5.1" />
                    <path d="M6 18h12" />
                    <path d="M6 15h12" />
                  </svg>
                )}
              </div>
            )}
          </div>

          {/* Detalhes */}
          <div className="z-10 flex-1 rounded-lg border border-border bg-card/95 p-4 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                {isLoadingTenant ? (
                  <>
                    <Skeleton className="h-8 w-40 mb-2" />
                    <Skeleton className="h-4 w-60" />
                  </>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold">
                      {restaurant?.name || "Loja não encontrada"}
                    </h1>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>
                        {restaurant?.address || "Endereço não disponível"}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 mt-2 md:mt-0">
                {isLoadingTenant ? (
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="flex items-center gap-1"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        <span>{`${getCurrentDeliveryTime().min}-${
                          getCurrentDeliveryTime().max
                        } minutos`}</span>
                      </Badge>
                      <Badge
                        variant="outline"
                        className="flex items-center gap-1"
                      >
                        <span className="flex items-center gap-1">
                          <Bike className="h-4 w-4 text-delivery-500" />
                          {restaurant?.delivery_fee && restaurant.delivery_fee > 0
                            ? `R$ ${restaurant.delivery_fee
                                .toFixed(2)
                                .replace(".", ",")}`
                            : "Grátis"}
                        </span>
                      </Badge>
                      <ThemeToggle className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm" />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-3 text-sm">
              {isLoadingTenant || isLoadingBusinessHours ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <>
                  {isOpenNow() ? (
                    <>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        Aberto agora
                      </span>
                      {todayHours && (
                        <span className="text-muted-foreground">
                          {" "}
                          · Fecha às {formatTime(todayHours.close_time)}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        Fechado agora
                      </span>
                      {todayHours && !todayHours.is_closed && (
                        <span className="text-muted-foreground">
                          {" "}
                          · Abre às {formatTime(todayHours.open_time)}
                        </span>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



