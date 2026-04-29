import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImagesManager } from "@/components/customization/ImagesManager";
import { Header } from "@/components/layout/Header";

const Customization = () => {
  return (
    <div className="flex flex-col h-full">
      <Header title="Customização" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Gerenciar Imagens</CardTitle>
            <CardDescription>
              Configure URLs para as imagens do seu restaurante
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImagesManager />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Customization;



