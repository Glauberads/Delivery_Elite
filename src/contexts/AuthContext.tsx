import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AuthApiError } from "@supabase/supabase-js";
import type { Session, User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { splitFullName } from "@/lib/person-name";

type TenantUserRole = Database["public"]["Enums"]["tenant_user_role"];
type SuperAdminRole = Database["public"]["Enums"]["superadmin_role"];
type AuthUserRole = TenantUserRole | SuperAdminRole;

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: AuthUserRole;
  tenantId: string | null; // null para superadmins
  tenantName: string | null;
  tenantStatus: string | null;
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  isSuperAdmin: boolean;
  needsOnboarding: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    fullName: string,
    cpfCnpj: string,
    storeName: string,
    whatsapp: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<AuthUser | null>;
}

type SignupEmailResponse = {
  success: boolean;
  message?: string;
};

type TenantSubscriptionSnapshot = Pick<
  Database["public"]["Tables"]["tenant_subscriptions"]["Row"],
  "status" | "current_period_end" | "current_period_start" | "created_at" | "updated_at"
>;

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocorreu um erro inesperado.";
}

async function getFunctionErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Erro desconhecido ao chamar a Edge Function.";
  }

  const invokeError = error as Error & { context?: Response };

  if (invokeError.context) {
    try {
      const payload = await invokeError.context.json();
      console.error("Edge Function response body", payload);

      if (typeof payload?.error === "string" && payload.error.trim().length > 0) {
        return payload.error;
      }

      const detailKeys = ["msg", "message", "error_description", "error"] as const;
      for (const key of detailKeys) {
        const value = payload?.details?.[key];
        if (typeof value === "string" && value.trim().length > 0) {
          return value;
        }
      }
    } catch (parseError) {
      console.error("Edge Function response body parse error", parseError);
    }
  }

  return error.message;
}

async function sendSignupEmail(payload: {
  email: string;
  password: string;
  fullName: string;
  storeName: string;
  cpfCnpj: string;
  whatsapp: string;
  redirectTo?: string;
}) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-signup-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(payload),
  });

  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("send-signup-email response body", responseBody);

    const detailKeys = ["msg", "message", "error_description", "error"] as const;
    const detailedMessage = detailKeys
      .map((key) => responseBody?.details?.[key])
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);

    throw new Error(
      typeof responseBody?.error === "string" && responseBody.error.trim().length > 0
        ? responseBody.error
        : detailedMessage
        ? detailedMessage
        : `Edge Function returned status ${response.status}.`
    );
  }

  return responseBody as SignupEmailResponse | null;
}

function getPostLoginRoute(profile: AuthUser) {
  if (profile.isSuperAdmin) {
    return "/superadmin/dashboard";
  }

  if (profile.needsOnboarding) {
    return "/admin/profile?tab=profile&onboarding=complete";
  }

  return "/dashboard";
}

function parseDateMs(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getTime();
}

function getSubscriptionStatusRank(value?: string | null) {
  const status = String(value ?? "").toLowerCase();

  if (status === "active") return 4;
  if (status === "trialing") return 3;
  if (status === "past_due") return 2;
  if (status === "canceled" || status === "cancelled") return 1;
  return 0;
}

function isEffectiveSubscription(subscription: TenantSubscriptionSnapshot, nowMs: number) {
  const periodEnd = parseDateMs(subscription.current_period_end);
  if (periodEnd === null) {
    return false;
  }

  const periodStart = parseDateMs(subscription.current_period_start);

  if (periodStart !== null) {
    return periodStart <= nowMs && periodEnd >= nowMs;
  }

  return periodEnd >= nowMs;
}

function compareSubscriptions(a: TenantSubscriptionSnapshot, b: TenantSubscriptionSnapshot) {
  const statusDiff = getSubscriptionStatusRank(b.status) - getSubscriptionStatusRank(a.status);
  if (statusDiff !== 0) {
    return statusDiff;
  }

  const periodEndDiff =
    (parseDateMs(b.current_period_end) ?? Number.NEGATIVE_INFINITY) -
    (parseDateMs(a.current_period_end) ?? Number.NEGATIVE_INFINITY);
  if (periodEndDiff !== 0) {
    return periodEndDiff;
  }

  const updatedAtDiff =
    (parseDateMs(b.updated_at) ?? Number.NEGATIVE_INFINITY) -
    (parseDateMs(a.updated_at) ?? Number.NEGATIVE_INFINITY);
  if (updatedAtDiff !== 0) {
    return updatedAtDiff;
  }

  return (
    (parseDateMs(b.created_at) ?? Number.NEGATIVE_INFINITY) -
    (parseDateMs(a.created_at) ?? Number.NEGATIVE_INFINITY)
  );
}

function selectCurrentSubscription(
  subscriptions: TenantSubscriptionSnapshot[]
): TenantSubscriptionSnapshot | null {
  if (!subscriptions.length) {
    return null;
  }

  const nowMs = Date.now();
  const effectiveSubscriptions = subscriptions.filter((subscription) =>
    isEffectiveSubscription(subscription, nowMs)
  );
  const candidatePool = effectiveSubscriptions.length > 0 ? effectiveSubscriptions : subscriptions;
  const sorted = [...candidatePool].sort(compareSubscriptions);

  return sorted[0] ?? null;
}

// ─── Funções auxiliares ───────────────────────────────────────────────────────

/**
 * Busca o perfil completo do usuário após o login.
 * Verifica primeiro se é superadmin; caso contrário, busca como tenant user.
 */
async function fetchUserProfile(authUser: User): Promise<AuthUser | null> {
  // 1. Verificar se é superadmin
  const { data: superadminData, error: superadminError } = await supabase
    .from("superadmin_users")
    .select("id, email, first_name, last_name, role")
    .eq("id", authUser.id)
    .maybeSingle();

  if (superadminError) {
    console.error("Error checking superadmin:", superadminError);
  }

  if (superadminData) {
    return {
      id: superadminData.id,
      email: superadminData.email,
      firstName: superadminData.first_name,
      lastName: superadminData.last_name,
      role: superadminData.role,
      tenantId: null,
      tenantName: null,
      tenantStatus: null,
      trialEndsAt: null,
      subscriptionStatus: null,
      subscriptionCurrentPeriodEnd: null,
      isSuperAdmin: true,
      needsOnboarding: false,
    };
  }

  // 2. Verificar se é usuário de tenant
  const { data: tenantUserData, error: tenantUserError } = await supabase
    .from("tenant_users")
    .select("id, email, first_name, last_name, role, tenant_id")
    .eq("id", authUser.id)
    .eq("active", true)
    .maybeSingle();

  if (tenantUserError) {
    console.error("Error fetching tenant user:", tenantUserError);
    return null;
  }

  if (tenantUserData) {
    const [tenantResult, subscriptionResult, restaurantResult] = await Promise.all([
      supabase
        .from("tenants")
        .select("id, name, email, phone, cpf_cnpj, status, trial_ends_at")
        .eq("id", tenantUserData.tenant_id)
        .maybeSingle(),
      supabase
        .from("tenant_subscriptions")
        .select("status, current_period_end, current_period_start, created_at, updated_at")
        .eq("tenant_id", tenantUserData.tenant_id)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("restaurants")
        .select("address")
        .eq("tenant_id", tenantUserData.tenant_id)
        .maybeSingle(),
    ]);

    const { data: tenantData, error: tenantError } = tenantResult;
    const { data: subscriptionRows, error: subscriptionError } = subscriptionResult;
    const { data: restaurantData, error: restaurantError } = restaurantResult;
    const subscriptionData = selectCurrentSubscription(subscriptionRows ?? []);

    if (tenantError) {
      console.error("Error fetching tenant:", tenantError);
    }

    if (subscriptionError) {
      console.error("Error fetching tenant subscription:", subscriptionError);
    }

    if (restaurantError) {
      console.error("Error fetching tenant restaurant:", restaurantError);
    }

    const needsOnboarding =
      !tenantData?.name ||
      !tenantData?.email ||
      !tenantData?.phone ||
      !tenantData?.cpf_cnpj ||
      !restaurantData?.address;

    return {
      id: tenantUserData.id,
      email: tenantUserData.email,
      firstName: tenantUserData.first_name,
      lastName: tenantUserData.last_name,
      role: tenantUserData.role,
      tenantId: tenantUserData.tenant_id,
      tenantName: tenantData?.name ?? null,
      tenantStatus: tenantData?.status ?? null,
      trialEndsAt: tenantData?.trial_ends_at ?? null,
      subscriptionStatus: subscriptionData?.status ?? null,
      subscriptionCurrentPeriodEnd: subscriptionData?.current_period_end ?? null,
      isSuperAdmin: false,
      needsOnboarding,
    };
  }

  return null;
}

async function repairPublicSignupProfile(authUser: User) {
  const signupSource = String(authUser.user_metadata?.signup_source ?? "").trim();

  if (signupSource !== "public_register") {
    return null;
  }

  const { error } = await supabase.rpc("repair_my_public_signup_account", {
    p_full_name: String(authUser.user_metadata?.full_name ?? "").trim() || null,
    p_store_name:
      String(
        authUser.user_metadata?.store_name ??
        authUser.user_metadata?.storeName ??
        ""
      ).trim() || null,
    p_cpf_cnpj: String(authUser.user_metadata?.cpf_cnpj ?? "").trim() || null,
    p_whatsapp: String(authUser.user_metadata?.whatsapp ?? "").trim() || null,
  });

  if (error) {
    console.error("Error repairing public signup profile:", error);
    return null;
  }

  return fetchUserProfile(authUser);
}

async function resolveUserProfile(authUser: User): Promise<AuthUser | null> {
  const profile = await fetchUserProfile(authUser);

  if (profile) {
    return profile;
  }

  return repairPublicSignupProfile(authUser);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshInFlightRef = useRef<Promise<AuthUser | null> | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const refreshUserProfile = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const refreshTask = (async () => {
      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        throw error;
      }

      if (!authUser) {
        setUser(null);
        return null;
      }

      const profile = await resolveUserProfile(authUser);
      setUser(profile);
      return profile;
    })();

    refreshInFlightRef.current = refreshTask;

    try {
      return await refreshTask;
    } finally {
      if (refreshInFlightRef.current === refreshTask) {
        refreshInFlightRef.current = null;
      }
    }
  }, []);

  // Inicialização: ouvir mudanças de sessão do Supabase Auth
  useEffect(() => {
    let isMounted = true;

    const syncSession = async (currentSession: Session | null) => {
      try {
        if (!isMounted) return;

        setSession(currentSession);

        if (!currentSession?.user) {
          setUser(null);
          return;
        }

        const profile = await resolveUserProfile(currentSession.user);
        if (!isMounted) return;
        setUser(profile);
      } catch (error) {
        console.error("Error syncing auth session:", error);
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        void syncSession(currentSession);
      }
    );

    void supabase.auth.getSession().then(({ data: { session: currentSession } }) => syncSession(currentSession));

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      return;
    }

    const refreshBillingState = () => {
      if (document.visibilityState === "visible") {
        void refreshUserProfile().catch((error) => {
          console.error("Error refreshing billing state:", error);
        });
      }
    };

    const onFocus = () => {
      refreshBillingState();
    };

    const onVisibilityChange = () => {
      refreshBillingState();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshUserProfile, session?.user?.id]);

  // ─── Login ────────────────────────────────────────────────────────────────

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (!data.user) {
        toast({
          title: "Erro no login",
          description: "Usuário não encontrado.",
          variant: "destructive",
        });
        return;
      }

      const profile = await resolveUserProfile(data.user);

      if (!profile) {
        await supabase.auth.signOut();
        toast({
          title: "Acesso negado",
          description: "Sua conta não está associada a nenhum perfil.",
          variant: "destructive",
        });
        return;
      }

      setUser(profile);

      toast({
        title: "Login realizado com sucesso",
        description: `Bem-vindo ao Delivery MAX, ${profile.firstName || profile.email}!`,
      });

      // Redirecionar baseado no role
      navigate(getPostLoginRoute(profile));
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error("Login error:", error);

      const isEmailNotConfirmed =
        (error instanceof AuthApiError && /email not confirmed/i.test(error.message)) ||
        /email not confirmed/i.test(errorMessage);

      toast({
        title: isEmailNotConfirmed ? "Email não Verificado!" : "Erro no login",
        description:
          isEmailNotConfirmed
            ? "Acesse seu e-mail e clique no botão de acesso."
            : errorMessage === "Invalid login credentials"
            ? "E-mail ou senha incorretos."
            : "Ocorreu um erro ao tentar fazer login.",
        variant: "destructive",
      });
    }
  };

  // ─── Signup ───────────────────────────────────────────────────────────────

  const signup = async (
    email: string,
    password: string,
    fullName: string,
    cpfCnpj: string,
    storeName: string,
    whatsapp: string
  ) => {
    try {
      const { normalizedFullName } = splitFullName(fullName);
      const normalizedStoreName = storeName.trim();
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/admin/profile?tab=profile&onboarding=complete`
          : undefined;
      let signupEmailError: string | null = null;

      try {
        const signupEmailData = await sendSignupEmail({
          email,
          password,
          fullName: normalizedFullName,
          storeName: normalizedStoreName,
          cpfCnpj,
          whatsapp: whatsapp.trim(),
          redirectTo,
        });

        if (!signupEmailData?.success) {
          signupEmailError = signupEmailData?.message || "Falha ao enviar o e-mail do cadastro.";
        }
      } catch (signupEmailErrorResponse) {
        signupEmailError = await getFunctionErrorMessage(signupEmailErrorResponse);
      }

      if (signupEmailError) {
        throw new Error(signupEmailError);
      }

      toast({
        description: "Conta criada com sucesso! Verifique seu e-mail para acessar os próximos passos.",
      });

      navigate("/login");
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error("Signup error:", error);
      toast({
        title: "Erro no cadastro",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // ─── Logout ───────────────────────────────────────────────────────────────

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    navigate("/login");
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, login, signup, logout, refreshUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}



