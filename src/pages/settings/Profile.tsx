import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, KeyRound, Loader2, Mail, Save, UserRound } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buildFullName, splitFullName } from "@/lib/person-name";

type ProfileData = {
  email: string;
  fullName: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Não foi possível atualizar o perfil.";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function Profile() {
  const { user, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    newPassword: "",
    confirmPassword: "",
  });

  const isSuperAdminView = Boolean(user?.isSuperAdmin);

  const { data, isLoading, refetch } = useQuery<ProfileData>({
    queryKey: ["profile", user?.id, user?.tenantId, user?.isSuperAdmin],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) {
        throw new Error("Usuário não autenticado.");
      }

      if (user.isSuperAdmin) {
        const { data: profile, error } = await supabase
          .from("superadmin_users")
          .select("email, first_name, last_name")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;
        if (!profile) throw new Error("Perfil do superadmin não encontrado.");

        return {
          email: profile.email,
          fullName: buildFullName(profile.first_name, profile.last_name) || user.email,
        };
      }

      if (!user.tenantId) {
        throw new Error("Tenant não encontrado para o usuário logado.");
      }

      const { data: tenant, error } = await supabase
        .from("tenants")
        .select("email, full_name")
        .eq("id", user.tenantId)
        .maybeSingle();

      if (error) throw error;
      if (!tenant) throw new Error("Perfil do tenant não encontrado.");

      return {
        email: tenant.email,
        fullName: tenant.full_name || buildFullName(user.firstName, user.lastName) || tenant.email,
      };
    },
  });

  useEffect(() => {
    if (!data) return;

    setForm({
      fullName: data.fullName,
      email: data.email,
      newPassword: "",
      confirmPassword: "",
    });
  }, [data]);

  const trimmedFullName = form.fullName.trim().replace(/\s+/g, " ");
  const normalizedEmail = form.email.trim().toLowerCase();
  const passwordMismatch =
    form.newPassword.length > 0 &&
    form.confirmPassword.length > 0 &&
    form.newPassword !== form.confirmPassword;
  const passwordTooShort = form.newPassword.length > 0 && form.newPassword.length < 6;
  const isNameValid = trimmedFullName.length >= 3;
  const isEmailValid = isValidEmail(normalizedEmail);

  const hasChanges = useMemo(() => {
    if (!data) return false;

    return (
      trimmedFullName !== data.fullName ||
      normalizedEmail !== data.email ||
      form.newPassword.length > 0 ||
      form.confirmPassword.length > 0
    );
  }, [data, form.confirmPassword.length, form.newPassword.length, normalizedEmail, trimmedFullName]);

  const validationMessage = useMemo(() => {
    if (!data) {
      return "";
    }

    if (!isNameValid) {
      return "Informe um nome completo válido.";
    }

    if (!isEmailValid) {
      return "Informe um e-mail válido.";
    }

    if (passwordMismatch) {
      return "A nova senha e a confirmação precisam ser idênticas.";
    }

    if (passwordTooShort) {
      return "A nova senha precisa ter pelo menos 6 caracteres.";
    }

    return "";
  }, [data, isEmailValid, isNameValid, passwordMismatch, passwordTooShort]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || !data || validationMessage) {
      return;
    }

    const { firstName, lastName, normalizedFullName } = splitFullName(trimmedFullName);
    const shouldUpdateName = normalizedFullName !== data.fullName;
    const shouldUpdateEmail = normalizedEmail !== data.email;
    const shouldUpdatePassword = form.newPassword.length > 0;

    setIsSaving(true);

    try {
      if (shouldUpdateName) {
        if (user.isSuperAdmin) {
          const { error } = await supabase
            .from("superadmin_users")
            .update({
              first_name: firstName,
              last_name: lastName,
            })
            .eq("id", user.id);

          if (error) throw error;
        } else {
          if (!user.tenantId) {
            throw new Error("Tenant não encontrado para o usuário logado.");
          }

          const [{ error: tenantError }, { error: tenantUserError }] = await Promise.all([
            supabase
              .from("tenants")
              .update({
                name: normalizedFullName,
                full_name: normalizedFullName,
              })
              .eq("id", user.tenantId),
            supabase
              .from("tenant_users")
              .update({
                first_name: firstName,
                last_name: lastName,
              })
              .eq("id", user.id),
          ]);

          if (tenantError) throw tenantError;
          if (tenantUserError) throw tenantUserError;
        }
      }

      if (shouldUpdateName || shouldUpdateEmail || shouldUpdatePassword) {
        const updatePayload: {
          email?: string;
          password?: string;
          data?: {
            full_name: string;
            first_name: string;
            last_name: string | null;
          };
        } = {
          data: {
            full_name: normalizedFullName,
            first_name: firstName,
            last_name: lastName,
          },
        };

        if (shouldUpdateEmail) {
          updatePayload.email = normalizedEmail;
        }

        if (shouldUpdatePassword) {
          updatePayload.password = form.newPassword;
        }

        const { error } = await supabase.auth.updateUser(updatePayload);

        if (error) throw error;
      }

      if (shouldUpdateEmail) {
        if (user.isSuperAdmin) {
          const { error } = await supabase
            .from("superadmin_users")
            .update({
              email: normalizedEmail,
            })
            .eq("id", user.id);

          if (error) throw error;
        } else {
          if (!user.tenantId) {
            throw new Error("Tenant não encontrado para o usuário logado.");
          }

          const [{ error: tenantError }, { error: tenantUserError }] = await Promise.all([
            supabase
              .from("tenants")
              .update({
                email: normalizedEmail,
              })
              .eq("id", user.tenantId),
            supabase
              .from("tenant_users")
              .update({
                email: normalizedEmail,
              })
              .eq("id", user.id),
          ]);

          if (tenantError) throw tenantError;
          if (tenantUserError) throw tenantUserError;
        }
      }

      await refreshUserProfile();
      await refetch();

      setForm((prev) => ({
        ...prev,
        newPassword: "",
        confirmPassword: "",
      }));

      toast({
        title: "Perfil atualizado",
        description: shouldUpdateEmail
          ? "Perfil salvo. Verifique o novo e-mail para confirmar a alteração."
          : "Seus dados foram atualizados com sucesso.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Falha ao atualizar perfil",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const containerClassName = isSuperAdminView
    ? "p-6 space-y-6"
    : "mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6";
  const cardClassName = isSuperAdminView
    ? "border-zinc-800 bg-zinc-900 text-white"
    : "border-slate-200/80 bg-white text-slate-900 shadow-xl shadow-slate-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-slate-50 dark:shadow-black/30";
  const mutedTextClassName = isSuperAdminView ? "text-zinc-400" : "text-slate-600 dark:text-zinc-400";
  const labelClassName = isSuperAdminView ? "text-zinc-200" : "text-slate-700 dark:text-zinc-200";
  const inputClassName = isSuperAdminView
    ? "border-zinc-700 bg-zinc-950 text-white"
    : "border-slate-300 bg-white text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
  const infoCardClassName = isSuperAdminView
    ? "rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5"
    : "rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/60";

  return (
    <div className="min-h-full text-slate-900 dark:text-slate-50">
      {!isSuperAdminView ? <Header title="Meu Perfil" /> : null}

      <div className={containerClassName}>
        <div className="space-y-2">
          <p className={isSuperAdminView ? "text-sm uppercase tracking-[0.18em] text-orange-400/80" : "text-sm uppercase tracking-[0.18em] text-orange-500/80 dark:text-orange-300/80"}>
            {isSuperAdminView ? "Super Admin" : "Conta da Loja"}
          </p>
          <h1 className={isSuperAdminView ? "text-3xl font-semibold text-white" : "text-3xl font-heading font-semibold text-slate-900 dark:text-slate-50"}>
            Gerencie seu perfil
          </h1>
          <p className={`text-sm ${mutedTextClassName}`}>
            Atualize seu nome de exibição, e-mail de acesso e senha com segurança.
          </p>
        </div>

        {validationMessage ? (
          <Alert variant="destructive" className={isSuperAdminView ? "border-red-500/30 bg-red-500/10 text-red-100" : "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-100"}>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Validação pendente</AlertTitle>
            <AlertDescription>{validationMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Card className={cardClassName}>
          <CardHeader>
            <CardTitle className={isSuperAdminView ? "text-2xl text-white" : "text-2xl text-slate-900 dark:text-slate-50"}>
              Dados de acesso
            </CardTitle>
            <CardDescription className={mutedTextClassName}>
              Caso necessário, você pode alterar seu e-mail de acesso e senha aqui.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className={`flex items-center gap-3 rounded-2xl border p-4 text-sm ${isSuperAdminView ? "border-zinc-800 bg-zinc-950/60 text-zinc-400" : "border-slate-200 bg-slate-50 text-slate-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400"}`}>
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando perfil...
              </div>
            ) : (
              <form className="grid gap-6 lg:grid-cols-2" onSubmit={handleSave}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="profile-full-name" className={labelClassName}>
                      Nome Completo
                    </Label>
                    <div className="relative">
                      <UserRound className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${isSuperAdminView ? "text-zinc-500" : "text-slate-400 dark:text-zinc-500"}`} />
                      <Input
                        id="profile-full-name"
                        value={form.fullName}
                        onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                        className={`pl-10 ${inputClassName}`}
                        placeholder="Seu nome completo"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="profile-email" className={labelClassName}>
                      E-mail
                    </Label>
                    <div className="relative">
                      <Mail className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${isSuperAdminView ? "text-zinc-500" : "text-slate-400 dark:text-zinc-500"}`} />
                      <Input
                        id="profile-email"
                        type="email"
                        value={form.email}
                        onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                        className={`pl-10 ${inputClassName}`}
                        placeholder="voce@delivery.pro"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="profile-password" className={labelClassName}>
                        Nova Senha
                      </Label>
                      <div className="relative">
                        <KeyRound className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${isSuperAdminView ? "text-zinc-500" : "text-slate-400 dark:text-zinc-500"}`} />
                        <Input
                          id="profile-password"
                          type="password"
                          value={form.newPassword}
                          onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                          className={`pl-10 ${inputClassName}`}
                          placeholder="Mínimo de 6 caracteres"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="profile-confirm-password" className={labelClassName}>
                        Confirmar Nova Senha
                      </Label>
                      <div className="relative">
                        <KeyRound className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${isSuperAdminView ? "text-zinc-500" : "text-slate-400 dark:text-zinc-500"}`} />
                        <Input
                          id="profile-confirm-password"
                          type="password"
                          value={form.confirmPassword}
                          onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                          className={`pl-10 ${inputClassName}`}
                          placeholder="Repita a nova senha"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className={infoCardClassName}>
                  <p className={`text-xs uppercase tracking-[0.16em] ${isSuperAdminView ? "text-zinc-500" : "text-slate-500 dark:text-zinc-500"}`}>
                    Email de acesso
                  </p>
                  <h3 className={isSuperAdminView ? "mt-2 text-xl font-semibold text-white break-all" : "mt-2 text-xl font-semibold text-slate-900 dark:text-slate-50 break-all"}>
                    {normalizedEmail || data?.email || user?.email || "-"}
                  </h3>

                  <div className={`mt-6 space-y-3 rounded-2xl border p-4 text-sm ${isSuperAdminView ? "border-zinc-800 bg-black/20 text-zinc-300" : "border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-black/20 dark:text-zinc-300"}`}>
                    <div className="flex items-center justify-between gap-4">
                      <span className={isSuperAdminView ? "text-zinc-500" : "text-slate-500 dark:text-zinc-500"}>Perfil</span>
                      <span className={isSuperAdminView ? "text-zinc-100" : "text-slate-900 dark:text-zinc-100"}>
                        {isSuperAdminView ? "superadmin" : "tenant"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className={isSuperAdminView ? "text-zinc-500" : "text-slate-500 dark:text-zinc-500"}>ID da Loja</span>
                      <span className={isSuperAdminView ? "font-mono text-xs text-zinc-200" : "font-mono text-xs text-slate-700 dark:text-zinc-200"}>
                        {user?.id ?? "-"}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSaving || isLoading || !hasChanges || Boolean(validationMessage)}
                    className={isSuperAdminView ? "mt-6 w-full bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60" : "mt-6 w-full bg-orange-500 text-white hover:bg-orange-400 disabled:opacity-60"}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Salvar perfil
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



