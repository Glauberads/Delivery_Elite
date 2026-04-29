import React from "react";
import { Bell, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/use-notifications";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const notificationsEnabled = !user?.isSuperAdmin;
  const {
    notifications,
    unreadCount,
    hasUnseen,
    markAsRead,
    markAllSeen,
    clearNotifications,
  } = useNotifications(notificationsEnabled, user?.id ?? "anonymous");
  
  // Log para debug das notificações
  React.useEffect(() => {
    console.log('Header notifications updated:', { count: notifications.length, unreadCount });
  }, [notifications, unreadCount]);

  const handleNotificationClick = (notificationId: string) => {
    markAsRead(notificationId);
    navigate(`/orders?orderId=${notificationId}`);
  };

  return (
    <div className="px-4 pt-4 md:px-6 md:pt-6">
      <div className="relative overflow-hidden rounded-[28px] border border-orange-100/60 bg-white shadow-sm dark:border-white/5 dark:bg-slate-950">
        <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-orange-100/30 to-transparent dark:from-orange-500/10 dark:to-transparent" />
        <div className="relative z-10 flex min-h-16 items-center px-4 py-3 text-slate-900 md:px-6 dark:text-slate-50">
          <h1 className="text-lg font-semibold text-slate-900 md:text-xl dark:text-slate-50">{title}</h1>
          <div className="ml-auto flex items-center gap-4">
            <ThemeToggle />
            {notificationsEnabled ? (
              <DropdownMenu onOpenChange={(open) => open && markAllSeen()}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      "relative border-slate-200/80 bg-white/80 text-slate-900 shadow-sm backdrop-blur-sm hover:bg-white dark:border-zinc-800 dark:bg-slate-950/80 dark:text-slate-50 dark:hover:bg-slate-950",
                      hasUnseen &&
                        "animate-pulse border-amber-300 bg-amber-400 text-amber-950 shadow-md hover:bg-amber-400/90 dark:border-amber-200/60 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-400/90"
                    )}
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center p-0">
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Notificações</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length === 0 ? (
                    <DropdownMenuItem disabled>
                      Nenhuma notificação
                    </DropdownMenuItem>
                  ) : (
                    <>
                      {notifications.map((notification) => (
                        <div key={notification.id}>
                          <DropdownMenuItem
                            className="flex items-start gap-2 cursor-pointer"
                            onClick={() =>
                              handleNotificationClick(notification.id)
                            }
                          >
                            <div className="flex-1">
                              <div className="font-medium">
                                {notification.title}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {notification.description}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {notification.time}
                              </div>
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </div>
                      ))}
                    </>
                  )}
                  {notifications.length > 0 ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer justify-center text-sm font-medium text-muted-foreground"
                        onClick={clearNotifications}
                      >
                        Limpar notificações
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}



