import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronRight,
  LayoutDashboard,
  ShoppingBag,
  Bike,
  Store,
  BarChart,
  Settings,
  MessageSquare,
  BrainCircuit,
  Menu,
  X,
  LogOut,
  Package2,
  Users,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
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
    title: "Entregas",
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

interface SidebarProps {
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ className, collapsed = false, onCollapsedChange }: SidebarProps) {
  const location = useLocation();
  const { logout, user } = useAuth();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
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

  const handleToggleCollapse = () => {
    onCollapsedChange?.(!collapsed);
  };

  return (
    <div
      className={cn(
        "border-r bg-gradient-to-b from-sidebar to-sidebar/95 backdrop-blur-sm transition-all duration-500 ease-in-out shadow-lg",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center h-16 px-4 gap-2 backdrop-blur-sm",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {!collapsed && (
          <Link 
            to="/dashboard" 
            className="flex items-center gap-2 group transition-all duration-300 hover:scale-105"
          >
            <img src="/icon.svg" alt="VIP Delivery" className="h-8 w-8 object-contain shadow-lg transition-all duration-300 group-hover:scale-105" />
            <span className="font-heading font-bold text-lg bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent transition-all duration-300 group-hover:from-delivery-500 group-hover:to-delivery-600">
              VIP Delivery
            </span>
          </Link>
        )}
        {collapsed && (
          <img src="/icon.svg" alt="VIP Delivery" className="h-8 w-8 ml-6 object-contain shadow-lg transition-all duration-300 hover:scale-110 cursor-pointer" />
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleCollapse}
          className={cn(
            "hover:bg-sidebar-accent/50 transition-all duration-300 hover:scale-110 hover:rotate-180 group",
            !collapsed && "ml-auto"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-6 w-6 transition-all duration-300 group-hover:translate-x-1" />
          ) : (
            <Menu className="h-4 w-4 transition-all duration-300" />
          )}
        </Button>
      </div>

      <ScrollArea className="flex-1 py-4 h-[calc(100vh-6.5rem)]">
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
                  }
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
                  collapsed && "justify-center px-0 before:hidden",
                  hoveredItem === item.href && !collapsed && "translate-x-1"
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
                    collapsed && "h-6 w-6",
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
                {!collapsed && (
                  <span className={cn(
                    "transition-all duration-300",
                    shouldPulseBillingEntry && "text-red-500",
                    hoveredItem === item.href && "translate-x-1"
                  )}>
                    {item.title}
                    {isBlockedByTrial ? " (bloqueado)" : ""}
                  </span>
                )}
                {collapsed && hoveredItem === item.href && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-lg border z-50 whitespace-nowrap animate-in fade-in-0 zoom-in-95">
                    {item.title}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div
        className={cn(
          "border-t border-border/50 flex p-4 sticky bottom-0 bg-gradient-to-t from-sidebar to-sidebar/95 backdrop-blur-sm",
          collapsed ? "justify-center" : "items-center gap-3"
        )}
      >
        <Link
          to={profileHref}
          className={cn(
            "group relative transition-all duration-300",
            collapsed ? "block" : "flex min-w-0 flex-1 items-center gap-3"
          )}
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
          {!collapsed && (
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold text-foreground transition-colors duration-300 group-hover:text-delivery-400">
                {user?.firstName || "Admin"}
              </span>
              <span className="truncate text-xs text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">
                {user?.email || "admin@delivery.pro"}
              </span>
            </div>
          )}
        </Link>
        {!collapsed && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={logout}
            className="hover:bg-red-500/10 hover:text-red-500 transition-all duration-300 hover:scale-110 hover:rotate-12 group"
          >
            <LogOut className="h-4 w-4 transition-all duration-300 group-hover:translate-x-1" />
          </Button>
        )}
        {collapsed && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={logout}
            className="absolute -top-12 left-1/2 transform -translate-x-1/2 hover:bg-red-500/10 hover:text-red-500 transition-all duration-300 hover:scale-110 opacity-0 group-hover:opacity-100"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}



