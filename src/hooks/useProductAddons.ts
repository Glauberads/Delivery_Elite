
import { useState, useEffect } from 'react';
import { ProductAddon } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useProductAddons(productId?: string) {
  const [addons, setAddons] = useState<ProductAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAddons = async () => {
      try {
        setLoading(true);
        
        // Only fetch addons if a product ID is provided
        if (!productId) {
          setAddons([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.rpc('get_product_addons_by_product', { 
          product_id_param: productId 
        });

        if (error) throw error;

        const formattedAddons = (data || []).map(addon => ({
          id: addon.id,
          name: addon.name,
          description: addon.description || undefined,
          price: addon.price,
          available: addon.available,
          isGlobal: addon.is_global,
          maxOptions: addon.max_options,
        }));

        setAddons(formattedAddons);
      } catch (error) {
        console.error('Error fetching product addons:', error);
        toast({
          title: "Erro ao carregar adicionais",
          description: "Não foi possível carregar os adicionais do produto.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAddons();
  }, [productId]); // Remove toast from dependencies to prevent infinite loop

  return { addons, loading };
}



