export type SubscriptionPeriodSnapshot = {
  id?: string | null;
  plan_id?: string | null;
  status?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function parseDateMs(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getTime();
}

function getMaxDateMs(values: Array<string | null | undefined>) {
  let maxMs: number | null = null;

  for (const value of values) {
    const dateMs = parseDateMs(value);
    if (dateMs === null) {
      continue;
    }

    if (maxMs === null || dateMs > maxMs) {
      maxMs = dateMs;
    }
  }

  return maxMs;
}

function getSubscriptionStatusRank(value?: string | null) {
  const status = String(value ?? "").toLowerCase();

  if (status === "active") return 4;
  if (status === "trialing") return 3;
  if (status === "past_due") return 2;
  if (status === "canceled" || status === "cancelled") return 1;
  return 0;
}

function isEffectiveSubscription(subscription: SubscriptionPeriodSnapshot, nowMs: number) {
  const periodEnd = parseDateMs(subscription.current_period_end);
  if (periodEnd === null) {
    return false;
  }

  const periodStart = parseDateMs(subscription.current_period_start);

  if (periodStart !== null) {
    return periodStart <= nowMs && periodEnd >= nowMs;
  }

  return periodEnd >= nowMs;
}

function compareSubscriptions(a: SubscriptionPeriodSnapshot, b: SubscriptionPeriodSnapshot) {
  const statusDiff = getSubscriptionStatusRank(b.status) - getSubscriptionStatusRank(a.status);
  if (statusDiff !== 0) {
    return statusDiff;
  }

  const periodEndDiff =
    (parseDateMs(b.current_period_end) ?? Number.NEGATIVE_INFINITY) -
    (parseDateMs(a.current_period_end) ?? Number.NEGATIVE_INFINITY);
  if (periodEndDiff !== 0) {
    return periodEndDiff;
  }

  const updatedAtDiff =
    (parseDateMs(b.updated_at) ?? Number.NEGATIVE_INFINITY) -
    (parseDateMs(a.updated_at) ?? Number.NEGATIVE_INFINITY);
  if (updatedAtDiff !== 0) {
    return updatedAtDiff;
  }

  return (
    (parseDateMs(b.created_at) ?? Number.NEGATIVE_INFINITY) -
    (parseDateMs(a.created_at) ?? Number.NEGATIVE_INFINITY)
  );
}

export function selectCurrentSubscription(
  subscriptions: SubscriptionPeriodSnapshot[],
  now = new Date(),
) {
  if (!subscriptions.length) {
    return null;
  }

  const nowMs = now.getTime();
  const effectiveSubscriptions = subscriptions.filter((subscription) =>
    isEffectiveSubscription(subscription, nowMs)
  );
  const candidatePool = effectiveSubscriptions.length > 0 ? effectiveSubscriptions : subscriptions;
  const sorted = [...candidatePool].sort((left, right) => {
    // Quando não há assinatura "efetiva agora", prioriza a maior vigência conhecida
    // para evitar escolher linha ativa sem current_period_end em cenários legados.
    if (effectiveSubscriptions.length === 0) {
      const leftMs = parseDateMs(left.current_period_end) ?? Number.NEGATIVE_INFINITY;
      const rightMs = parseDateMs(right.current_period_end) ?? Number.NEGATIVE_INFINITY;
      const periodEndDiff = rightMs - leftMs;
      if (periodEndDiff !== 0) {
        return periodEndDiff;
      }
    }

    return compareSubscriptions(left, right);
  });

  return sorted[0] ?? null;
}

export function resolveCarryOverBaseDate(now: Date, currentPeriodEnd?: string | null) {
  const periodEndMs = parseDateMs(currentPeriodEnd);
  if (periodEndMs !== null && periodEndMs > now.getTime()) {
    return new Date(periodEndMs);
  }

  return new Date(now);
}

export function resolveCarryOverBaseDateFromCandidates(
  now: Date,
  candidates: Array<string | null | undefined>,
) {
  const maxCandidateMs = getMaxDateMs(candidates);

  if (maxCandidateMs !== null && maxCandidateMs > now.getTime()) {
    return new Date(maxCandidateMs);
  }

  return new Date(now);
}



