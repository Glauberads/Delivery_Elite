
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type DriverInsert = Database['public']['Tables']['drivers']['Insert'];

export function DriverSettings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const { user } = useAuth();
  
  const queryClient = useQueryClient();

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const openCreateDialog = () => {
    setEditingDriver(null);
    setName('');
    setPhone('');
    setVehicle('');
    setIsDialogOpen(true);
  };

  const openEditDialog = (driver: any) => {
    setEditingDriver(driver);
    setName(driver.name);
    setPhone(driver.phone);
    setVehicle(driver.vehicle || '');
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingDriver) {
        // Updating existing driver
        const { error } = await supabase
          .from('drivers')
          .update({ name, phone, vehicle })
          .eq('id', editingDriver.id);
        
        if (error) throw error;
        toast.success('Entregador atualizado com sucesso!');
      } else {
        // Creating new driver
        if (!user?.tenantId) {
          throw new Error('Tenant não identificado para criar o entregador.');
        }

        const insertPayload: DriverInsert = {
          name,
          phone,
          vehicle,
          status: 'Ativo',
          tenant_id: user.tenantId,
        };

        const { error } = await supabase
          .from('drivers')
          .insert(insertPayload);
        
        if (error) throw error;
        toast.success('Entregador criado com sucesso!');
      }
      
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Erro ao salvar entregador:', error);
      toast.error('Erro ao salvar entregador: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este entregador?')) return;
    
    try {
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Entregador excluído com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    } catch (error: any) {
      console.error('Erro ao excluir entregador:', error);
      toast.error('Erro ao excluir entregador: ' + error.message);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Ativo': return 'default';
      case 'Em Entrega': return 'secondary';
      case 'Indisponível': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Entregadores</h3>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Entregador
        </Button>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Veículo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drivers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                Nenhum entregador cadastrado
              </TableCell>
            </TableRow>
          ) : (
            drivers.map((driver) => (
              <TableRow key={driver.id}>
                <TableCell>{driver.name}</TableCell>
                <TableCell>{driver.phone}</TableCell>
                <TableCell>{driver.vehicle}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(driver.status)}>
                    {driver.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(driver)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(driver.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDriver ? 'Editar Entregador' : 'Novo Entregador'}</DialogTitle>
            <DialogDescription>
              Preencha as informações do entregador
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do entregador"
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Telefone do entregador"
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="vehicle">Veículo</Label>
                <Input
                  id="vehicle"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  placeholder="Veículo utilizado (opcional)"
                />
              </div>
            </div>
            
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit">{editingDriver ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}



