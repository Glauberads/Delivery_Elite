import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-password-reset-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          redirectTo,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string" && payload.error.trim().length > 0
            ? payload.error
            : "Nao foi possivel processar a recuperacao de senha.",
        );
      }

      toast({
        title: "Solicitação registrada",
        description:
          typeof payload?.message === "string" && payload.message.trim().length > 0
            ? payload.message
            : "Se existir uma conta vinculada a este e-mail, enviaremos as instruções em instantes.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Falha ao solicitar recuperação",
        description: error instanceof Error ? error.message : "Erro inesperado ao solicitar a recuperação.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Recuperar senha</CardTitle>
            <CardDescription>
              Informe o e-mail da sua conta para receber o link seguro de redefinição.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-email">E-mail</Label>
                <Input
                  id="recovery-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full delivery-gradient" disabled={isSubmitting}>
                {isSubmitting ? "Enviando..." : "Enviar"}
              </Button>
              <Link to="/login" className="text-sm text-gray-400 transition-colors hover:text-orange-500">
                Voltar para o login
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}



