import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Order = Database["public"]["Tables"]["orders"]["Row"];

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
}

const getDismissedStorageKey = (scopeKey: string) =>
  `deliverypro:dismissed-notifications:${scopeKey}`;

export function useNotifications(enabled = true, scopeKey = "global") {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasUnseen, setHasUnseen] = useState(false);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<
    Set<string>
  >(new Set());
  const hasLoadedInitiallyRef = useRef(false);
  const knownPendingOrderIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawValue = window.localStorage.getItem(
        getDismissedStorageKey(scopeKey)
      );

      if (!rawValue) {
        setDismissedNotificationIds(new Set());
        return;
      }

      const parsedValue = JSON.parse(rawValue);
      const nextDismissedIds = Array.isArray(parsedValue)
        ? parsedValue.filter((value): value is string => typeof value === "string")
        : [];

      setDismissedNotificationIds(new Set(nextDismissedIds));
    } catch (error) {
      console.warn("Could not restore dismissed notifications:", error);
      setDismissedNotificationIds(new Set());
    }
  }, [scopeKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(
        getDismissedStorageKey(scopeKey),
        JSON.stringify(Array.from(dismissedNotificationIds))
      );
    } catch (error) {
      console.warn("Could not persist dismissed notifications:", error);
    }
  }, [dismissedNotificationIds, scopeKey]);

  const playNotificationTone = useCallback(async () => {
    if (typeof window === "undefined") return;

    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!AudioContextClass) return;

    try {
      const context = new AudioContextClass();

      if (context.state === "suspended") {
        await context.resume();
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, now);
      oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.16);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(now);
      oscillator.stop(now + 0.3);

      oscillator.onended = () => {
        void context.close();
      };
    } catch (error) {
      console.warn("Notification sound could not be played:", error);
    }
  }, []);

  const notifyNewOrder = useCallback(
    (order: Order) => {
      setNotifications((prev) => {
        const notification = orderToNotification(order);
        const existingIndex = prev.findIndex(
          (existingNotification) => existingNotification.id === order.id
        );

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = notification;
          return updated;
        }

        return [notification, ...prev];
      });

      setHasUnseen(true);
      void playNotificationTone();
    },
    [playNotificationTone]
  );

  useEffect(() => {
    if (!enabled) {
      setNotifications([]);
      setHasUnseen(false);
      setDismissedNotificationIds(new Set());
      knownPendingOrderIdsRef.current = new Set();
      hasLoadedInitiallyRef.current = false;
      return;
    }

    // Carregar pedidos pendentes do Supabase
    const loadPendingOrders = async () => {
      console.log('Loading pending orders for notifications...');
      const { data: orders, error } = await supabase
        .from("orders")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        console.error('Error loading pending orders:', error);
        return;
      }

      if (orders) {
        console.log('Found pending orders:', orders.length);
        const nextPendingIds = new Set(orders.map((order) => order.id));
        const visibleOrders = orders.filter(
          (order) => !dismissedNotificationIds.has(order.id)
        );
        const hasNewPendingOrder = visibleOrders.some(
          (order) =>
            !knownPendingOrderIdsRef.current.has(order.id) &&
            !dismissedNotificationIds.has(order.id)
        );

        const orderNotifications = visibleOrders.map(orderToNotification);
        setNotifications(orderNotifications);

        if (!hasLoadedInitiallyRef.current) {
          hasLoadedInitiallyRef.current = true;
        } else if (hasNewPendingOrder) {
          setHasUnseen(true);
          void playNotificationTone();
        }

        knownPendingOrderIdsRef.current = nextPendingIds;
      }
    };

    loadPendingOrders();
    
    // Recarregar notificações a cada 30 segundos como fallback
    const interval = setInterval(loadPendingOrders, 30000);

    // Inscrever para mudanças nos pedidos
    const subscription = supabase
      .channel("orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const newOrder = payload.new as any;
          console.log('New order received:', newOrder);
          if (
            newOrder.status === "pending" &&
            !dismissedNotificationIds.has(newOrder.id)
          ) {
            notifyNewOrder(newOrder);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updatedOrder = payload.new as any;
          const oldOrder = payload.old as any;
          console.log('Order updated:', { old: oldOrder, new: updatedOrder });
          
          setNotifications((prev) => {
            // Se o pedido não está mais pendente, remover da lista
            if (updatedOrder.status !== "pending") {
              console.log('Removing notification for order:', updatedOrder.id, 'status changed from', oldOrder?.status, 'to', updatedOrder.status);
              setDismissedNotificationIds((prev) => {
                if (!prev.has(updatedOrder.id)) return prev;
                const next = new Set(prev);
                next.delete(updatedOrder.id);
                return next;
              });
              const filtered = prev.filter((notification) => notification.id !== updatedOrder.id);
              console.log('Notifications after removal:', filtered.length);
              return filtered;
            }

            // Se ainda está pendente, atualizar a notificação
            const existingIndex = prev.findIndex((notification) => notification.id === updatedOrder.id);
            if (existingIndex >= 0) {
              const updatedNotifications = [...prev];
              updatedNotifications[existingIndex] = orderToNotification(updatedOrder);
              return updatedNotifications;
            }

            return prev;
          });

          if (
            updatedOrder.status === "pending" &&
            oldOrder?.status !== "pending" &&
            !dismissedNotificationIds.has(updatedOrder.id)
          ) {
            notifyNewOrder(updatedOrder);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [dismissedNotificationIds, enabled, notifyNewOrder]);

  const markAsRead = (notificationId: string) => {
    setDismissedNotificationIds((prev) => new Set(prev).add(notificationId));

    // Remover da lista de notificações ativas
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== notificationId)
    );
  };

  const markAllSeen = () => {
    setHasUnseen(false);
  };

  const clearNotifications = () => {
    setDismissedNotificationIds(
      (prev) => new Set([...prev, ...notifications.map((notification) => notification.id)])
    );
    setNotifications([]);
    setHasUnseen(false);
  };

  const orderToNotification = (order: Order): Notification => {
    return {
      id: order.id,
      title: "Novo pedido recebido",
      description: `Pedido #${order.number} - Cliente: ${order.customer_name}`,
      time: new Date(order.created_at).toLocaleString(),
    };
  };

  return {
    notifications,
    unreadCount: notifications.length,
    hasUnseen,
    markAsRead,
    markAllSeen,
    clearNotifications,
  };
}



