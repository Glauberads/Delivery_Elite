import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { Save, Plus, Trash2, Edit2, Info } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DeliveryRegion {
  id: string;
  name: string;
  fee: number;
}

interface DeliveryTime {
  id: string;
  restaurant_id: string;
  min_time: number;
  max_time: number;
  day_of_week: string | null;
}

interface FormError {
  [key: string]: string;
}

type DeliveryRegionInsert =
  Database["public"]["Tables"]["delivery_regions"]["Insert"];

export function DeliverySettingsForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegionDialogOpen, setIsRegionDialogOpen] = useState(false);
  const [isDeliveryTimeDialogOpen, setIsDeliveryTimeDialogOpen] =
    useState(false);
  const [editingRegion, setEditingRegion] = useState<DeliveryRegion | null>(
    null
  );
  const [editingDeliveryTime, setEditingDeliveryTime] =
    useState<DeliveryTime | null>(null);

  const [formData, setFormData] = useState({
    delivery_fee: 0,
    min_order_value: 0,
  });

  const [regionForm, setRegionForm] = useState({
    name: "",
    fee: 0,
  });

  const [deliveryTimeForm, setDeliveryTimeForm] = useState({
    min_time: 30,
    max_time: 50,
    day_of_week: "default",
  });

  const [formErrors, setFormErrors] = useState<FormError>({});

  const DAYS_OF_WEEK = [
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
    "Domingo",
  ];

  const { data: restaurant, refetch } = useQuery({
    queryKey: ["restaurant"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao carregar informações",
          description: error.message,
        });
        return null;
      }

      return data;
    },
  });

  const { data: regions, refetch: refetchRegions } = useQuery({
    queryKey: ["delivery_regions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_regions")
        .select("*")
        .order("name");

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao carregar regiões",
          description: error.message,
        });
        return [];
      }

      return data;
    },
  });

  const { data: deliveryTimes, refetch: refetchDeliveryTimes } = useQuery({
    queryKey: ["delivery_times"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_times")
        .select("*")
        .order("day_of_week", { ascending: true, nullsFirst: true });

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao carregar tempos de entrega",
          description: error.message,
        });
        return [];
      }

      return data;
    },
  });

  useEffect(() => {
    if (restaurant) {
      setFormData({
        delivery_fee: restaurant.delivery_fee || 0,
        min_order_value: restaurant.min_order_value || 0,
      });
    }
  }, [restaurant]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: parseFloat(value),
    }));
  };

  const handleRegionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRegionForm((prev) => ({
      ...prev,
      [name]: name === "fee" ? parseFloat(value) : value,
    }));
    // Limpa o erro do campo quando ele é alterado
    setFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleDeliveryTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDeliveryTimeForm((prev) => ({
      ...prev,
      [name]: parseFloat(value),
    }));
    // Limpa o erro do campo quando ele é alterado
    setFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleDayOfWeekChange = (value: string) => {
    setDeliveryTimeForm((prev) => ({
      ...prev,
      day_of_week: value,
    }));
    setFormErrors((prev) => ({ ...prev, day_of_week: "" }));
  };

  const validateRegionForm = () => {
    const errors: FormError = {};
    if (!regionForm.name.trim()) {
      errors.name = "Nome da região é obrigatório";
    }
    if (regionForm.fee < 0) {
      errors.fee = "Taxa de entrega deve ser maior ou igual a zero";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateDeliveryTimeForm = () => {
    const errors: FormError = {};
    if (deliveryTimeForm.min_time <= 0) {
      errors.min_time = "Tempo mínimo deve ser maior que zero";
    }
    if (deliveryTimeForm.max_time <= 0) {
      errors.max_time = "Tempo máximo deve ser maior que zero";
    }
    if (deliveryTimeForm.max_time <= deliveryTimeForm.min_time) {
      errors.max_time = "Tempo máximo deve ser maior que tempo mínimo";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (restaurant) {
        const { error } = await supabase
          .from("restaurants")
          .update(formData)
          .eq("id", restaurant.id);

        if (error) throw error;

        toast({
          title: "Configurações atualizadas",
          description:
            "As configurações de entrega foram atualizadas com sucesso.",
        });

        refetch();
      }
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRegionForm()) return;

    setIsSubmitting(true);
    try {
      if (editingRegion) {
        const { error } = await supabase
          .from("delivery_regions")
          .update({
            name: regionForm.name,
            fee: regionForm.fee,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingRegion.id);

        if (error) throw error;
        toast({
          title: "Região atualizada",
          description: "A região foi atualizada com sucesso.",
        });
      } else {
        if (!user?.tenantId) {
          throw new Error("Tenant não identificado para criar a região.");
        }

        const insertPayload: DeliveryRegionInsert = {
          name: regionForm.name,
          fee: regionForm.fee,
          tenant_id: user.tenantId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("delivery_regions")
          .insert(insertPayload);

        if (error) throw error;
        toast({
          title: "Região adicionada",
          description: "A nova região foi adicionada com sucesso.",
        });
      }

      setRegionForm({ name: "", fee: 0 });
      setEditingRegion(null);
      setIsRegionDialogOpen(false);
      refetchRegions();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeliveryTimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDeliveryTimeForm()) return;

    setIsSubmitting(true);
    try {
      if (!restaurant) throw new Error("Restaurante não encontrado");

      if (editingDeliveryTime) {
        const { error } = await supabase
          .from("delivery_times")
          .update({
            min_time: deliveryTimeForm.min_time,
            max_time: deliveryTimeForm.max_time,
            day_of_week:
              deliveryTimeForm.day_of_week === "default"
                ? null
                : deliveryTimeForm.day_of_week,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingDeliveryTime.id);

        if (error) throw error;
        toast({
          title: "Tempo de entrega atualizado",
          description: "O tempo de entrega foi atualizado com sucesso.",
        });
      } else {
        // Verificar se já existe um registro para o dia da semana
        if (deliveryTimeForm.day_of_week !== "default") {
          const existingDay = deliveryTimes?.find(
            (time) => time.day_of_week === deliveryTimeForm.day_of_week
          );
          if (existingDay) {
            toast({
              variant: "destructive",
              title: "Dia já existe",
              description: `Já existe um registro para ${deliveryTimeForm.day_of_week}. Edite o existente.`,
            });
            setIsSubmitting(false);
            return;
          }
        } else {
          // Verificar se já existe um registro padrão (sem dia)
          const existingDefault = deliveryTimes?.find(
            (time) => time.day_of_week === null
          );
          if (existingDefault) {
            toast({
              variant: "destructive",
              title: "Tempo padrão já existe",
              description:
                "Já existe um tempo de entrega padrão. Edite o existente.",
            });
            setIsSubmitting(false);
            return;
          }
        }

        const { error } = await supabase.from("delivery_times").insert({
          restaurant_id: restaurant.id,
          min_time: deliveryTimeForm.min_time,
          max_time: deliveryTimeForm.max_time,
          day_of_week:
            deliveryTimeForm.day_of_week === "default"
              ? null
              : deliveryTimeForm.day_of_week,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;
        toast({
          title: "Tempo de entrega adicionado",
          description: "O novo tempo de entrega foi adicionado com sucesso.",
        });
      }

      setDeliveryTimeForm({
        min_time: 30,
        max_time: 50,
        day_of_week: "default",
      });
      setEditingDeliveryTime(null);
      setIsDeliveryTimeDialogOpen(false);
      refetchDeliveryTimes();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditRegion = (region: DeliveryRegion) => {
    setEditingRegion(region);
    setRegionForm({
      name: region.name,
      fee: region.fee,
    });
    setIsRegionDialogOpen(true);
  };

  const handleEditDeliveryTime = (deliveryTime: DeliveryTime) => {
    setEditingDeliveryTime(deliveryTime);
    setDeliveryTimeForm({
      min_time: deliveryTime.min_time,
      max_time: deliveryTime.max_time,
      day_of_week: deliveryTime.day_of_week || "default",
    });
    setIsDeliveryTimeDialogOpen(true);
  };

  const handleDeleteRegion = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta região?")) return;

    try {
      const { error } = await supabase
        .from("delivery_regions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Região excluída",
        description: "A região foi excluída com sucesso.",
      });

      refetchRegions();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  const handleDeleteDeliveryTime = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este tempo de entrega?"))
      return;

    try {
      const { error } = await supabase
        .from("delivery_times")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Tempo de entrega excluído",
        description: "O tempo de entrega foi excluído com sucesso.",
      });

      refetchDeliveryTimes();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  const resetDeliveryTimeForm = () => {
    setDeliveryTimeForm({
      min_time: 30,
      max_time: 50,
      day_of_week: "default",
    });
    setEditingDeliveryTime(null);
    setFormErrors({});
  };

  const resetRegionForm = () => {
    setRegionForm({
      name: "",
      fee: 0,
    });
    setEditingRegion(null);
    setFormErrors({});
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Configurações Gerais de Entrega</CardTitle>
          <CardDescription>
            Configure os valores gerais para entregas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="delivery_fee">
                  Taxa de Entrega Padrão (R$)
                </Label>
                <Input
                  id="delivery_fee"
                  name="delivery_fee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.delivery_fee}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_order_value">
                  Valor Mínimo do Pedido (R$)
                </Label>
                <Input
                  id="min_order_value"
                  name="min_order_value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.min_order_value}
                  onChange={handleChange}
                />
              </div>
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tempos de Entrega</CardTitle>
            <CardDescription>
              Configure os tempos médios de entrega.
            </CardDescription>
          </div>
          <Dialog
            open={isDeliveryTimeDialogOpen}
            onOpenChange={setIsDeliveryTimeDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetDeliveryTimeForm();
                  setIsDeliveryTimeDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Novo Tempo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingDeliveryTime
                    ? "Editar Tempo de Entrega"
                    : "Adicionar Tempo de Entrega"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleDeliveryTimeSubmit} className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="day_of_week">Dia da Semana</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Deixe em branco para configurar o tempo padrão</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select
                    value={deliveryTimeForm.day_of_week}
                    onValueChange={handleDayOfWeekChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um dia (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">
                        Padrão (todos os dias)
                      </SelectItem>
                      {DAYS_OF_WEEK.map((day) => (
                        <SelectItem key={day} value={day}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min_time">Tempo Mínimo (minutos)</Label>
                    <Input
                      id="min_time"
                      name="min_time"
                      type="number"
                      value={deliveryTimeForm.min_time}
                      onChange={handleDeliveryTimeChange}
                      min="1"
                    />
                    {formErrors.min_time && (
                      <p className="text-sm text-red-500">
                        {formErrors.min_time}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_time">Tempo Máximo (minutos)</Label>
                    <Input
                      id="max_time"
                      name="max_time"
                      type="number"
                      value={deliveryTimeForm.max_time}
                      onChange={handleDeliveryTimeChange}
                      min="1"
                    />
                    {formErrors.max_time && (
                      <p className="text-sm text-red-500">
                        {formErrors.max_time}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting
                      ? "Salvando..."
                      : editingDeliveryTime
                      ? "Atualizar"
                      : "Adicionar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dia da Semana</TableHead>
                <TableHead>Tempo Mínimo</TableHead>
                <TableHead>Tempo Máximo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveryTimes && deliveryTimes.length > 0 ? (
                deliveryTimes.map((time) => (
                  <TableRow key={time.id}>
                    <TableCell>
                      {time.day_of_week || "Padrão (todos os dias)"}
                    </TableCell>
                    <TableCell>{time.min_time} minutos</TableCell>
                    <TableCell>{time.max_time} minutos</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditDeliveryTime(time)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteDeliveryTime(time.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4">
                    Nenhum tempo de entrega configurado. Adicione um novo tempo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Regiões de Entrega</CardTitle>
            <CardDescription>
              Configure as regiões e taxas específicas de entrega.
            </CardDescription>
          </div>
          <Dialog
            open={isRegionDialogOpen}
            onOpenChange={setIsRegionDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetRegionForm();
                  setIsRegionDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Nova Região
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingRegion ? "Editar Região" : "Adicionar Região"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleRegionSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Região</Label>
                  <Input
                    id="name"
                    name="name"
                    value={regionForm.name}
                    onChange={handleRegionChange}
                  />
                  {formErrors.name && (
                    <p className="text-sm text-red-500">{formErrors.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fee">Taxa de Entrega (R$)</Label>
                  <Input
                    id="fee"
                    name="fee"
                    type="number"
                    step="0.01"
                    min="0"
                    value={regionForm.fee}
                    onChange={handleRegionChange}
                  />
                  {formErrors.fee && (
                    <p className="text-sm text-red-500">{formErrors.fee}</p>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting
                      ? "Salvando..."
                      : editingRegion
                      ? "Atualizar"
                      : "Adicionar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Taxa de Entrega</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regions && regions.length > 0 ? (
                regions.map((region) => (
                  <TableRow key={region.id}>
                    <TableCell>{region.name}</TableCell>
                    <TableCell>R$ {region.fee.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditRegion(region)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteRegion(region.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-4">
                    Nenhuma região configurada. Adicione uma nova região.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}



