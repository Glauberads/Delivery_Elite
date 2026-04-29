import React, { useEffect, useMemo, useState } from "react";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock3, Save } from "lucide-react";

type BusinessHour = Database["public"]["Tables"]["business_hours"]["Row"];

type LocalBusinessHour = BusinessHour & {
  isDirty?: boolean;
};

const DAYS_OF_WEEK = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
] as const;

const PRESET_OPTIONS = [
  {
    value: "always_open",
    label: "Sempre Aberto",
    build: () => ({
      open_time: "00:00",
      close_time: "23:59",
      is_closed: false,
    }),
  },
  {
    value: "commercial",
    label: "Comercial (09h às 18h)",
    build: () => ({
      open_time: "09:00",
      close_time: "18:00",
      is_closed: false,
    }),
  },
  {
    value: "night",
    label: "Noturno (18h às 02h)",
    build: () => ({
      open_time: "18:00",
      close_time: "02:00",
      is_closed: false,
    }),
  },
  {
    value: "closed",
    label: "Fechado",
    build: () => ({
      open_time: "00:00",
      close_time: "00:00",
      is_closed: true,
    }),
  },
  {
    value: "custom",
    label: "Personalizado",
    build: null,
  },
] as const;

function getDefaultHours(tenantId: string) {
  return DAYS_OF_WEEK.map((day) => ({
    tenant_id: tenantId,
    day_of_week: day,
    open_time: "09:00",
    close_time: "18:00",
    is_closed: day === "Domingo",
  }));
}

function sortByWeekday(hours: LocalBusinessHour[]) {
  return [...hours].sort(
    (left, right) =>
      DAYS_OF_WEEK.indexOf(left.day_of_week as (typeof DAYS_OF_WEEK)[number]) -
      DAYS_OF_WEEK.indexOf(right.day_of_week as (typeof DAYS_OF_WEEK)[number]),
  );
}

function normalizeHours(hours: BusinessHour[]) {
  return sortByWeekday(hours.map((hour) => ({ ...hour, isDirty: false })));
}

export function OperatingHoursForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPreset, setSelectedPreset] = useState<string>("custom");
  const [localBusinessHours, setLocalBusinessHours] = useState<LocalBusinessHour[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tenantId = user?.tenantId ?? null;

  const { data: businessHours = [], refetch, isLoading } = useQuery<BusinessHour[]>({
    queryKey: ["business_hours", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      if (!tenantId) {
        return [];
      }

      const { data, error } = await supabase.from("business_hours").select("*");

      if (error) {
        throw error;
      }

      const existing = data ?? [];
      const existingDays = new Set(existing.map((item) => item.day_of_week));
      const missingDays = DAYS_OF_WEEK.filter((day) => !existingDays.has(day));

      if (missingDays.length > 0) {
        const { error: insertError } = await supabase.from("business_hours").insert(
          missingDays.map((day) => ({
            tenant_id: tenantId,
            day_of_week: day,
            open_time: "09:00",
            close_time: "18:00",
            is_closed: day === "Domingo",
          })),
        );

        if (insertError) {
          throw insertError;
        }

        const { data: refreshedData, error: refreshError } = await supabase.from("business_hours").select("*");
        if (refreshError) {
          throw refreshError;
        }

        return sortByWeekday(refreshedData ?? []);
      }

      if (existing.length === 0) {
        const { error: insertError } = await supabase.from("business_hours").insert(getDefaultHours(tenantId));

        if (insertError) {
          throw insertError;
        }

        const { data: refreshedData, error: refreshError } = await supabase.from("business_hours").select("*");
        if (refreshError) {
          throw refreshError;
        }

        return sortByWeekday(refreshedData ?? []);
      }

      return sortByWeekday(existing);
    },
  });

  useEffect(() => {
    setLocalBusinessHours(normalizeHours(businessHours));
  }, [businessHours]);

  const hasChanges = useMemo(
    () => localBusinessHours.some((hour) => hour.isDirty),
    [localBusinessHours],
  );

  const customScheduleByDay = useMemo(() => {
    return DAYS_OF_WEEK.map((day) => localBusinessHours.find((hour) => hour.day_of_week === day)).filter(Boolean) as LocalBusinessHour[];
  }, [localBusinessHours]);

  const presetSummary = useMemo(() => {
    const preset = PRESET_OPTIONS.find((option) => option.value === selectedPreset);

    if (!preset || preset.value === "custom") {
      return "Ajuste os dias individualmente para ter controle total da agenda.";
    }

    return `Predefinição aplicada: ${preset.label}. Clique em salvar para persistir no banco.`;
  }, [selectedPreset]);

  const markHourDirty = (dayId: string, patch: Partial<LocalBusinessHour>) => {
    setLocalBusinessHours((current) =>
      current.map((hour) => (hour.id === dayId ? { ...hour, ...patch, isDirty: true } : hour)),
    );
  };

  const applyPreset = (presetValue: string) => {
    setSelectedPreset(presetValue);

    if (presetValue === "custom") {
      return;
    }

    const preset = PRESET_OPTIONS.find((option) => option.value === presetValue);
    if (!preset?.build) {
      return;
    }

    const next = preset.build();
    setLocalBusinessHours((current) =>
      current.map((hour) => ({
        ...hour,
        open_time: next.open_time,
        close_time: next.close_time,
        is_closed: next.is_closed,
        isDirty: true,
      })),
    );

    toast({
      title: "Predefinição aplicada",
      description: `${preset.label} pronto para salvar.`,
    });
  };

  const saveChanges = async () => {
    setIsSubmitting(true);

    try {
      const changedHours = localBusinessHours.filter((hour) => hour.isDirty);

      if (changedHours.length === 0) {
        toast({
          title: "Sem alterações",
          description: "Nenhum horário foi modificado.",
        });
        return;
      }

      for (const hour of changedHours) {
        const { error } = await supabase
          .from("business_hours")
          .update({
            open_time: hour.open_time,
            close_time: hour.close_time,
            is_closed: hour.is_closed,
            updated_at: new Date().toISOString(),
          })
          .eq("id", hour.id);

        if (error) {
          throw error;
        }
      }

      await refetch();

      toast({
        title: "Horários atualizados",
        description: "O cronograma da loja foi salvo com sucesso em business_hours.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar horários",
        description: error instanceof Error ? error.message : "Não foi possível salvar os horários.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Horários de Funcionamento</CardTitle>
        <CardDescription>
          A agenda da loja está integrada à tabela <code>business_hours</code>, que é a fonte de verdade usada pela vitrine.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="hours-preset">Predefinição</Label>
          <Select value={selectedPreset} onValueChange={applyPreset}>
            <SelectTrigger id="hours-preset" className="w-full md:max-w-sm">
              <SelectValue placeholder="Selecione uma predefinição" />
            </SelectTrigger>
            <SelectContent>
              {PRESET_OPTIONS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
          {presetSummary}
        </div>

        {selectedPreset === "custom" ? (
          <div className="grid gap-4">
            {customScheduleByDay.map((hour) => (
              <div
                key={hour.id}
                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-orange-100 p-3 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300">
                      <Clock3 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-slate-900 dark:text-zinc-100">{hour.day_of_week}</p>
                      <p className="text-sm text-slate-500 dark:text-zinc-400">
                        {hour.is_closed ? "Loja fechada neste dia" : "Loja aberta neste dia"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch checked={!hour.is_closed} onCheckedChange={(checked) => markHourDirty(hour.id, { is_closed: !checked })} />
                    <span className={`text-sm font-medium ${hour.is_closed ? "text-rose-500" : "text-emerald-500"}`}>
                      {hour.is_closed ? "Fechado" : "Aberto"}
                    </span>
                  </div>
                </div>

                {!hour.is_closed ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`open-${hour.id}`}>Abertura</Label>
                      <Input
                        id={`open-${hour.id}`}
                        type="time"
                        value={hour.open_time?.slice(0, 5) || ""}
                        onChange={(event) => markHourDirty(hour.id, { open_time: event.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`close-${hour.id}`}>Fechamento</Label>
                      <Input
                        id={`close-${hour.id}`}
                        type="time"
                        value={hour.close_time?.slice(0, 5) || ""}
                        onChange={(event) => markHourDirty(hour.id, { close_time: event.target.value })}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button onClick={saveChanges} disabled={isSubmitting || isLoading} className="gap-2">
            <Save className="h-4 w-4" />
            {isSubmitting ? "Salvando..." : "Salvar horários"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}



