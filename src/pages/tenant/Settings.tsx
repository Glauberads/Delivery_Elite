import React from "react";
import { Clock3, CreditCard, Palette, Store, Globe } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BasicInformationForm } from "@/components/settings/BasicInformationForm";
import { OperatingHoursForm } from "@/components/settings/OperatingHoursForm";
import { PaymentMethodsManager } from "@/components/settings/PaymentMethodsManager";
import { VisualIdentityForm } from "@/components/customization/VisualIdentityForm";
import { ImagesManager } from "@/components/customization/ImagesManager";
import { CustomDomainManager } from "@/components/settings/CustomDomainManager";
import { useAuth } from "@/contexts/AuthContext";

export default function TenantSettings() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col h-full">
      <Header title="Configurações" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.18em] text-orange-500/80 dark:text-orange-300/80">
            Dados da Loja
          </p>
          <h2 className="text-3xl font-heading font-semibold text-slate-900 dark:text-slate-50">
            Configure sua operação
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os dados principais da loja, horários de funcionamento, meios de pagamento e identidade visual.
          </p>
        </div>

        <Tabs defaultValue="general" className="w-full space-y-4 md:space-y-6">
          <TabsList className="flex flex-wrap w-full gap-2 rounded-2xl bg-muted/50 p-1">
            <TabsTrigger value="general" className="flex-1 gap-2 rounded-xl">
              <Store className="h-4 w-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="hours" className="flex-1 gap-2">
              <Clock3 className="h-4 w-4" />
              Horários
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex-1 gap-2">
              <CreditCard className="h-4 w-4" />
              Pagamentos
            </TabsTrigger>
            <TabsTrigger value="customization" className="flex-1 gap-2">
              <Palette className="h-4 w-4" />
              Customização
            </TabsTrigger>
            <TabsTrigger value="domain" className="flex-1 gap-2">
              <Globe className="h-4 w-4" />
              Domínio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-3 space-y-4 md:mt-0">
            <BasicInformationForm />
          </TabsContent>

          <TabsContent value="hours" className="mt-3 space-y-4 md:mt-0">
            <OperatingHoursForm />
          </TabsContent>

          <TabsContent value="payments" className="mt-3 space-y-4 md:mt-0">
            <PaymentMethodsManager />
          </TabsContent>
          
          <TabsContent value="domain" className="mt-3 space-y-4 md:mt-0">
            {user?.tenantId && <CustomDomainManager tenantId={user.tenantId} />}
          </TabsContent>

          <TabsContent value="customization" className="mt-3 space-y-4 md:mt-0">
            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>Identidade visual</CardTitle>
                <CardDescription>
                  Ajuste cores, favicon e elementos visuais da sua loja.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VisualIdentityForm />
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle>Imagens da loja</CardTitle>
                <CardDescription>
                  Gerencie logo, banner e favicon usados na vitrine.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImagesManager />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}



