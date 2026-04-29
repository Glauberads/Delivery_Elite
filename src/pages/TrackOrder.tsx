import React, { useState, useEffect } from "react";
import { OrderTracker } from "@/components/tracking/OrderTracker";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function TrackOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Validar se o orderId existe
    if (!orderId) {
      console.error("Nenhum ID de pedido fornecido na URL");
      setTimeout(() => navigate("/"), 3000);
    } else {
      setLoading(false);
    }
  }, [orderId, navigate]);

  if (!orderId) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex flex-col items-center justify-center">
        <div className="max-w-md text-center p-6">
          <h1 className="text-2xl font-bold mb-4">Erro ao rastrear pedido</h1>
          <p className="text-muted-foreground mb-6">
            Nenhum ID de pedido foi fornecido. Você será redirecionado para a
            página inicial em alguns segundos.
          </p>
          <Button onClick={() => navigate("/")}>Voltar para o menu</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <OrderTracker />
    </div>
  );
}



