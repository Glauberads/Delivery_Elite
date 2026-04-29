
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Palette, Image } from 'lucide-react';

type SystemTheme = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  faviconUrl: string;
};

interface ThemeSettings {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  faviconUrl?: string;
}

export function VisualIdentityForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: restaurant, refetch } = useQuery({
    queryKey: ['restaurant'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*, theme_settings')
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
    }
  });

  const [themeData, setThemeData] = useState<SystemTheme>({
    primaryColor: '#FF9800',
    secondaryColor: '#4CAF50',
    accentColor: '#2196F3',
    logoUrl: '',
    faviconUrl: ''
  });

  useEffect(() => {
    if (restaurant) {
      if (restaurant.theme_settings && typeof restaurant.theme_settings === 'object') {
        const themeSettings = restaurant.theme_settings as ThemeSettings;
        
        setThemeData({
          primaryColor: themeSettings.primaryColor || '#FF9800',
          secondaryColor: themeSettings.secondaryColor || '#4CAF50',
          accentColor: themeSettings.accentColor || '#2196F3',
          logoUrl: restaurant.logo_url || '',
          faviconUrl: themeSettings.faviconUrl || '',
        });
      }
    }
  }, [restaurant]);

  const handleThemeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setThemeData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleThemeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (restaurant) {
        const { error } = await supabase
          .from('restaurants')
          .update({
            logo_url: themeData.logoUrl,
            theme_settings: {
              primaryColor: themeData.primaryColor,
              secondaryColor: themeData.secondaryColor,
              accentColor: themeData.accentColor,
              faviconUrl: themeData.faviconUrl,
            }
          })
          .eq('id', restaurant.id);
          
        if (error) throw error;
        
        toast({
          title: "Tema atualizado",
          description: "As configurações de tema foram atualizadas com sucesso."
        });

        refetch();
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Nenhum restaurante encontrado. Configure as informações básicas primeiro."
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleThemeSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="logoUrl">URL da Logo</Label>
          <div className="flex gap-4">
            <Input
              id="logoUrl"
              name="logoUrl"
              type="url"
              placeholder="https://exemplo.com/logo.png"
              value={themeData.logoUrl}
              onChange={handleThemeChange}
            />
            <Button type="button" size="icon" variant="outline">
              <Image className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Recomendado: 200x50 pixels, formato PNG ou SVG
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="faviconUrl">URL do Favicon</Label>
          <div className="flex gap-4">
            <Input
              id="faviconUrl"
              name="faviconUrl"
              type="url"
              placeholder="https://exemplo.com/favicon.png"
              value={themeData.faviconUrl}
              onChange={handleThemeChange}
            />
            <Button type="button" size="icon" variant="outline">
              <Image className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Recomendado: 32x32 pixels, formato PNG
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="primaryColor">Cor Primária</Label>
          <div className="flex gap-2">
            <Input
              id="primaryColor"
              name="primaryColor"
              type="color"
              value={themeData.primaryColor}
              onChange={handleThemeChange}
              className="w-16 h-10 p-1"
            />
            <Input
              type="text"
              value={themeData.primaryColor}
              onChange={handleThemeChange}
              name="primaryColor"
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="secondaryColor">Cor Secundária</Label>
          <div className="flex gap-2">
            <Input
              id="secondaryColor"
              name="secondaryColor"
              type="color"
              value={themeData.secondaryColor}
              onChange={handleThemeChange}
              className="w-16 h-10 p-1"
            />
            <Input
              type="text"
              value={themeData.secondaryColor}
              onChange={handleThemeChange}
              name="secondaryColor"
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="accentColor">Cor de Destaque</Label>
          <div className="flex gap-2">
            <Input
              id="accentColor"
              name="accentColor"
              type="color"
              value={themeData.accentColor}
              onChange={handleThemeChange}
              className="w-16 h-10 p-1"
            />
            <Input
              type="text"
              value={themeData.accentColor}
              onChange={handleThemeChange}
              name="accentColor"
              className="flex-1"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          <Palette className="h-4 w-4" />
          {isSubmitting ? 'Salvando...' : 'Salvar Personalização'}
        </Button>
      </div>
    </form>
  );
}



