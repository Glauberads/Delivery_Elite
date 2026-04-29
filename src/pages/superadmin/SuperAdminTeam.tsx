import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type SuperadminRole = "superadmin" | "support";

interface TeamForm {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: SuperadminRole;
}

export default function SuperAdminTeam() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<TeamForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["superadmin", "team"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("superadmin_users")
        .select("id, email, first_name, last_name, role")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  const saveProfile = async () => {
    if (!editing) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("superadmin_users")
        .update({
          first_name: editing.first_name,
          last_name: editing.last_name,
          role: editing.role,
        })
        .eq("id", editing.id);

      if (error) throw error;

      toast({
        title: "Equipe atualizada",
        description: "Os dados do membro superadmin foram atualizados.",
      });

      setEditing(null);
      await refetch();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar equipe",
        description: error instanceof Error ? error.message : "Erro desconhecido.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Equipe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestão dos perfis superadmin já provisionados no Supabase Auth.
        </p>
      </div>

      <Card className="border-border/60 bg-card text-card-foreground">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground">Membros da equipe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
            A criação de novos membros ainda exige provisionamento seguro no <code>auth.users</code>.
            Para manter a arquitetura limpa e sem gambiarra, esta tela edita perfis já existentes.
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-border/60">
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-border/60">
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    Carregando equipe...
                  </TableCell>
                </TableRow>
              ) : (data ?? []).length === 0 ? (
                <TableRow className="border-border/60">
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    Nenhum superadmin encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                (data ?? []).map((member) => (
                  <TableRow key={member.id} className="border-border/60">
                    <TableCell>{`${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || "-"}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-border text-foreground">
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="icon" onClick={() => setEditing(member as TeamForm)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Editar membro da equipe</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editing.email} disabled className="bg-muted/40" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={editing.first_name}
                    onChange={(e) => setEditing((prev) => (prev ? { ...prev, first_name: e.target.value } : prev))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sobrenome</Label>
                  <Input
                    value={editing.last_name}
                    onChange={(e) => setEditing((prev) => (prev ? { ...prev, last_name: e.target.value } : prev))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select value={editing.role} onValueChange={(value: SuperadminRole) => setEditing((prev) => (prev ? { ...prev, role: value } : prev))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadmin">superadmin</SelectItem>
                    <SelectItem value="support">support</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveProfile} disabled={isSaving} className="bg-orange-500 hover:bg-orange-600 text-white">
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



