import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

function readRecoveryTokensFromHash() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const type = params.get("type");

  if (!accessToken || !refreshToken || type !== "recovery") {
    return null;
  }

  return { accessToken, refreshToken };
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparing, setIsPreparing] = useState(true);
  const [isRecoveryReady, setIsRecoveryReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const prepareRecoverySession = async () => {
      const tokens = readRecoveryTokensFromHash();

      if (!tokens) {
        const { data } = await supabase.auth.getSession();

        if (!isMounted) return;

        setIsRecoveryReady(Boolean(data.session));
        setIsPreparing(false);
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      if (!isMounted) return;

      if (error) {
        toast({
          variant: "destructive",
          title: "Link inválido",
          description: "O link de recuperação expirou ou não é mais válido.",
        });
        setIsRecoveryReady(false);
      } else {
        window.history.replaceState({}, document.title, "/reset-password");
        setIsRecoveryReady(true);
      }

      setIsPreparing(false);
    };

    void prepareRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Senha inválida",
        description: "A nova senha precisa ter pelo menos 6 caracteres.",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Confirmação diferente",
        description: "Repita a mesma senha nos dois campos.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Senha atualizada",
        description: "Sua senha foi redefinida com sucesso. Faça login novamente.",
      });

      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Falha ao atualizar senha",
        description: error instanceof Error ? error.message : "Erro inesperado ao atualizar a senha.",
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
            <CardTitle>Nova senha</CardTitle>
            <CardDescription>
              Defina uma nova senha para concluir a recuperação da sua conta.
            </CardDescription>
          </CardHeader>

          {isPreparing ? (
            <CardContent className="text-sm text-muted-foreground">
              Validando seu link de recuperação...
            </CardContent>
          ) : isRecoveryReady ? (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full delivery-gradient" disabled={isSubmitting}>
                  {isSubmitting ? "Salvando..." : "Salvar nova senha"}
                </Button>
              </CardFooter>
            </form>
          ) : (
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                O link de recuperação não é mais válido. Solicite um novo envio para continuar.
              </p>
              <Link to="/forgot-password" className="text-sm text-gray-400 transition-colors hover:text-orange-500">
                Solicitar novo link
              </Link>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}



