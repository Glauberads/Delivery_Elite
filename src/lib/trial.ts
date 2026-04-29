type TenantAccessRuleInput = {
  trialEndsAt?: string | null;
  tenantStatus?: string | null;
  subscriptionPeriodEnd?: string | null;
  subscriptionStatus?: string | null;
};

type BillingCountdownInput = {
  trialEndsAt?: string | null;
  subscriptionPeriodEnd?: string | null;
};

function isPastDate(value?: string | null) {
  if (!value) {
    return true;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return true;
  }

  return date.getTime() < Date.now();
}

function isManualBlockedStatus(value?: string | null) {
  const status = String(value ?? "").toLowerCase();
  return (
    status === "suspended" ||
    status === "inactive" ||
    status === "overdue" ||
    status === "past_due" ||
    status === "expired" ||
    status === "inadimplente" ||
    status === "cancelled" ||
    status === "canceled"
  );
}

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function getBillingExpiryDate({
  trialEndsAt,
  subscriptionPeriodEnd,
}: BillingCountdownInput) {
  return subscriptionPeriodEnd ?? trialEndsAt ?? null;
}

export function getBillingDaysRemaining({
  trialEndsAt,
  subscriptionPeriodEnd,
}: BillingCountdownInput) {
  const billingEndDate = parseDate(getBillingExpiryDate({ trialEndsAt, subscriptionPeriodEnd }));

  if (!billingEndDate) {
    return null;
  }

  const today = new Date();
  return Math.ceil((billingEndDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
}

export function isBillingUrgent(daysRemaining?: number | null) {
  return typeof daysRemaining === "number" && daysRemaining >= 0 && daysRemaining <= 3;
}

export function shouldShowBillingBarrier(daysRemaining?: number | null) {
  return typeof daysRemaining === "number" && (daysRemaining === 0 || daysRemaining === 1);
}

export function shouldBlockTenantAccess({
  trialEndsAt,
  tenantStatus,
  subscriptionPeriodEnd,
  subscriptionStatus,
}: TenantAccessRuleInput) {
  const manuallyBlocked = isManualBlockedStatus(tenantStatus);
  const normalizedSubscriptionStatus = String(subscriptionStatus ?? "").toLowerCase();
  const hasSubscriptionSignal = Boolean(subscriptionStatus || subscriptionPeriodEnd);
  const hasValidTrial = !isPastDate(trialEndsAt);
  const hasSubscriptionPeriod = Boolean(parseDate(subscriptionPeriodEnd));
  const subscriptionExpired = isPastDate(subscriptionPeriodEnd);

  if (manuallyBlocked) {
    return true;
  }

  // Quando existe assinatura vinculada, o acesso passa a depender da assinatura.
  if (hasSubscriptionSignal) {
    if (normalizedSubscriptionStatus === "trialing" && !hasSubscriptionPeriod) {
      return !hasValidTrial;
    }

    if (normalizedSubscriptionStatus !== "active" && normalizedSubscriptionStatus !== "trialing") {
      return true;
    }

    if (!hasSubscriptionPeriod) {
      return true;
    }

    return subscriptionExpired;
  }

  // Sem assinatura vinculada, mantém compatibilidade com trial.
  return !hasValidTrial;
}



