
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Trash2, Plus, ArrowUp, ArrowDown, Upload, ExternalLink } from "lucide-react";
import { fileToBase64, validateImageFile } from "@/utils/image-utils";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type CategoryInsert = Database["public"]["Tables"]["categories"]["Insert"];

type CategoryFormData = {
  name: string;
  description: string;
  image_url: string;
  display_order: number;
};

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "Erro desconhecido.";
}

interface CategoryManagerProps {
  open: boolean;
  onClose: () => void;
  onCategoriesUpdated: () => void;
  categories: CategoryRow[];
}

export function CategoryManager({ open, onClose, onCategoriesUpdated, categories }: CategoryManagerProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: "",
    description: "",
    image_url: "",
    display_order: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name || "",
        description: editingCategory.description || "",
        image_url: editingCategory.image_url || "",
        display_order: editingCategory.display_order || 0,
      });
    } else {
      // For new category, set display_order to next available number
      const maxOrder = categories.reduce(
        (max, cat) => (typeof cat.display_order === "number" && cat.display_order > max ? cat.display_order : max),
        0
      );

      setFormData({
        name: "",
        description: "",
        image_url: "",
        display_order: maxOrder + 1,
      });
    }
  }, [editingCategory, categories]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "display_order" ? Number(value) : value,
    }));
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);

    try {
      const error = validateImageFile(file, 2);
      if (error) {
        toast({
          variant: "destructive",
          title: "Erro no upload",
          description: error,
        });
        return;
      }

      const base64 = await fileToBase64(file);
      setFormData((prev) => ({ ...prev, image_url: base64 }));

      toast({
        title: "Upload concluído",
        description: "Imagem carregada com sucesso.",
      });
    } catch (_) {
      toast({
        variant: "destructive",
        title: "Erro no upload",
        description: "Não foi possível processar o arquivo.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenInNewTab = (url: string) => {
    if (!url) return;

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
      return;
    }

    window.open(url, "_blank");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("categories")
          .update(formData)
          .eq("id", editingCategory.id);

        if (error) throw error;

        toast({
          title: "Categoria atualizada",
          description: "A categoria foi atualizada com sucesso.",
        });
      } else {
        if (!user?.tenantId) {
          throw new Error("Tenant não identificado para criar a categoria.");
        }

        const insertPayload: CategoryInsert = {
          ...formData,
          tenant_id: user.tenantId,
        };

        const { error } = await supabase
          .from("categories")
          .insert(insertPayload);

        if (error) throw error;

        toast({
          title: "Categoria criada",
          description: "A categoria foi criada com sucesso.",
        });
      }

      onCategoriesUpdated();
      setShowForm(false);
      setEditingCategory(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: getErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCategory = (category: CategoryRow) => {
    setEditingCategory(category);
    setShowForm(true);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      // Check if category has products
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id")
        .eq("category_id", categoryId);

      if (productsError) throw productsError;

      if (products.length > 0) {
        toast({
          variant: "destructive",
          title: "Não é possível excluir",
          description: "Esta categoria possui produtos associados. Remova os produtos primeiro.",
        });
        return;
      }

      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", categoryId);

      if (error) throw error;

      toast({
        title: "Categoria excluída",
        description: "A categoria foi excluída com sucesso.",
      });

      onCategoriesUpdated();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: getErrorMessage(error),
      });
    }
  };

  const handleMoveCategory = async (categoryId: string, direction: "up" | "down") => {
    const categoryIndex = categories.findIndex((cat) => cat.id === categoryId);
    if (categoryIndex === -1) return;

    const currentCategory = categories[categoryIndex];

    if (direction === "up" && categoryIndex > 0) {
      const prevCategory = categories[categoryIndex - 1];

      try {
        await supabase
          .from("categories")
          .update({ display_order: prevCategory.display_order })
          .eq("id", currentCategory.id);

        await supabase
          .from("categories")
          .update({ display_order: currentCategory.display_order })
          .eq("id", prevCategory.id);

        onCategoriesUpdated();
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: getErrorMessage(error),
        });
      }
    } else if (direction === "down" && categoryIndex < categories.length - 1) {
      const nextCategory = categories[categoryIndex + 1];

      try {
        await supabase
          .from("categories")
          .update({ display_order: nextCategory.display_order })
          .eq("id", currentCategory.id);

        await supabase
          .from("categories")
          .update({ display_order: currentCategory.display_order })
          .eq("id", nextCategory.id);

        onCategoriesUpdated();
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: getErrorMessage(error),
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Gerenciar Categorias</DialogTitle>
        </DialogHeader>

        {!showForm ? (
          <>
            <div className="flex justify-end mb-4">
              <Button onClick={() => {
                setEditingCategory(null);
                setShowForm(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Categoria
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ordem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMoveCategory(category.id, "up")}
                          disabled={categories.indexOf(category) === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMoveCategory(category.id, "down")}
                          disabled={categories.indexOf(category) === categories.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        {category.display_order}
                      </div>
                    </TableCell>
                    <TableCell>{category.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {category.description}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditCategory(category)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCategory(category.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {categories.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      Nenhuma categoria encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <DialogFooter>
              <Button onClick={onClose}>Fechar</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[7fr_3fr]">
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
                <Label htmlFor="display_order">Posição</Label>
                <Input
                  id="display_order"
                  name="display_order"
                  type="number"
                  value={formData.display_order}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image_url">Imagem da Categoria</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    id="image_url"
                    name="image_url"
                    value={formData.image_url}
                    onChange={handleChange}
                    placeholder="https://exemplo.com/imagem.jpg"
                  />
                </div>
                <div>
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml,image/x-icon"
                    className="hidden"
                    id="category-image-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFileUpload(file);
                      e.target.value = "";
                    }}
                    disabled={isUploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => document.getElementById("category-image-upload")?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? <span className="animate-spin">⏳</span> : <Upload className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Recomendado: 800x600 pixels, formatos JPG, PNG, WebP, SVG ou ICO.
              </p>

              {formData.image_url && (
                <div className="mt-2">
                  <div className="relative w-[35%] max-w-[170px] overflow-hidden rounded-md border">
                    <img
                      src={formData.image_url}
                      alt="Preview da Categoria"
                      className="aspect-square w-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src =
                          "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLWltYWdlLW9mZiI+PHBhdGggZD0iTTIuMiAyLjJMOCAxNWwyLTIgNC0xIDggMTAiLz48cGF0aCBkPSJNMTQuOTUgOC02LjExIDYuMTEiLz48Y2lyY2xlIGN4PSI4IiBjeT0iOCIgcj0iMiIvPjxwYXRoIGQ9Ik0yMS45NSAyMS45IDEzIDE1bC0zLjA3IDIuOTkiLz48cGF0aCBkPSJNMiAyLjJMMjEuOCAyMiIvPjwvc3ZnPg==";
                        target.classList.add("p-8", "opacity-30");
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                      onClick={() => handleOpenInNewTab(formData.image_url)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingCategory(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Salvando..."
                  : editingCategory
                    ? "Salvar Alterações"
                    : "Criar Categoria"
                }
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}



