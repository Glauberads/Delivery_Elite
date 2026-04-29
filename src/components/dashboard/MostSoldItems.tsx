
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

export function MostSoldItems() {
  const { data: items, isLoading } = useQuery({
    queryKey: ['most-sold-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          product:products(name),
          quantity
        `)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('quantity', { ascending: false })
        .limit(5);

      if (error) throw error;

      const groupedItems = data.reduce((acc: any[], item) => {
        const existingItem = acc.find(i => i.product.name === item.product.name);
        if (existingItem) {
          existingItem.quantity += item.quantity;
        } else {
          acc.push({
            product: item.product,
            quantity: item.quantity
          });
        }
        return acc;
      }, []);

      return groupedItems.sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    }
  });

  if (isLoading) {
    return (
      <Card className="col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Itens Mais Vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-4 w-[50px]" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Itens Mais Vendidos</CardTitle>
        <Star className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items?.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">{item.product.name}</p>
              </div>
              <div className="font-medium">{item.quantity} un</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}



