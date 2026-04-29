import React, { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BasicInformationForm } from "@/components/settings/BasicInformationForm";
import { OperatingHoursForm } from "@/components/settings/OperatingHoursForm";
import { DeliverySettingsForm } from "@/components/settings/DeliverySettingsForm";
import { PaymentMethodsManager } from "@/components/settings/PaymentMethodsManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function RestaurantSettings() {
  const [signupEnabled, setSignupEnabled] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("signupEnabled");
      if (stored !== null) {
        setSignupEnabled(stored === "true");
      }
    } catch (_) {
      // ignore storage errors and keep default
    }
  }, []);

  const handleToggleSignup = (value: boolean) => {
    try {
      localStorage.setItem("signupEnabled", String(value));
    } catch (_) {
      // ignore storage errors
    }
    setSignupEnabled(value);
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Configurações do Restaurante" />

      <div className="flex-1 p-4 md:p-6 space-y-4">
        {/* Seção de Autenticação - controle de exibição do cadastro */}
        <Card>
          <CardHeader>
            <CardTitle>Autenticação</CardTitle>
            <CardDescription>
              Controle a disponibilidade do formulário de cadastro de novos usuários no login.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base">Permitir cadastro de novos usuários</Label>
                <p className="text-sm text-muted-foreground">
                  Quando desabilitado, a aba de cadastro não será exibida na tela de login.
                </p>
              </div>
              <Switch checked={signupEnabled} onCheckedChange={handleToggleSignup} />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="info" className="space-y-4">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="info">Informações Básicas</TabsTrigger>
            <TabsTrigger value="hours">Horários</TabsTrigger>
            <TabsTrigger value="delivery">Entregas</TabsTrigger>
            <TabsTrigger value="payments">Pagamentos</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4">
            <BasicInformationForm />
          </TabsContent>

          <TabsContent value="hours" className="space-y-4">
            <OperatingHoursForm />
          </TabsContent>

          <TabsContent value="delivery" className="space-y-4">
            <DeliverySettingsForm />
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <PaymentMethodsManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}



