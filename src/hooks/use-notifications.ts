import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";

type Order = Database["public"]["Tables"]["orders"]["Row"];

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
}

let notificationAudioContext: AudioContext | null = null;

const getDismissedStorageKey = (scopeKey: string) =>
  `deliverypro:dismissed-notifications:${scopeKey}`;

const CUSTOM_SOUND_STORAGE_KEY = "deliverypro:custom-notification-sound";
const CUSTOM_SOUND_NAME_STORAGE_KEY = "deliverypro:custom-notification-sound-name";
const MAX_CUSTOM_SOUND_SIZE = 2 * 1024 * 1024;

export function useNotifications(enabled = true, scopeKey = "global") {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasUnseen, setHasUnseen] = useState(false);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<
    Set<string>
  >(new Set());
  const hasLoadedInitiallyRef = useRef(false);
  const knownPendingOrderIdsRef = useRef<Set<string>>(new Set());
  const pendingAlarmOrderIdsRef = useRef<Set<string>>(new Set());
  const customAudioRef = useRef<HTMLAudioElement | null>(null);
  const alarmIntervalRef = useRef<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [hasPendingAlarm, setHasPendingAlarm] = useState(false);
  const [customSoundUrl, setCustomSoundUrl] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(CUSTOM_SOUND_STORAGE_KEY) ?? "";
  });
  const [customSoundName, setCustomSoundName] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(CUSTOM_SOUND_NAME_STORAGE_KEY) ?? "";
  });

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

  const getNotificationAudioContext = useCallback(async () => {
    if (typeof window === "undefined") return;

    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!AudioContextClass) return;

    try {
      if (!notificationAudioContext || notificationAudioContext.state === "closed") {
        notificationAudioContext = new AudioContextClass();
      }

      if (notificationAudioContext.state === "suspended") {
        await notificationAudioContext.resume();
      }

      const enabled = notificationAudioContext.state === "running";
      setSoundEnabled(enabled);
      return enabled ? notificationAudioContext : undefined;
    } catch (error) {
      setSoundEnabled(false);
      console.warn("Notification audio could not be enabled:", error);
      return;
    }
  }, []);

  const playNotificationTone = useCallback(async () => {
    const context = await getNotificationAudioContext();
    if (!context) return false;

    try {
      const playBeep = (startAt: number, frequency: number) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, startAt);

        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.3);

        oscillator.connect(gain);
        gain.connect(context.destination);

        oscillator.start(startAt);
        oscillator.stop(startAt + 0.32);
      };

      const now = context.currentTime;
      playBeep(now, 880);
      playBeep(now + 0.34, 1175);
      return true;
    } catch (error) {
      console.warn("Notification sound could not be played:", error);
      return false;
    }
  }, [getNotificationAudioContext]);

  const enableNotificationSound = useCallback(async () => {
    const context = await getNotificationAudioContext();
    if (!context) return false;

    if (customSoundUrl) {
      const preview = new Audio(customSoundUrl);
      preview.volume = 1;
      await preview.play();
      window.setTimeout(() => {
        preview.pause();
        preview.currentTime = 0;
      }, 2500);
      return true;
    }

    return playNotificationTone();
  }, [customSoundUrl, getNotificationAudioContext, playNotificationTone]);

  const saveCustomNotificationSound = useCallback(async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      throw new Error("Selecione um arquivo de áudio válido.");
    }

    if (file.size > MAX_CUSTOM_SOUND_SIZE) {
      throw new Error("O áudio deve ter no máximo 2 MB.");
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Não foi possível ler o áudio."));
      reader.readAsDataURL(file);
    });

    window.localStorage.setItem(CUSTOM_SOUND_STORAGE_KEY, dataUrl);
    window.localStorage.setItem(CUSTOM_SOUND_NAME_STORAGE_KEY, file.name);
    setCustomSoundUrl(dataUrl);
    setCustomSoundName(file.name);
  }, []);

  const clearCustomNotificationSound = useCallback(() => {
    window.localStorage.removeItem(CUSTOM_SOUND_STORAGE_KEY);
    window.localStorage.removeItem(CUSTOM_SOUND_NAME_STORAGE_KEY);
    setCustomSoundUrl("");
    setCustomSoundName("");
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const unlockAudio = () => {
      void getNotificationAudioContext();
    };

    window.addEventListener("pointerdown", unlockAudio, {
      capture: true,
      once: true,
    });
    window.addEventListener("keydown", unlockAudio, {
      capture: true,
      once: true,
    });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio, true);
      window.removeEventListener("keydown", unlockAudio, true);
    };
  }, [enabled, getNotificationAudioContext]);

  useEffect(() => {
    const stopAlarm = () => {
      if (alarmIntervalRef.current !== null) {
        window.clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }

      if (customAudioRef.current) {
        customAudioRef.current.pause();
        customAudioRef.current.currentTime = 0;
        customAudioRef.current = null;
      }
    };

    stopAlarm();

    if (!enabled || !soundEnabled || !hasPendingAlarm) {
      return stopAlarm;
    }

    if (customSoundUrl) {
      const audio = new Audio(customSoundUrl);
      audio.loop = true;
      audio.volume = 1;
      customAudioRef.current = audio;
      void audio.play().catch((error) => {
        console.warn("Custom notification sound could not be played:", error);
      });
      return stopAlarm;
    }

    void playNotificationTone();
    alarmIntervalRef.current = window.setInterval(() => {
      void playNotificationTone();
    }, 1800);

    return stopAlarm;
  }, [customSoundUrl, enabled, hasPendingAlarm, playNotificationTone, soundEnabled]);

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
    },
    []
  );

  useEffect(() => {
    if (!enabled) {
      setNotifications([]);
      setHasUnseen(false);
      setDismissedNotificationIds(new Set());
      knownPendingOrderIdsRef.current = new Set();
      pendingAlarmOrderIdsRef.current = new Set();
      setHasPendingAlarm(false);
      hasLoadedInitiallyRef.current = false;
      return;
    }

    // Carregar pedidos pendentes do Supabase
    const loadPendingOrders = async () => {
      console.log('Loading pending orders for notifications...');
      if (!user?.tenantId) return;

      const { data: orders, error } = await supabase
        .from("orders")
        .select("*")
        .eq("tenant_id", user?.tenantId)
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
        }

        knownPendingOrderIdsRef.current = nextPendingIds;
        pendingAlarmOrderIdsRef.current = nextPendingIds;
        setHasPendingAlarm(nextPendingIds.size > 0);
      }
    };

    loadPendingOrders();
    
    // Recarregar notificações a cada 30 segundos como fallback
    const interval = setInterval(loadPendingOrders, 10000);

    // Inscrever para mudanças nos pedidos
    const subscription = supabase
      .channel("orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const newOrder = payload.new as Order;
          if (newOrder.tenant_id !== user?.tenantId) return;
          console.log('New order received:', newOrder);
          if (
            newOrder.status === "pending" &&
            !dismissedNotificationIds.has(newOrder.id)
          ) {
            pendingAlarmOrderIdsRef.current.add(newOrder.id);
            setHasPendingAlarm(true);
            notifyNewOrder(newOrder);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updatedOrder = payload.new as Order;
          if (updatedOrder.tenant_id !== user?.tenantId) return;
          const oldOrder = payload.old as Partial<Order>;
          console.log('Order updated:', { old: oldOrder, new: updatedOrder });

          if (updatedOrder.status === "pending") {
            pendingAlarmOrderIdsRef.current.add(updatedOrder.id);
          } else {
            pendingAlarmOrderIdsRef.current.delete(updatedOrder.id);
          }
          setHasPendingAlarm(pendingAlarmOrderIdsRef.current.size > 0);
          
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
    soundEnabled,
    enableNotificationSound,
    customSoundName,
    saveCustomNotificationSound,
    clearCustomNotificationSound,
  };
}



