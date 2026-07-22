import React, { useState, useEffect } from "react";
import { ProductCard, Product, CartProduct } from "./ProductCard";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductGridProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onProductsChange?: () => void;
  isLoading?: boolean;
  isError?: boolean;
  isDragDisabled?: boolean;
  onDragEnd?: (result: DropResult) => void;
}

export function ProductGrid({
  products,
  onEdit,
  onProductsChange,
  isLoading = false,
  isError = false,
  isDragDisabled = false,
  onDragEnd,
}: ProductGridProps) {
  const { toast } = useToast();
  const [localProducts, setLocalProducts] = useState<Product[]>([]);

  useEffect(() => {
    // Only update localProducts when we have products and aren't in an error state
    if (products && products.length > 0 && !isError) {
      setLocalProducts(products);
    }
  }, [products, isError]);

  const handleAddToCart = (product: CartProduct) => {
    // This would normally add the product to the cart
    toast({
      title: "Produto adicionado",
      description: `${product.name} foi adicionado ao pedido`,
    });
  };

  const handleDelete = (productId: string) => {
    // Atualiza a lista local
    setLocalProducts((prev) => prev.filter((p) => p.id !== productId));
    // Notifica o componente pai para atualizar a lista
    if (onProductsChange) {
      onProductsChange();
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="border rounded-md p-4 space-y-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full p-8 text-center">
        <p className="text-muted-foreground">
          Ocorreu um erro ao carregar os produtos.
        </p>
      </div>
    );
  }

  if (localProducts.length === 0) {
    return (
      <div className="w-full p-8 text-center">
        <p className="text-muted-foreground">Nenhum produto cadastrado.</p>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd || (() => {})}>
      <Droppable droppableId="products" direction="horizontal" isDropDisabled={isDragDisabled}>
        {(provided) => (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            {...provided.droppableProps}
            ref={provided.innerRef}
          >
            {localProducts.map((product, index) => (
              <Draggable key={product.id} draggableId={product.id} index={index} isDragDisabled={isDragDisabled}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={{
                      ...provided.draggableProps.style,
                      opacity: snapshot.isDragging ? 0.8 : 1,
                      cursor: isDragDisabled ? 'default' : 'grab'
                    }}
                  >
                    <ProductCard
                      product={product}
                      onAddToCart={handleAddToCart}
                      onEdit={onEdit}
                      onDelete={() => handleDelete(product.id)}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}



