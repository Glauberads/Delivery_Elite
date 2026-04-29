import React, { useEffect, useState } from "react";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Order, OrderType } from "@/types";
import { usePaymentMethods } from "@/hooks/useOrders";
import { PaymentMethodSelector } from "@/components/checkout/payment/PaymentMethodSelector";
import { MapPin, Package2, Store } from "lucide-react";
import { OrderItemForm } from "./OrderItemForm";
import { ScrollArea } from "@/components/ui/scroll-area";

// Interface para o produto vindo do banco de dados
interface ProductFromDB {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id?: string;
  image_url?: string;
  available: boolean;
  featured?: boolean;
  created_at: string;
  updated_at?: string;
}

// Interface para erro do Supabase
interface PostgrestError {
  message: string;
  details: string;
  hint?: string;
  code: string;
}

const formSchema = z.object({
  customer: z.object({
    name: z.string().min(2, {
      message: "Nome deve ter pelo menos 2 caracteres.",
    }),
    phone: z.string().min(10, {
      message: "Telefone deve ter pelo menos 10 caracteres.",
    }),
  }),
  items: z.array(
    z.object({
      productId: z.string().min(1, {
        message: "Selecione um produto.",
      }),
      quantity: z.number().min(1, {
        message: "Quantidade deve ser pelo menos 1.",
      }),
      price: z.number(),
      basePrice: z.number().optional(),
      addons: z.array(z.string()).optional(),
    })
  ),
  paymentMethodId: z.string().min(1, {
    message: "Selecione um método de pagamento.",
  }),
  notes: z.string().optional(),
  orderType: z.enum(["delivery", "takeaway", "instore"]),
  tableNumber: z.string().optional(),
  deliveryAddress: z.string().optional().or(z.literal("")),
  deliveryRegionId: z.string().optional(),
});

interface CreateOrderDialogProps {
  onClose: () => void;
  order?: Order;
}

export function CreateOrderDialog({ onClose, order }: CreateOrderDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<ProductFromDB[]>([]);
  const [deliveryRegions, setDeliveryRegions] = useState<
    Array<{ id: string; name: string; fee: number }>
  >([]);
  const { data: paymentMethods = [], isLoading: paymentMethodsLoading } =
    usePaymentMethods();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer: {
        name: order?.customer.name || "",
        phone: order?.customer.phone || "",
      },
      items:
        order?.items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          price: item.price,
          basePrice: item.basePrice,
          addons: item.addons?.map((addon) => addon.addon.id) || [],
        })) || [],
      paymentMethodId: order?.paymentMethod || "",
      notes: order?.notes || "",
      orderType: order?.orderType || "takeaway",
      tableNumber: "",
      deliveryAddress: "",
      deliveryRegionId: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const orderType = form.watch("orderType");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase.from("products").select("*");

        if (error) {
          throw error;
        }

        setProducts(data || []);
      } catch (error: unknown) {
        console.error("Error fetching products:", error);
        if (
          error instanceof Error ||
          (error && typeof error === "object" && "message" in error)
        ) {
          toast.error("Erro ao buscar produtos: " + (error as Error).message);
        } else {
          toast.error("Erro ao buscar produtos");
        }
      }
    };

    fetchData();
  }, []);

  // Buscar regiões de entrega
  useEffect(() => {
    const fetchDeliveryRegions = async () => {
      try {
        const { data, error } = await supabase
          .from("delivery_regions")
          .select("*")
          .order("name");

        if (error) throw error;
        setDeliveryRegions(data || []);
      } catch (error) {
        console.error("Erro ao buscar regiões de entrega:", error);
        toast.error("Erro ao carregar regiões de entrega");
      }
    };

    fetchDeliveryRegions();
  }, []);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      // Calculate subtotal based on order items
      const subtotal = values.items.reduce((sum, item) => sum + item.price, 0);

      // Calculate delivery fee based on selected region
      let deliveryFee = 0;
      if (values.orderType === "delivery" && values.deliveryRegionId) {
        const selectedRegion = deliveryRegions.find(
          (region) => region.id === values.deliveryRegionId
        );
        deliveryFee = selectedRegion ? Number(selectedRegion.fee) : 0;
      }

      const total = subtotal + deliveryFee;

      // Gerar número do pedido
      let orderNumber;
      if (!order) {
        const { data: lastOrder } = await supabase
          .from("orders")
          .select("number")
          .not("number", "like", "DELETED_%")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const lastNumber = lastOrder?.number ? parseInt(lastOrder.number) : 0;
        orderNumber = (lastNumber + 1).toString().padStart(6, "0");
      }

      // Use diretamente o ID do método de pagamento selecionado
      const orderData = {
        number: order?.number || orderNumber,
        customer_name: values.customer.name,
        customer_phone: values.customer.phone,
        payment_method: values.paymentMethodId, // Usar o ID diretamente
        payment_status: "pending",
        status: "pending",
        notes: values.notes,
        subtotal: subtotal,
        total: total,
        delivery_fee: deliveryFee,
        discount: 0,
        order_type: values.orderType,
        table_number:
          values.orderType === "instore" ? values.tableNumber : null,
        delivery_address:
          values.orderType === "delivery" ? values.deliveryAddress : null,
        delivery_region_id:
          values.orderType === "delivery" ? values.deliveryRegionId : null,
      };

      let response;
      let orderId;

      if (order) {
        // Update existing order
        response = await supabase
          .from("orders")
          .update(orderData)
          .eq("id", order.id);

        orderId = order.id;
      } else {
        // Create new order
        response = await supabase.from("orders").insert([orderData]).select();

        if (response.data && response.data.length > 0) {
          orderId = response.data[0].id;
        }
      }

      if (response.error) throw response.error;

      // If we have an order ID and items, handle the order items
      if (orderId) {
        if (order) {
          // Delete existing order items and addons if updating
          const { error: deleteItemsError } = await supabase
            .from("order_items")
            .delete()
            .eq("order_id", orderId);

          if (deleteItemsError) throw deleteItemsError;
        }

        // Insert new order items
        for (const item of values.items) {
          // Insert order item
          const { data: orderItem, error: itemError } = await supabase
            .from("order_items")
            .insert({
              order_id: orderId,
              product_id: item.productId,
              quantity: item.quantity,
              unit_price: item.basePrice || item.price / item.quantity,
              total_price: item.price,
            })
            .select()
            .single();

          if (itemError) throw itemError;

          // Insert order item addons if any
          if (item.addons && item.addons.length > 0) {
            const addonsToInsert = await Promise.all(
              item.addons.map(async (addonId) => {
                // Buscar o preço correto do addon
                const { data: addonData, error: addonError } = await supabase
                  .from("product_addons")
                  .select("price")
                  .eq("id", addonId)
                  .single();

                if (addonError) {
                  console.error("Erro ao buscar preço do addon:", addonError);
                  return {
                    order_item_id: orderItem.id,
                    addon_id: addonId,
                    quantity: 1,
                    unit_price: 0,
                    total_price: 0,
                  };
                }

                const addonPrice = Number(addonData.price);

                return {
                  order_item_id: orderItem.id,
                  addon_id: addonId,
                  quantity: 1,
                  unit_price: addonPrice,
                  total_price: addonPrice,
                };
              })
            );

            const { error: addonsError } = await supabase
              .from("order_item_addons")
              .insert(addonsToInsert);

            if (addonsError) throw addonsError;
          }
        }
      }

      toast.success(
        order ? "Pedido atualizado com sucesso" : "Pedido criado com sucesso"
      );
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      onClose();
    } catch (error: unknown) {
      console.error("Error saving order:", error);
      if (
        error instanceof Error ||
        (error && typeof error === "object" && "message" in error)
      ) {
        toast.error("Erro ao salvar pedido: " + (error as Error).message);
      } else {
        toast.error("Erro ao salvar pedido");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogContent className="max-w-4xl h-[90vh] p-0 flex flex-col">
      <DialogHeader className="p-6 pb-2">
        <DialogTitle>{order ? "Editar Pedido" : "Novo Pedido"}</DialogTitle>
      </DialogHeader>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col h-full"
        >
          <div className="flex-1 min-h-0 flex flex-col">
            <Tabs defaultValue="customer" className="flex-1 flex flex-col">
              <TabsList className="w-full grid grid-cols-4 px-6">
                <TabsTrigger value="customer" className="flex-1">
                  Cliente
                </TabsTrigger>
                <TabsTrigger value="items" className="flex-1">
                  Itens
                </TabsTrigger>
                <TabsTrigger value="orderType" className="flex-1">
                  Tipo de Pedido
                </TabsTrigger>
                <TabsTrigger value="payment" className="flex-1">
                  Pagamento
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-hidden">
                <ScrollArea
                  className={
                    fields.length > 3 ? "h-[calc(90vh-13rem)]" : "h-auto"
                  }
                >
                  <div className="px-6 py-4 space-y-4">
                    <TabsContent value="customer" className="mt-0 space-y-4">
                      <FormField
                        control={form.control}
                        name="customer.name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome do cliente" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="customer.phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Telefone do cliente"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>

                    <TabsContent value="items" className="mt-0">
                      {fields.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[120px] border-2 border-dashed rounded-lg border-muted-foreground/20">
                          <div className="flex flex-col items-center gap-2">
                            <div className="text-muted-foreground">
                              Nenhum item adicionado ao pedido
                            </div>
                            <Button
                              type="button"
                              onClick={() =>
                                append({
                                  productId: "",
                                  quantity: 1,
                                  price: 0,
                                  basePrice: 0,
                                  addons: [],
                                })
                              }
                              variant="default"
                            >
                              Adicionar Item
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`space-y-4 ${
                            fields.length <= 3 ? "min-h-[120px]" : ""
                          }`}
                        >
                          {fields.map((field, index) => (
                            <OrderItemForm
                              key={field.id}
                              index={index}
                              onRemove={() => remove(index)}
                            />
                          ))}
                          <div className="flex justify-center mt-4">
                            <Button
                              type="button"
                              onClick={() =>
                                append({
                                  productId: "",
                                  quantity: 1,
                                  price: 0,
                                  basePrice: 0,
                                  addons: [],
                                })
                              }
                            >
                              Adicionar Item
                            </Button>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="orderType" className="mt-0 space-y-4">
                      <FormField
                        control={form.control}
                        name="orderType"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel>Tipo de Pedido</FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  className={`flex-1 ${
                                    field.value === "delivery"
                                      ? "bg-primary hover:bg-primary"
                                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                  }`}
                                  onClick={() => field.onChange("delivery")}
                                >
                                  <MapPin className="h-4 w-4 mr-2" />
                                  Entrega
                                </Button>
                                <Button
                                  type="button"
                                  className={`flex-1 ${
                                    field.value === "takeaway"
                                      ? "bg-primary hover:bg-primary"
                                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                  }`}
                                  onClick={() => field.onChange("takeaway")}
                                >
                                  <Package2 className="h-4 w-4 mr-2" />
                                  Retirada
                                </Button>
                                <Button
                                  type="button"
                                  className={`flex-1 ${
                                    field.value === "instore"
                                      ? "bg-primary hover:bg-primary"
                                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                  }`}
                                  onClick={() => field.onChange("instore")}
                                >
                                  <Store className="h-4 w-4 mr-2" />
                                  Na Loja
                                </Button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {orderType === "delivery" && (
                        <>
                          <FormField
                            control={form.control}
                            name="deliveryRegionId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Região de Entrega</FormLabel>
                                <FormControl>
                                  <Select
                                    value={field.value}
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      // Atualizar o valor total quando a região é alterada
                                      const selectedRegion =
                                        deliveryRegions.find(
                                          (region) => region.id === value
                                        );
                                      if (selectedRegion) {
                                        const subtotal =
                                          form
                                            .watch("items")
                                            ?.reduce(
                                              (total, item) =>
                                                total + (item.price || 0),
                                              0
                                            ) || 0;
                                        const total =
                                          subtotal + Number(selectedRegion.fee);
                                      }
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione a região" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {deliveryRegions.map((region) => (
                                        <SelectItem
                                          key={region.id}
                                          value={region.id}
                                        >
                                          {region.name} -{" "}
                                          {new Intl.NumberFormat("pt-BR", {
                                            style: "currency",
                                            currency: "BRL",
                                          }).format(Number(region.fee))}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="deliveryAddress"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Endereço de Entrega</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Endereço completo"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}

                      {orderType === "instore" && (
                        <FormField
                          control={form.control}
                          name="tableNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Número da Mesa</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Número da mesa"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </TabsContent>

                    <TabsContent value="payment" className="mt-0 space-y-4">
                      <PaymentMethodSelector
                        form={form}
                        isSubmitting={isLoading}
                        paymentMethods={paymentMethods}
                      />
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Observações</FormLabel>
                            <FormControl>
                              <Input placeholder="Observações" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                  </div>
                </ScrollArea>
              </div>
            </Tabs>
          </div>

          <div className="border-t p-4 bg-background mt-auto">
            <div className="flex items-center justify-between gap-4 max-w-[1200px] mx-auto w-full">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Subtotal:
                  </span>
                  <span className="text-base">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(
                      form
                        .watch("items")
                        ?.reduce(
                          (total, item) => total + (item.price || 0),
                          0
                        ) || 0
                    )}
                  </span>
                </div>
                {orderType === "delivery" && form.watch("deliveryRegionId") && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Taxa de Entrega:
                    </span>
                    <span className="text-base">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(
                        Number(
                          deliveryRegions.find(
                            (region) =>
                              region.id === form.watch("deliveryRegionId")
                          )?.fee || 0
                        )
                      )}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Total:</span>
                  <span className="text-lg font-semibold">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(
                      (form
                        .watch("items")
                        ?.reduce(
                          (total, item) => total + (item.price || 0),
                          0
                        ) || 0) +
                        (orderType === "delivery"
                          ? Number(
                              deliveryRegions.find(
                                (region) =>
                                  region.id === form.watch("deliveryRegionId")
                              )?.fee || 0
                            )
                          : 0)
                    )}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
}



