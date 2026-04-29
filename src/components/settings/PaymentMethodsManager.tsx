import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Edit,
  Trash2,
  CreditCard,
  Banknote,
  QrCode,
  Landmark,
  Wallet,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface PostgrestError {
  message: string;
  details: string;
  hint: string;
  code: string;
}

type PaymentMethod = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  enabled: boolean;
  restaurant_id: string | null;
  display_order: number | null;
};

export function PaymentMethodsManager() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(
    null
  );

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    icon: "credit-card",
    enabled: true,
  });

  const { data: paymentMethods, refetch } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao carregar métodos de pagamento",
          description: error.message,
        });
        return [];
      }

      return data as PaymentMethod[];
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      icon: "credit-card",
      enabled: true,
    });
  };

  const getErrorDescription = (error: unknown, fallback: string) => {
    const pgError = error as Partial<PostgrestError> | null;
    const message = String(pgError?.message ?? "").toLowerCase();

    if (message.includes("row-level security policy")) {
      return "Você não tem permissão para alterar os métodos de pagamento desta loja.";
    }

    return pgError?.message || fallback;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      setFormData((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSwitchChange = (checked: boolean, id: string) => {
    updateMethodStatus(id, checked);
  };

  const handleIconChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      icon: e.target.value,
    }));
  };

  const openAddDialog = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const openEditDialog = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setFormData({
      name: method.name,
      description: method.description || "",
      icon: method.icon || "credit-card",
      enabled: method.enabled,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setIsDeleteDialogOpen(true);
  };

  const updateMethodStatus = async (id: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({ enabled })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: enabled
          ? "Método de pagamento ativado."
          : "Método de pagamento desativado.",
      });

      refetch();
    } catch (error) {
      const pgError = error as PostgrestError;
      toast({
        variant: "destructive",
        title: "Erro ao atualizar status",
        description: pgError.message,
      });
    }
  };

  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!user?.tenantId) {
        throw new Error("Tenant não identificado para salvar o método de pagamento.");
      }

      const { error } = await supabase.from("payment_methods").insert({
        tenant_id: user.tenantId,
        name: formData.name,
        description: formData.description || null,
        icon: formData.icon,
        enabled: formData.enabled,
      });

      if (error) throw error;

      toast({
        title: "Método adicionado",
        description: "Novo método de pagamento adicionado com sucesso.",
      });

      setIsAddDialogOpen(false);
      refetch();
      resetForm();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao adicionar método",
        description: getErrorDescription(error, "Não foi possível adicionar o método de pagamento."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditMethod = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMethod) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({
          name: formData.name,
          description: formData.description || null,
          icon: formData.icon,
          enabled: formData.enabled,
        })
        .eq("id", selectedMethod.id);

      if (error) throw error;

      toast({
        title: "Método atualizado",
        description: "Método de pagamento atualizado com sucesso.",
      });

      setIsEditDialogOpen(false);
      refetch();
      resetForm();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar método",
        description: getErrorDescription(error, "Não foi possível atualizar o método de pagamento."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMethod = async () => {
    if (!selectedMethod) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("payment_methods")
        .delete()
        .eq("id", selectedMethod.id);

      if (error) throw error;

      toast({
        title: "Método removido",
        description: "Método de pagamento removido com sucesso.",
      });

      setIsDeleteDialogOpen(false);
      refetch();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao remover método",
        description: getErrorDescription(error, "Não foi possível remover o método de pagamento."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fixed function to correctly render icon options
  const renderIconOption = (iconName: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      "credit-card": <CreditCard className="h-5 w-5" />,
      banknote: <Banknote className="h-5 w-5" />,
      "qr-code": <QrCode className="h-5 w-5" />,
      landmark: <Landmark className="h-5 w-5" />,
      wallet: <Wallet className="h-5 w-5" />,
    };

    return (
      <>
        {iconMap[iconName] || <CreditCard className="h-5 w-5" />}
        <span className="ml-2 capitalize">{iconName.replace("-", " ")}</span>
      </>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Métodos de Pagamento</CardTitle>
          <CardDescription>
            Gerencie os métodos de pagamento aceitos pelo seu restaurante
          </CardDescription>
        </div>
        <Button onClick={openAddDialog} size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">Descrição</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentMethods && paymentMethods.length > 0 ? (
              paymentMethods.map((method) => (
                <TableRow key={method.id}>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      {method.icon === "credit-card" && (
                        <CreditCard className="h-5 w-5" />
                      )}
                      {method.icon === "banknote" && (
                        <Banknote className="h-5 w-5" />
                      )}
                      {method.icon === "qr-code" && (
                        <QrCode className="h-5 w-5" />
                      )}
                      {method.icon === "landmark" && (
                        <Landmark className="h-5 w-5" />
                      )}
                      {method.icon === "wallet" && (
                        <Wallet className="h-5 w-5" />
                      )}
                      {!method.icon && <CreditCard className="h-5 w-5" />}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{method.name}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {method.description}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={method.enabled}
                      onCheckedChange={(checked) =>
                        handleSwitchChange(checked, method.id)
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openEditDialog(method)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openDeleteDialog(method)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-6 text-muted-foreground"
                >
                  Nenhum método de pagamento encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Add Payment Method Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Método de Pagamento</DialogTitle>
            <DialogDescription>
              Preencha os campos abaixo para adicionar um novo método de
              pagamento.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddMethod} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="icon">Ícone</Label>
              <select
                id="icon"
                name="icon"
                value={formData.icon}
                onChange={handleIconChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Selecione o ícone do método de pagamento"
              >
                <option value="credit-card">Cartão de Crédito</option>
                <option value="banknote">Dinheiro</option>
                <option value="qr-code">QR Code / PIX</option>
                <option value="landmark">Transferência Bancária</option>
                <option value="wallet">Carteira Digital</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="enabled"
                name="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    enabled: checked === true,
                  }))
                }
              />
              <Label htmlFor="enabled">Ativo</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adicionando..." : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Method Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Método de Pagamento</DialogTitle>
            <DialogDescription>
              Atualize as informações do método de pagamento.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditMethod} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Descrição</Label>
              <Input
                id="edit-description"
                name="description"
                value={formData.description}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-icon">Ícone</Label>
              <select
                id="edit-icon"
                name="icon"
                value={formData.icon}
                onChange={handleIconChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Selecione o ícone do método de pagamento"
              >
                <option value="credit-card">Cartão de Crédito</option>
                <option value="banknote">Dinheiro</option>
                <option value="qr-code">QR Code / PIX</option>
                <option value="landmark">Transferência Bancária</option>
                <option value="wallet">Carteira Digital</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-enabled"
                name="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    enabled: checked === true,
                  }))
                }
              />
              <Label htmlFor="edit-enabled">Ativo</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o método de pagamento "
              {selectedMethod?.name}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteMethod}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}



