import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { shouldBlockTenantAccess } from "@/lib/trial";
import { PaywallScreen } from "@/components/billing/PaywallScreen";

/**
 * Guarda rotas de tenant (dashboard, pedidos, produtos, etc.)
 * Bloqueia acesso de superadmins (eles têm rota própria)
 * Redireciona usuários não autenticados para /login
 */
export function PrivateRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Superadmin não acessa o painel de restaurante
  if (user.isSuperAdmin) {
    return <Navigate to="/superadmin/dashboard" replace />;
  }

  const accessBlocked = shouldBlockTenantAccess({
    trialEndsAt: user?.trialEndsAt,
    tenantStatus: user?.tenantStatus,
    subscriptionPeriodEnd: user?.subscriptionCurrentPeriodEnd,
    subscriptionStatus: user?.subscriptionStatus,
  });

  if (accessBlocked) {
    return <PaywallScreen />;
  }

  return <Outlet />;
}



