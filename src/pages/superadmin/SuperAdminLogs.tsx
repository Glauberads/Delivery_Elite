import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Search, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SystemLog {
  id: string;
  user_id: string | null;
  tenant_id: string | null;
  action: string;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
  users?: { email: string };
  tenants?: { slug: string; name: string };
}

export default function SuperAdminLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["superadmin", "logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_logs")
        .select(`
          id, action, description, metadata, created_at, user_id, tenant_id,
          users:user_id(email),
          tenants:tenant_id(slug, name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Erro ao buscar logs:", error);
        throw error;
      }
      return (data as any) as SystemLog[];
    },
  });

  const filteredLogs = logs?.filter((log) => {
    const search = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(search) ||
      log.description?.toLowerCase().includes(search) ||
      log.users?.email?.toLowerCase().includes(search) ||
      log.tenants?.slug?.toLowerCase().includes(search)
    );
  }) ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          Logs Gerais do Sistema
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Auditoria de ações realizadas na plataforma. Apenas superadmins têm acesso.
        </p>
      </div>

      <Card className="border-border/60 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Atividades recentes (últimos 100)</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar logs..."
                className="pl-8 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      Carregando logs...
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      Nenhum log encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.action.includes('error') ? 'destructive' : 'outline'} className="text-[10px] uppercase">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[150px]" title={log.users?.email}>
                        {log.users?.email || "Sistema"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.tenants ? (
                          <span title={log.tenants.name}>{log.tenants.slug}</span>
                        ) : (
                          <span className="text-muted-foreground italic">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[300px]" title={log.description}>
                        {log.description}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedLog(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl bg-background border-border">
          <DialogHeader>
            <DialogTitle>Detalhes do Log</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-muted-foreground block text-xs uppercase">Ação</span>
                  <span>{selectedLog.action}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block text-xs uppercase">Data</span>
                  <span>{format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss")}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block text-xs uppercase">Usuário</span>
                  <span>{selectedLog.users?.email || "Sistema"} ({selectedLog.user_id || "N/A"})</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block text-xs uppercase">Tenant</span>
                  <span>{selectedLog.tenants?.name || "N/A"} ({selectedLog.tenant_id || "N/A"})</span>
                </div>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground block text-xs uppercase mb-1">Descrição</span>
                <p className="text-sm">{selectedLog.description}</p>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground block text-xs uppercase mb-1">Metadados (JSON)</span>
                <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-[300px] border border-border/50">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
