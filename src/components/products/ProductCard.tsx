import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Star } from "lucide-react";
import { ProductDetailDialog } from "@/components/home/ProductDetailDialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Product as TypeProduct, ProductAddon } from "@/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Tipo estendido para acomodar image_url do backend
export interface Product extends TypeProduct {
  image_url?: string;
  category_id?: string;
}

// Interface adicional para produtos no carrinho
export interface CartProduct
  extends Omit<Product, "category" | "createdAt" | "addons"> {
  quantity: number;
  selectedAddons?: ProductAddon[];
  notes?: string;
}

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: CartProduct) => void;
  onEdit: (product: Product) => void;
  onDelete?: () => void;
}

export function ProductCard({
  product,
  onAddToCart,
  onEdit,
  onDelete,
}: ProductCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [hasAddons, setHasAddons] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkProductAddons = async () => {
      if (!product?.id) return;

      try {
        const { data, error } = await supabase.rpc(
          "get_product_addon_relations"
        );
        if (error) throw error;

        // Check if this product has any addons
        const productAddons = (data || []).filter(
          (relation) => relation.product_id === product.id
        );
        setHasAddons(productAddons.length > 0);
      } catch (error) {
        console.error("Error checking product addons:", error);
      }
    };

    checkProductAddons();
  }, [product]);

  const handleDelete = async () => {
    if (!product?.id) return;

    setIsDeleting(true);
    try {
      // Primeiro, excluir as relações com adicionais
      const { error: relationsError } = await supabase
        .from("product_addon_relations")
        .delete()
        .eq("product_id", product.id);

      if (relationsError) throw relationsError;

      // Depois, excluir o produto
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);

      if (error) throw error;

      toast({
        title: "Produto excluído",
        description: "O produto foi excluído com sucesso.",
      });

      if (onDelete) {
        onDelete();
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: errorMessage,
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // Função para obter a URL da imagem, tentando os dois campos possíveis
  const getImageUrl = () => {
    return product.image_url || product.imageUrl || "/placeholder.svg";
  };

  return (
    <>
      <Card className="overflow-hidden card-hover">
        <div className="relative aspect-square overflow-hidden">
          <img
            src={getImageUrl()}
            alt={product.name}
            className="object-cover w-full h-full transition-transform hover:scale-105"
          />
          {product.featured && (
            <Badge className="absolute top-2 right-2 bg-delivery-500 hover:bg-delivery-600">
              <Star className="h-3 w-3 mr-1 fill-current" /> Destaque
            </Badge>
          )}
          <div className="absolute top-2 left-2 flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="bg-white/80 hover:bg-white p-1"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(product);
              }}
            >
              <Pencil className="h-4 w-4 text-gray-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="bg-white/80 hover:bg-white p-1"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 text-gray-600" />
            </Button>
          </div>
        </div>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg mb-1 line-clamp-1">
              {product.name}
            </h3>
            {hasAddons && (
              <Badge
                variant="outline"
                className="bg-delivery-50 text-delivery-700 border-delivery-300"
              >
                +Adicionais
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
            {product.description}
          </p>
          <div className="text-2xl font-bold text-delivery-500">
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(product.price)}
          </div>
        </CardContent>
      </Card>

      {onAddToCart && (
        <ProductDetailDialog
          product={
            hasAddons
              ? {
                  id: product.id,
                  name: product.name,
                  description: product.description,
                  price: product.price,
                  imageUrl: getImageUrl(),
                  category: product.category,
                  available: product.available,
                  featured: product.featured || false,
                  createdAt: product.createdAt || new Date(),
                }
              : null
          }
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onAddToCart={(product, quantity, selectedAddons, notes) => {
            if (onAddToCart) {
              onAddToCart({
                id: product.id,
                name: product.name,
                description: product.description,
                price: product.price,
                imageUrl: product.imageUrl,
                available: product.available,
                featured: product.featured || false,
                selectedAddons,
                notes,
                quantity,
              } as CartProduct);
              setDialogOpen(false);
            }
          }}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o produto "{product?.name}"? Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}



