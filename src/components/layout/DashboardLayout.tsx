
import React, { useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { useAuth } from '@/contexts/AuthContext';
import { getBillingDaysRemaining, isBillingUrgent, shouldBlockTenantAccess, shouldShowBillingBarrier } from '@/lib/trial';
import { PaywallScreen } from '@/components/billing/PaywallScreen';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const BILLING_ALERT_PLAYED_KEY = 'billing_alert_played';
const BILLING_REMINDER_KEY = 'billing_reminder_snoozed';

function playBillingAlertSound() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  const gain = audioContext.createGain();
  gain.connect(audioContext.destination);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);

  const scheduleBeep = (startAt: number) => {
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, startAt);
    oscillator.connect(gain);

    gain.gain.exponentialRampToValueAtTime(0.035, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18);

    oscillator.start(startAt);
    oscillator.stop(startAt + 0.2);
  };

  const now = audioContext.currentTime;
  scheduleBeep(now);
  scheduleBeep(now + 0.28);

  window.setTimeout(() => {
    void audioContext.close().catch(() => undefined);
  }, 900);
}

export function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isRetentionModalOpen, setIsRetentionModalOpen] = useState(false);
  const [isRenewalPaywallOpen, setIsRenewalPaywallOpen] = useState(false);
  const { user } = useAuth();
  const accessBlocked =
    !user?.isSuperAdmin &&
    shouldBlockTenantAccess({
      trialEndsAt: user?.trialEndsAt,
      tenantStatus: user?.tenantStatus,
      subscriptionPeriodEnd: user?.subscriptionCurrentPeriodEnd,
      subscriptionStatus: user?.subscriptionStatus,
    });
  const daysRemaining = useMemo(
    () =>
      getBillingDaysRemaining({
        trialEndsAt: user?.trialEndsAt,
        subscriptionPeriodEnd: user?.subscriptionCurrentPeriodEnd,
      }),
    [user?.subscriptionCurrentPeriodEnd, user?.trialEndsAt]
  );
  const billingUrgent = isBillingUrgent(daysRemaining);
  const shouldOpenRetentionModal =
    !user?.isSuperAdmin &&
    !accessBlocked &&
    shouldShowBillingBarrier(daysRemaining);

  useEffect(() => {
    if (!billingUrgent) {
      return;
    }

    if (sessionStorage.getItem(BILLING_ALERT_PLAYED_KEY) === '1') {
      return;
    }

    sessionStorage.setItem(BILLING_ALERT_PLAYED_KEY, '1');

    try {
      playBillingAlertSound();
    } catch {
      // O navegador pode bloquear autoplay sem gesto do usuário.
    }
  }, [billingUrgent]);

  useEffect(() => {
    if (!shouldOpenRetentionModal) {
      setIsRetentionModalOpen(false);
      return;
    }

    if (sessionStorage.getItem(BILLING_REMINDER_KEY) === '1') {
      return;
    }

    setIsRetentionModalOpen(true);
  }, [shouldOpenRetentionModal]);

  const handleRememberLater = () => {
    sessionStorage.setItem(BILLING_REMINDER_KEY, '1');
    setIsRetentionModalOpen(false);
  };

  const handleRegularizeNow = () => {
    setIsRetentionModalOpen(false);
    setIsRenewalPaywallOpen(true);
  };

  if (accessBlocked) {
    return <PaywallScreen />;
  }

  return (
    <div className="flex min-h-screen">
      {/* Fixed sidebar - doesn't scroll with the content */}
      <Sidebar 
        className="hidden md:block md:fixed h-screen z-10" 
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      
      {/* Content area with dynamic left padding based on sidebar state */}
      <div className={`flex flex-col flex-1 w-full transition-all duration-300 ${
        sidebarCollapsed ? 'md:pl-16' : 'md:pl-64'
      }`}>
        <MobileNav />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <Dialog open={isRetentionModalOpen} onOpenChange={(open) => {
        if (!open) {
          handleRememberLater();
          return;
        }

        setIsRetentionModalOpen(true);
      }}>
        <DialogContent className="z-[120] max-w-xl border-red-500/20 bg-zinc-950 text-white">
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="text-2xl font-semibold text-white">
              Atenção: Assinatura Vencendo!
            </DialogTitle>
            <DialogDescription className="text-base leading-7 text-zinc-300">
              Sua assinatura expira em breve. Evite a suspensão do painel e do PDV. Regularize agora para não interromper suas vendas.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
            {daysRemaining === 0 ? 'Vence hoje.' : `Faltam ${daysRemaining} dia(s) para o vencimento.`}
          </div>

          <DialogFooter className="gap-3 sm:justify-start">
            <Button type="button" className="bg-red-500 text-white hover:bg-red-400" onClick={handleRegularizeNow}>
              Regularizar Agora
            </Button>
            <Button type="button" variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10" onClick={handleRememberLater}>
              Lembrar mais tarde
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaywallScreen
        mode="renewal"
        open={isRenewalPaywallOpen}
        onOpenChange={setIsRenewalPaywallOpen}
      />
    </div>
  );
}



