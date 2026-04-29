
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type DeliveryRegionInsert = Database['public']['Tables']['delivery_regions']['Insert'];

export function RegionSettings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<any>(null);
  const [name, setName] = useState('');
  const [fee, setFee] = useState('');
  const { user } = useAuth();
  
  const queryClient = useQueryClient();

  const { data: regions = [] } = useQuery({
    queryKey: ['delivery-regions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_regions')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const openCreateDialog = () => {
    setEditingRegion(null);
    setName('');
    setFee('0');
    setIsDialogOpen(true);
  };

  const openEditDialog = (region: any) => {
    setEditingRegion(region);
    setName(region.name);
    setFee(region.fee.toString());
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const feeValue = parseFloat(fee.replace(',', '.'));
      
      if (isNaN(feeValue)) {
        toast.error('Valor de taxa inválido');
        return;
      }
      
      if (editingRegion) {
        // Updating existing region
        const { error } = await supabase
          .from('delivery_regions')
          .update({ name, fee: feeValue })
          .eq('id', editingRegion.id);
        
        if (error) throw error;
        toast.success('Região atualizada com sucesso!');
      } else {
        // Creating new region
        if (!user?.tenantId) {
          throw new Error('Tenant não identificado para criar a região.');
        }

        const insertPayload: DeliveryRegionInsert = {
          name,
          fee: feeValue,
          tenant_id: user.tenantId,
        };

        const { error } = await supabase
          .from('delivery_regions')
          .insert(insertPayload);
        
        if (error) throw error;
        toast.success('Região criada com sucesso!');
      }
      
      queryClient.invalidateQueries({ queryKey: ['delivery-regions'] });
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Erro ao salvar região:', error);
      toast.error('Erro ao salvar região: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta região?')) return;
    
    try {
      const { error } = await supabase
        .from('delivery_regions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Região excluída com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['delivery-regions'] });
    } catch (error: any) {
      console.error('Erro ao excluir região:', error);
      toast.error('Erro ao excluir região: ' + error.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Regiões e Taxas de Entrega</h3>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Região
        </Button>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Região</TableHead>
            <TableHead>Taxa de Entrega</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {regions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                Nenhuma região cadastrada
              </TableCell>
            </TableRow>
          ) : (
            regions.map((region) => (
              <TableRow key={region.id}>
                <TableCell>{region.name}</TableCell>
                <TableCell>
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(region.fee)}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(region)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(region.id)}>
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
            <DialogTitle>{editingRegion ? 'Editar Região' : 'Nova Região'}</DialogTitle>
            <DialogDescription>
              Preencha as informações da região de entrega
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome da Região</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Centro, Zona Sul, etc."
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="fee">Taxa de Entrega</Label>
                <Input
                  id="fee"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder="Ex: 10.00"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Utilize ponto ou vírgula para valores decimais
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit">{editingRegion ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}



