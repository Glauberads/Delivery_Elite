import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserProfile } from "@/components/users/UserProfile";
import { UserPassword } from "@/components/users/UserPassword";
import { Header } from "@/components/layout/Header";

export default function Users() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Usuários" />

      <div className="flex-1 p-4 md:p-6 space-y-4">
        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="password">Senha</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <UserProfile />
          </TabsContent>

          <TabsContent value="password" className="space-y-4">
            <UserPassword />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}



