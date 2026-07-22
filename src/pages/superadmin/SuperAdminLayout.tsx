import React, { useState } from "react";
import { Outlet, NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  Layers3,
  CreditCard,
  Users,
  Settings2,
  LogOut,
  ChevronRight,
  Menu,
  LineChart,
  FileText,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/superadmin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/superadmin/restaurants", icon: Store, label: "Restaurantes" },
  { to: "/superadmin/plans", icon: Layers3, label: "Planos" },
  { to: "/superadmin/billing", icon: CreditCard, label: "Faturamento" },
  { to: "/superadmin/team", icon: Users, label: "Equipe" },
  { to: "/superadmin/marketing", icon: LineChart, label: "Marketing" },
  { to: "/superadmin/integrations", icon: Settings2, label: "Integrações" },
  { to: "/superadmin/logs", icon: FileText, label: "Logs Gerais" },
];

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  className?: string;
}

function SuperAdminSidebar({ collapsed, onCollapsedChange, className }: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const profileHref = "/superadmin/profile";
  const adminInitial =
    user?.firstName?.trim().charAt(0).toUpperCase() ||
    user?.email?.trim().charAt(0).toUpperCase() ||
    "S";

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
          "flex h-16 items-center gap-2 border-b border-border/50 px-4 backdrop-blur-sm",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {!collapsed ? (
          <Link
            to="/superadmin/dashboard"
            className="group flex items-center gap-2 transition-all duration-300 hover:scale-105"
          >
            <img
              src="/icon.svg"
              alt="VipDelivery"
              className="h-8 w-8 object-contain shadow-lg transition-all duration-300 group-hover:scale-105"
            />
            <div className="min-w-0">
              <p className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text font-heading text-lg font-bold text-transparent transition-all duration-300 group-hover:from-delivery-500 group-hover:to-delivery-600">
                VipDelivery
              </p>
              <p className="text-xs text-muted-foreground">Super Admin</p>
            </div>
          </Link>
        ) : (
          <img
            src="/icon.svg"
            alt="VipDelivery"
            className="ml-6 h-8 w-8 cursor-pointer object-contain shadow-lg transition-all duration-300 hover:scale-110"
          />
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCollapsedChange(!collapsed)}
          className={cn(
            "group transition-all duration-300 hover:scale-110 hover:rotate-180 hover:bg-sidebar-accent/50",
            !collapsed && "ml-auto"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 transition-all duration-300 group-hover:translate-x-1" />
          ) : (
            <Menu className="h-4 w-4 transition-all duration-300" />
          )}
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-6.5rem)] flex-1 py-4">
        <nav className="grid gap-2 px-3">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onMouseEnter={() => setHoveredItem(item.to)}
                onMouseLeave={() => setHoveredItem(null)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 ease-in-out",
                  "hover:bg-gradient-to-r hover:from-sidebar-accent/80 hover:to-sidebar-accent/40",
                  "hover:shadow-lg hover:shadow-sidebar-accent/20 hover:scale-[1.02]",
                  "before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:rounded-r-full before:bg-delivery-500 before:transition-all before:duration-300",
                  isActive
                    ? "bg-gradient-to-r from-sidebar-accent to-sidebar-accent/60 text-sidebar-accent-foreground shadow-lg shadow-sidebar-accent/20 before:opacity-100 before:scale-y-100"
                    : "text-sidebar-foreground hover:text-sidebar-accent-foreground before:opacity-0 before:scale-y-0",
                  collapsed && "justify-center px-0 before:hidden",
                  hoveredItem === item.to && !collapsed && "translate-x-1"
                )}
              >
                <div
                  className={cn(
                    "relative flex items-center justify-center transition-all duration-300",
                    isActive && "text-delivery-500",
                    hoveredItem === item.to && "scale-110 rotate-3"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 transition-all duration-300",
                      collapsed && "h-6 w-6",
                      isActive && "drop-shadow-sm"
                    )}
                  />
                  {isActive && <div className="absolute inset-0 rounded-full bg-delivery-500/20 blur-sm" />}
                </div>

                {!collapsed && (
                  <span className={cn("transition-all duration-300", hoveredItem === item.to && "translate-x-1")}>
                    {item.label}
                  </span>
                )}

                {collapsed && hoveredItem === item.to && (
                  <div className="absolute left-full z-50 ml-2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
                    {item.label}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>
      </ScrollArea>

      <div
        className={cn(
          "sticky bottom-0 flex border-t border-border/50 bg-gradient-to-t from-sidebar to-sidebar/95 p-4 backdrop-blur-sm",
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
          <Avatar className="h-10 w-10 ring-2 ring-delivery-500/20 transition-all duration-300 group-hover:scale-110 group-hover:ring-delivery-500/40">
            <AvatarImage src="/avatar.png" alt="Super Admin" className="transition-all duration-300 group-hover:scale-110" />
            <AvatarFallback className="bg-gradient-to-br from-delivery-500 to-delivery-600 font-semibold text-white transition-all duration-300 group-hover:from-delivery-400 group-hover:to-delivery-500">
              {adminInitial}
            </AvatarFallback>
          </Avatar>

          {!collapsed && (
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold text-foreground transition-colors duration-300 group-hover:text-delivery-400">
                {user?.firstName || "Super Admin"}
              </span>
              <span className="truncate text-xs text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">
                {user?.email || "superadmin@delivery.pro"}
              </span>
            </div>
          )}
        </Link>

        {!collapsed ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="group transition-all duration-300 hover:scale-110 hover:rotate-12 hover:bg-red-500/10 hover:text-red-500"
          >
            <LogOut className="h-4 w-4 transition-all duration-300 group-hover:translate-x-1" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="absolute -top-12 left-1/2 -translate-x-1/2 transform opacity-0 transition-all duration-300 hover:scale-110 hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function SuperAdminMobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const profileHref = "/superadmin/profile";
  const adminInitial =
    user?.firstName?.trim().charAt(0).toUpperCase() ||
    user?.email?.trim().charAt(0).toUpperCase() ||
    "S";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="flex h-16 items-center border-b border-border/50 bg-gradient-to-r from-background to-background/95 px-4 backdrop-blur-sm md:hidden">
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="group mr-4 transition-all duration-300 hover:scale-110 hover:rotate-12 hover:bg-sidebar-accent/50"
          >
            <Menu className="h-5 w-5 transition-all duration-300 group-hover:scale-110" />
          </Button>
        </SheetTrigger>

        <Link
          to="/superadmin/dashboard"
          className="group flex items-center gap-2 transition-all duration-300 hover:scale-105"
        >
          <img
            src="/icon.svg"
            alt="VipDelivery"
            className="h-8 w-8 rounded-xl object-contain shadow-lg transition-all duration-300 group-hover:scale-105"
          />
          <div className="min-w-0">
            <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text font-heading text-lg font-bold text-transparent transition-all duration-300 group-hover:from-delivery-500 group-hover:to-delivery-600">
              VipDelivery
            </span>
            <p className="text-xs text-muted-foreground">Super Admin</p>
          </div>
        </Link>
      </div>

      <SheetContent
        side="left"
        className="border-r border-border/50 bg-gradient-to-b from-sidebar to-sidebar/95 p-0 backdrop-blur-sm"
        onInteractOutside={() => setOpen(false)}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b border-border/50 px-4 backdrop-blur-sm">
            <Link
              to="/superadmin/dashboard"
              className="group flex items-center gap-2 transition-all duration-300 hover:scale-105"
              onClick={() => setOpen(false)}
            >
              <img
                src="/icon.svg"
                alt="VipDelivery"
                className="h-8 w-8 rounded-xl object-contain shadow-lg transition-all duration-300 group-hover:scale-105"
              />
              <div>
                <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text font-heading text-lg font-bold text-transparent transition-all duration-300 group-hover:from-delivery-500 group-hover:to-delivery-600">
                  VipDelivery
                </span>
                <p className="text-xs text-muted-foreground">Super Admin</p>
              </div>
            </Link>
          </div>

          <ScrollArea className="flex-1 py-4">
            <nav className="grid gap-2 px-3">
              {navItems.map((item) => {
                const isActive =
                  location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 ease-in-out",
                      "hover:bg-gradient-to-r hover:from-sidebar-accent/80 hover:to-sidebar-accent/40",
                      "hover:shadow-lg hover:shadow-sidebar-accent/20 hover:scale-[1.02]",
                      "before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:rounded-r-full before:bg-delivery-500 before:transition-all before:duration-300",
                      isActive
                        ? "bg-gradient-to-r from-sidebar-accent to-sidebar-accent/60 text-sidebar-accent-foreground shadow-lg shadow-sidebar-accent/20 before:opacity-100 before:scale-y-100"
                        : "text-sidebar-foreground hover:text-sidebar-accent-foreground before:opacity-0 before:scale-y-0"
                    )}
                  >
                    <div className={cn("relative flex items-center justify-center transition-all duration-300", isActive && "text-delivery-500")}>
                      <item.icon className={cn("h-5 w-5 transition-all duration-300", isActive && "drop-shadow-sm")} />
                      {isActive && <div className="absolute inset-0 rounded-full bg-delivery-500/20 blur-sm" />}
                    </div>
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </ScrollArea>

          <div className="flex items-center gap-3 border-t border-border/50 bg-gradient-to-t from-sidebar to-sidebar/95 p-4 backdrop-blur-sm">
            <Link to={profileHref} onClick={() => setOpen(false)} className="group flex min-w-0 flex-1 items-center gap-3">
              <Avatar className="h-10 w-10 ring-2 ring-delivery-500/20 transition-all duration-300 group-hover:scale-110 group-hover:ring-delivery-500/40">
                <AvatarImage src="/avatar.png" alt="Super Admin" />
                <AvatarFallback className="bg-gradient-to-br from-delivery-500 to-delivery-600 font-semibold text-white">
                  {adminInitial}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-foreground transition-colors duration-300 group-hover:text-delivery-400">
                  {user?.firstName || "Super Admin"}
                </span>
                <span className="truncate text-xs text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">
                  {user?.email}
                </span>
              </div>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="group ml-auto transition-all duration-300 hover:scale-110 hover:rotate-12 hover:bg-red-500/10 hover:text-red-500"
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

export default function SuperAdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <SuperAdminSidebar
        className="hidden h-screen md:fixed md:block"
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      <div
        className={cn(
          "flex w-full flex-1 flex-col transition-all duration-300",
          sidebarCollapsed ? "md:pl-16" : "md:pl-64"
        )}
      >
        <SuperAdminMobileNav />
        <main className="flex-1 overflow-y-auto bg-background">
          <Header title="Super Admin" />
          <Outlet />
        </main>
      </div>
    </div>
  );
}



