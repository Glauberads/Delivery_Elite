import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { OrderStatus } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export function RecentOrders() {
  const { data: orders } = useQuery({
    queryKey: ["recent-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      return data;
    },
  });

  function getStatusConfig(status: OrderStatus) {
    switch (status) {
      case "pending":
        return { label: "Pendente", variant: "outline" as const };
      case "confirmed":
        return { label: "Confirmado", variant: "secondary" as const };
      case "preparing":
        return { label: "Em preparo", variant: "default" as const };
      case "ready":
        return { label: "Pronto", variant: "default" as const };
      case "out_for_delivery":
        return { label: "Em entrega", variant: "delivery" as const };
      case "delivered":
        return { label: "Entregue", variant: "success" as const };
      case "canceled":
        return { label: "Cancelado", variant: "destructive" as const };
    }
  }

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Pedidos Recentes</CardTitle>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {orders?.map((order) => {
            const statusConfig = getStatusConfig(order.status as OrderStatus);
            const customerInitials = order.customer_name
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .toUpperCase();

            return (
              <div key={order.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-muted">
                      {customerInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{order.customer_name}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <span>#{order.number}</span>
                      <span>•</span>
                      <span>{format(new Date(order.created_at), "HH:mm")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-medium">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(order.total)}
                  </div>
                  <Badge
                    variant={
                      statusConfig.variant === "delivery"
                        ? "default"
                        : statusConfig.variant
                    }
                    className={cn(
                      statusConfig.variant === "delivery" &&
                        "bg-delivery-500 hover:bg-delivery-600",
                      statusConfig.variant === "success" &&
                        "bg-success-500 hover:bg-success-600"
                    )}
                  >
                    {statusConfig.label}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}



