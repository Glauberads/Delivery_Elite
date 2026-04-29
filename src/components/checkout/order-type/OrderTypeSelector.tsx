import React from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Package2 } from "lucide-react";

type OrderType = "delivery" | "takeaway" | "instore";

interface OrderTypeSelectorProps {
  orderType: OrderType;
  onChange: (type: OrderType) => void;
  isSubmitting: boolean;
}

export function OrderTypeSelector({
  orderType,
  onChange,
  isSubmitting,
}: OrderTypeSelectorProps) {
  return (
    <div>
      <h3 className="text-lg font-medium mb-3">Tipo de Pedido</h3>
      <div className="flex gap-2">
        <Button
          type="button"
          className={`flex-1 ${
            orderType === "delivery"
              ? "bg-red-500 hover:bg-red-600"
              : "bg-white text-black border hover:bg-gray-100"
          }`}
          onClick={() => onChange("delivery")}
          disabled={isSubmitting}
        >
          <MapPin className="h-4 w-4 mr-1" />
          Entrega
        </Button>
        <Button
          type="button"
          className={`flex-1 ${
            orderType === "takeaway"
              ? "bg-red-500 hover:bg-red-600"
              : "bg-white text-black border hover:bg-gray-100"
          }`}
          onClick={() => onChange("takeaway")}
          disabled={isSubmitting}
        >
          <Package2 className="h-4 w-4 mr-1" />
          Retirada
        </Button>
        <Button
          type="button"
          className={`flex-1 ${
            orderType === "instore"
              ? "bg-red-500 hover:bg-red-600"
              : "bg-white text-black border hover:bg-gray-100"
          }`}
          onClick={() => onChange("instore")}
          disabled={isSubmitting}
        >
          <MapPin className="h-4 w-4 mr-1" />
          Na Loja
        </Button>
      </div>
    </div>
  );
}



