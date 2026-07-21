import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { PrivateRoute } from "./components/auth/PrivateRoute";
import { SuperAdminRoute } from "./components/auth/SuperAdminRoute";
import { ThemeProvider } from "next-themes";

// Páginas públicas
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Home from "./pages/Home";
import TrackOrder from "./pages/TrackOrder";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";
import { AnalyticsInjector } from "./components/AnalyticsInjector";
import { DomainResolver } from "./components/DomainResolver";

// Páginas de tenant (restaurante)
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Deliveries from "./pages/Deliveries";
import Users from "./pages/Users";
import PDV from "./pages/PDV";
import Reports from "./pages/Reports";
import Customization from "./pages/Customization";
import Profile from "./pages/settings/Profile";
import TenantProfile from "./pages/tenant/Profile";
import TenantSettings from "./pages/tenant/Settings";

// Páginas de Super Admin (criadas na Fase 4)
import SuperAdminLayout from "./pages/superadmin/SuperAdminLayout";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import SuperAdminRestaurants from "./pages/superadmin/SuperAdminRestaurants";
import SuperAdminBilling from "./pages/superadmin/SuperAdminBilling";
import SuperAdminTeam from "./pages/superadmin/SuperAdminTeam";
import SuperAdminMarketing from "./pages/superadmin/SuperAdminMarketing";
import SuperAdminIntegrations from "./pages/superadmin/SuperAdminIntegrations";
import SuperAdminPlans from "./pages/superadmin/SuperAdminPlans";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minuto
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster richColors position="bottom-right" duration={4000} />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <BrowserRouter>
            <AuthProvider>
              <AnalyticsInjector />
              <Routes>
              {/* ── Rotas Públicas ────────────────────────────── */}
              <Route path="/" element={<DomainResolver />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/r/:slug" element={<Home />} />
              <Route path="/track-order/:orderId" element={<TrackOrder />} />

              {/* ── Rotas de Tenant (restaurante) ─────────────── */}
              <Route element={<PrivateRoute />}>
                <Route
                  element={<DashboardLayout />}
                >
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/deliveries" element={<Deliveries />} />
                  <Route path="/settings" element={<TenantSettings />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/pdv" element={<PDV />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/customization" element={<Customization />} />
                  <Route path="/checkout" element={<Navigate to="/admin/profile?billing=renew" replace />} />
                  <Route path="/plans" element={<Navigate to="/admin/profile?tab=plans" replace />} />
                  <Route path="/profile" element={<Navigate to="/admin/profile" replace />} />
                  <Route path="/admin/profile" element={<TenantProfile />} />
                  <Route path="/admin/settings" element={<Navigate to="/settings" replace />} />
                  <Route path="/admin/plans" element={<Navigate to="/admin/profile?tab=plans" replace />} />
                  <Route path="/admin/checkout" element={<Navigate to="/admin/profile?billing=renew" replace />} />
                </Route>
              </Route>

              {/* ── Rotas de Super Admin ──────────────────────── */}
              <Route element={<SuperAdminRoute />}>
                <Route element={<SuperAdminLayout />}>
                  <Route path="/superadmin" element={<Navigate to="/superadmin/dashboard" replace />} />
                  <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
                  <Route path="/superadmin/restaurants" element={<SuperAdminRestaurants />} />
                  <Route path="/superadmin/plans" element={<SuperAdminPlans />} />
                  <Route path="/superadmin/billing" element={<SuperAdminBilling />} />
                  <Route path="/superadmin/team" element={<SuperAdminTeam />} />
                  <Route path="/superadmin/marketing" element={<SuperAdminMarketing />} />
                  <Route path="/superadmin/integrations" element={<SuperAdminIntegrations />} />
                  <Route path="/superadmin/profile" element={<Profile />} />
                </Route>
              </Route>

              {/* ── 404 ──────────────────────────────────────── */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;



