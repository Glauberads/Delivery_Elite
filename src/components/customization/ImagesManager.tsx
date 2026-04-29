import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ImageIcon, Save, ExternalLink, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fileToBase64, validateImageFile } from "@/utils/image-utils";

// Definição de tipos
interface ThemeSettings {
  favicon_url?: string;
  [key: string]: unknown;
}

interface RestaurantData {
  id: string;
  banner_url?: string;
  logo_url?: string;
  theme_settings?: ThemeSettings;
  [key: string]: unknown;
}

export function ImagesManager() {
  const { toast } = useToast();

  // Estados controlados manualmente
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>({});
  const [bannerUrl, setBannerUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Carregar dados apenas uma vez
  if (!isLoaded) {
    setIsLoaded(true);

    // Buscar dados do servidor com tratamento de erro
    try {
      supabase
        .from("restaurants")
        .select("*")
        .limit(1)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            toast({
              variant: "destructive",
              title: "Erro ao carregar dados",
              description: "Problema ao conectar com o servidor",
            });
            return;
          }

          if (data) {
            // Configurar ID do restaurante
            setRestaurantId(data.id);

            // Configurar URLs
            if (data.banner_url) {
              setBannerUrl(data.banner_url);
            }

            if (data.logo_url) {
              setLogoUrl(data.logo_url);
            }

            // Configurar favicon da galeria
            if (
              data.theme_settings &&
              typeof data.theme_settings === "object"
            ) {
              const settings = data.theme_settings as ThemeSettings;
              setThemeSettings(settings);

              if (settings.favicon_url) {
                setFaviconUrl(settings.favicon_url);
              }
            }
          }
        });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro de conexão",
        description: "Não foi possível conectar ao servidor",
      });
    }
  }

  // Salvar alterações
  const handleSaveUrls = async () => {
    if (!restaurantId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Restaurante não encontrado",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Atualizar no banco de dados
      const { error } = await supabase
        .from("restaurants")
        .update({
          banner_url: bannerUrl.trim() || null,
          logo_url: logoUrl.trim() || null,
          theme_settings: {
            ...themeSettings,
            favicon_url: faviconUrl.trim() || null,
          },
        })
        .eq("id", restaurantId);

      if (error) throw error;

      toast({
        title: "URLs atualizadas",
        description: "As URLs das imagens foram atualizadas com sucesso",
      });

      // Atualizar estado local
      setThemeSettings((prev) => ({
        ...prev,
        favicon_url: faviconUrl.trim() || null,
      }));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: "Não foi possível salvar as alterações",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler para abrir a imagem em nova aba
  const handleOpenInNewTab = (url: string) => {
    if (!url) return;

    // Se for uma URL base64, criar um blob e gerar uma URL temporária
    if (url.startsWith("data:")) {
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head>
              <title>Visualização da Imagem</title>
              <style>
                body {
                  margin: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  background: #f1f1f1;
                }
                img {
                  max-width: 100%;
                  max-height: 100vh;
                  object-fit: contain;
                }
              </style>
            </head>
            <body>
              <img src="${url}" alt="Preview" />
            </body>
          </html>
        `);
      }
    } else {
      // Se for uma URL normal, abrir em nova aba
      window.open(url, "_blank");
    }
  };

  // Handler para upload de arquivos
  const handleFileUpload = async (
    file: File,
    type: "banner" | "logo" | "favicon"
  ) => {
    setIsUploading(true);

    try {
      // Validar arquivo
      const maxSize = type === "banner" ? 5 : 2; // 5MB para banner, 2MB para outros
      const error = validateImageFile(file, maxSize);
      if (error) {
        toast({
          variant: "destructive",
          title: "Erro no upload",
          description: error,
        });
        return;
      }

      // Converter para base64
      const base64 = await fileToBase64(file);

      // Atualizar estado correspondente
      switch (type) {
        case "banner":
          setBannerUrl(base64);
          break;
        case "logo":
          setLogoUrl(base64);
          break;
        case "favicon":
          setFaviconUrl(base64);
          break;
      }

      toast({
        title: "Upload concluído",
        description:
          "Imagem carregada com sucesso. Clique em Salvar para confirmar as alterações.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro no upload",
        description: "Não foi possível processar o arquivo",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Componente de upload de arquivo
  const FileUploadButton = ({
    type,
    accept,
  }: {
    type: "banner" | "logo" | "favicon";
    accept: string;
  }) => (
    <div>
      <Input
        type="file"
        accept={accept}
        className="hidden"
        id={`${type}-upload`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, type);
          e.target.value = ""; // Reset input
        }}
        disabled={isUploading}
      />
      <Button
        variant="outline"
        size="icon"
        className="h-10 w-10"
        onClick={() => document.getElementById(`${type}-upload`)?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <span className="animate-spin">⏳</span>
        ) : (
          <Upload className="h-4 w-4" />
        )}
      </Button>
    </div>
  );

  // Componente de preview de imagem
  const ImagePreview = ({
    url,
    type,
  }: {
    url: string;
    type: "banner" | "logo" | "favicon";
  }) => {
    if (!url) return null;

    const previewConfigs = {
      banner: {
        containerClass: "aspect-[3/1] bg-muted",
        imageClass: "w-full h-full object-cover",
      },
      logo: {
        containerClass: "p-4",
        imageClass: "max-h-20 object-contain",
      },
      favicon: {
        containerClass: "p-2",
        imageClass: "max-w-full max-h-full",
      },
    };

    const config = previewConfigs[type];

    return (
      <Card
        className={`overflow-hidden mt-2 ${
          type === "favicon" ? "w-16 h-16 flex-shrink-0" : ""
        }`}
      >
        <CardContent className={`p-0 relative ${config.containerClass}`}>
          <img
            src={url}
            alt={`Preview do ${type.charAt(0).toUpperCase() + type.slice(1)}`}
            className={config.imageClass}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src =
                "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWltYWdlLW9mZiI+PHBhdGggZD0iTTIuMiAyLjJMOCAxNWwyLTIgNC0xIDggMTAiLz48cGF0aCBkPSJNMTQuOTUgOC02LjExIDYuMTEiLz48Y2lyY2xlIGN4PSI4IiBjeT0iOCIgcj0iMiIvPjxwYXRoIGQ9Ik0yMS45NSAyMS45IDEzIDE1bC0zLjA3IDIuOTkiLz48cGF0aCBkPSJNMiAyLjJMMjEuOCAyMiIvPjwvc3ZnPg==";
              target.classList.add(
                type === "logo" ? "p-2" : "p-8",
                "opacity-30"
              );
            }}
          />
          <Button
            variant="outline"
            size="icon"
            className="absolute top-2 right-2 bg-white/80 hover:bg-white"
            onClick={() => handleOpenInNewTab(url)}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {/* Banner URL */}
        <div className="space-y-3">
          <Label htmlFor="banner-url">URL do Banner</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                id="banner-url"
                type="url"
                placeholder="https://exemplo.com/banner.jpg"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
              />
            </div>
            <FileUploadButton
              type="banner"
              accept="image/jpeg,image/png,image/webp"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Recomendado: 1200x400 pixels, formatos JPG, PNG ou WebP
          </p>
          {bannerUrl && <ImagePreview url={bannerUrl} type="banner" />}
        </div>

        {/* Logo URL */}
        <div className="space-y-3">
          <Label htmlFor="logo-url">URL da Logo</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                id="logo-url"
                type="url"
                placeholder="https://exemplo.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>
            <FileUploadButton type="logo" accept="image/png,image/svg+xml" />
          </div>
          <p className="text-sm text-muted-foreground">
            Recomendado: 200x50 pixels, formatos PNG ou SVG
          </p>
          {logoUrl && <ImagePreview url={logoUrl} type="logo" />}
        </div>

      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSaveUrls}
          disabled={isSubmitting}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {isSubmitting ? "Salvando..." : "Salvar URLs"}
        </Button>
      </div>
    </div>
  );
}


