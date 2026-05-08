import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Menu,
  LayoutDashboard,
  ShoppingBag,
  Bike,
  Store,
  BarChart,
  Settings,
  MessageSquare,
  BrainCircuit,
  LogOut,
  Package2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getBillingDaysRemaining, isBillingUrgent, shouldBlockTenantAccess } from "@/lib/trial";

const BILLING_ALERT_PULSE_CLASS = "animate-[pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite]";

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Produtos",
    href: "/products",
    icon: Package2,
  },
  {
    title: "Pedidos",
    href: "/orders",
    icon: ShoppingBag,
  },
  {
    title: "Movimentação",
    href: "/deliveries",
    icon: Bike,
  },
  {
    title: "PDV",
    href: "/pdv",
    icon: Store,
  },
  {
    title: "Relatórios",
    href: "/reports",
    icon: BarChart,
  },
  {
    title: "Usuários",
    href: "/users",
    icon: Users,
  },
  {
    title: "Configurações",
    href: "/settings",
    icon: Settings,
  },
  //  {
  //    title: 'Evolution API',
  //    href: '/evolution-api',
  //    icon: MessageSquare
  //  },
  // {
  //   title: "IA",
  //   href: "/ai",
  //   icon: BrainCircuit,
  // },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const profileHref = "/admin/profile";
  const tenantInitial = user?.tenantName?.trim().charAt(0).toUpperCase() || user?.firstName?.trim().charAt(0).toUpperCase() || "U";
  const accessBlocked =
    !user?.isSuperAdmin &&
    shouldBlockTenantAccess({
      trialEndsAt: user?.trialEndsAt,
      tenantStatus: user?.tenantStatus,
      subscriptionPeriodEnd: user?.subscriptionCurrentPeriodEnd,
      subscriptionStatus: user?.subscriptionStatus,
    });
  const daysRemaining = getBillingDaysRemaining({
    trialEndsAt: user?.trialEndsAt,
    subscriptionPeriodEnd: user?.subscriptionCurrentPeriodEnd,
  });
  const shouldHighlightBilling = !user?.isSuperAdmin && isBillingUrgent(daysRemaining);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="flex items-center h-16 px-4 border-b border-border/50 md:hidden bg-gradient-to-r from-background to-background/95 backdrop-blur-sm">
        <SheetTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="mr-4 hover:bg-sidebar-accent/50 transition-all duration-300 hover:scale-110 hover:rotate-12 group"
          >
            <Menu className="h-5 w-5 transition-all duration-300 group-hover:scale-110" />
          </Button>
        </SheetTrigger>
        <Link 
          to="/dashboard" 
          className="flex items-center gap-2 group transition-all duration-300 hover:scale-105"
        >
          <img src="/icon.svg" alt="VIP Delivery" className="h-8 w-8 object-contain shadow-lg transition-all duration-300 group-hover:scale-105" />
          <span className="font-heading font-bold text-lg bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent transition-all duration-300 group-hover:from-delivery-500 group-hover:to-delivery-600">
            VIP Delivery
          </span>
        </Link>
      </div>
      <SheetContent
        side="left"
        className="p-0 bg-gradient-to-b from-sidebar to-sidebar/95 backdrop-blur-sm border-r border-border/50"
        onInteractOutside={() => setOpen(false)}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center h-16 border-b border-border/50 backdrop-blur-sm">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 group transition-all duration-300 hover:scale-105"
              onClick={() => setOpen(false)}
            >
              <img src="/icon.svg" alt="VIP Delivery" className="h-8 w-8 object-contain shadow-lg transition-all duration-300 group-hover:scale-105" />
              <span className="font-heading font-bold text-lg bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent transition-all duration-300 group-hover:from-delivery-500 group-hover:to-delivery-600">
                VIP Delivery
              </span>
            </Link>
          </div>
          <ScrollArea className="flex-1 py-4">
            <nav className="grid gap-2 px-3">
              {navItems.map((item, index) => {
                const isActive = location.pathname === item.href ||
                  location.pathname.startsWith(`${item.href}/`) ||
                  (item.href.includes("?tab=") &&
                    location.pathname === item.href.split("?")[0]);
                const isBlockedByTrial = accessBlocked && item.href === "/pdv";
                const isBillingEntry = item.title === "Configurações";
                const shouldPulseBillingEntry = isBillingEntry && shouldHighlightBilling;
                
                return (
                  <Link
                    key={index}
                    to={isBlockedByTrial ? "#" : item.href}
                    onClick={(event) => {
                      if (isBlockedByTrial) {
                        event.preventDefault();
                        return;
                      }
                      setOpen(false);
                    }}
                    onMouseEnter={() => setHoveredItem(item.href)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 ease-in-out",
                      "hover:bg-gradient-to-r hover:from-sidebar-accent/80 hover:to-sidebar-accent/40",
                      "hover:shadow-lg hover:shadow-sidebar-accent/20 hover:scale-[1.02]",
                      "before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:rounded-r-full before:bg-delivery-500 before:transition-all before:duration-300",
                      isActive
                        ? "bg-gradient-to-r from-sidebar-accent to-sidebar-accent/60 text-sidebar-accent-foreground shadow-lg shadow-sidebar-accent/20 before:opacity-100 before:scale-y-100"
                        : "text-sidebar-foreground hover:text-sidebar-accent-foreground before:opacity-0 before:scale-y-0",
                      isBlockedByTrial && "cursor-not-allowed opacity-50 hover:translate-x-0 hover:scale-100",
                      hoveredItem === item.href && "translate-x-1"
                    )}
                  >
                    <div className={cn(
                      "relative flex items-center justify-center transition-all duration-300",
                      isActive && "text-delivery-500",
                      shouldPulseBillingEntry && `text-red-500 ${BILLING_ALERT_PULSE_CLASS}`,
                      hoveredItem === item.href && "scale-110 rotate-3"
                    )}>
                      <item.icon className={cn(
                        "h-5 w-5 transition-all duration-300",
                        isActive && "drop-shadow-sm",
                        shouldPulseBillingEntry && `text-red-500 ${BILLING_ALERT_PULSE_CLASS}`,
                        hoveredItem === item.href && BILLING_ALERT_PULSE_CLASS
                      )} />
                      {isActive && !shouldPulseBillingEntry && (
                        <div className={cn("absolute inset-0 bg-delivery-500/20 rounded-full blur-sm", BILLING_ALERT_PULSE_CLASS)} />
                      )}
                      {shouldPulseBillingEntry && (
                        <div className={cn("absolute inset-0 rounded-full bg-red-500/20 blur-sm", BILLING_ALERT_PULSE_CLASS)} />
                      )}
                    </div>
                    <span className={cn(
                      "transition-all duration-300",
                      shouldPulseBillingEntry && "text-red-500",
                      hoveredItem === item.href && "translate-x-1"
                    )}>
                      {item.title}
                      {isBlockedByTrial ? " (bloqueado)" : ""}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>
          <div className="border-t border-border/50 flex items-center gap-3 p-4 bg-gradient-to-t from-sidebar to-sidebar/95 backdrop-blur-sm">
            <Link
              to={profileHref}
              onClick={() => setOpen(false)}
              className="group flex min-w-0 flex-1 items-center gap-3"
            >
              <div className="relative">
                <Avatar className="h-10 w-10 ring-2 ring-delivery-500/20 transition-all duration-300 group-hover:ring-delivery-500/40 group-hover:scale-110">
                  <AvatarImage src="/avatar.png" alt="User" className="transition-all duration-300 group-hover:scale-110" />
                  <AvatarFallback className="bg-gradient-to-br from-delivery-500 to-delivery-600 text-white font-semibold transition-all duration-300 group-hover:from-delivery-400 group-hover:to-delivery-500">
                    {tenantInitial}
                  </AvatarFallback>
                </Avatar>
                <div className={cn("absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-sidebar bg-green-500", BILLING_ALERT_PULSE_CLASS)} />
              </div>
              <div className="flex min-w-0 flex-col transition-all duration-300">
                <span className="truncate text-sm font-semibold text-foreground transition-colors duration-300 group-hover:text-delivery-400">
                  {user?.firstName || "Usuário"}
                </span>
                <span className="truncate text-xs text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">
                  {user?.email}
                </span>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto hover:bg-red-500/10 hover:text-red-500 transition-all duration-300 hover:scale-110 hover:rotate-12 group"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 transition-all duration-300 group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}



