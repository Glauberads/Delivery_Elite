import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { shouldBlockTenantAccess } from "@/lib/trial";
import { evaluatePublicStoreAvailability, type PublicBusinessHour } from "@/lib/store-hours";

export interface PublicTenant {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  status: string | null;
  trial_ends_at: string | null;
}

export interface PublicRestaurant {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  banner_url: string | null;
  open_time: string | null;
  close_time: string | null;
  delivery_fee: number | null;
  min_order_value: number | null;
}

interface PublicTenantPayload {
  tenant: PublicTenant;
  restaurant: PublicRestaurant | null;
  isBillingBlocked: boolean;
  isOutsideBusinessHours: boolean;
}

type TenantSubscriptionSnapshot = {
  status: string | null;
  current_period_end: string | null;
  current_period_start: string | null;
  created_at: string | null;
  updated_at: string | null;
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

function getSubscriptionStatusRank(value?: string | null) {
  const status = String(value ?? "").toLowerCase();

  if (status === "active") return 4;
  if (status === "trialing") return 3;
  if (status === "past_due") return 2;
  if (status === "canceled" || status === "cancelled") return 1;
  return 0;
}

function isEffectiveSubscription(subscription: TenantSubscriptionSnapshot, nowMs: number) {
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

function compareSubscriptions(a: TenantSubscriptionSnapshot, b: TenantSubscriptionSnapshot) {
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

function selectCurrentSubscription(subscriptions: TenantSubscriptionSnapshot[]) {
  if (!subscriptions.length) {
    return null;
  }

  const nowMs = Date.now();
  const effectiveSubscriptions = subscriptions.filter((subscription) =>
    isEffectiveSubscription(subscription, nowMs)
  );
  const candidatePool = effectiveSubscriptions.length > 0 ? effectiveSubscriptions : subscriptions;
  const sorted = [...candidatePool].sort(compareSubscriptions);

  return sorted[0] ?? null;
}

function isSubscriptionAccessError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const errorWithMessage = error as { code?: string; message?: string };
  const message = String(errorWithMessage.message ?? "").toLowerCase();

  return (
    errorWithMessage.code === "42501" ||
    errorWithMessage.code === "PGRST301" ||
    message.includes("permission denied") ||
    message.includes("row-level security")
  );
}

function isBlockedByTenantFallback(tenant: PublicTenant) {
  const status = String(tenant.status ?? "").toLowerCase();
  const manuallyBlocked =
    status === "suspended" ||
    status === "inactive" ||
    status === "overdue" ||
    status === "past_due" ||
    status === "expired" ||
    status === "inadimplente" ||
    status === "cancelled" ||
    status === "canceled";

  if (manuallyBlocked) {
    return true;
  }

  if (status === "trialing") {
    const trialEndMs = parseDateMs(tenant.trial_ends_at);
    return trialEndMs === null || trialEndMs < Date.now();
  }

  return false;
}

export function usePublicTenant(overrideSlug?: string) {
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const slug = overrideSlug || routeSlug;

  const query = useQuery<PublicTenantPayload | null, Error>({
    queryKey: ["public-tenant", slug],
    enabled: Boolean(slug),
    refetchInterval: 60_000,
    queryFn: async () => {
      if (!slug) {
        return null;
      }

      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("id, name, slug, phone, status, trial_ends_at")
        .eq("slug", slug)
        .maybeSingle();

      if (tenantError) {
        throw tenantError;
      }

      if (!tenant) {
        return null;
      }

      const [restaurantResult, subscriptionResult, businessHoursResult] = await Promise.all([
        supabase
          .from("restaurants")
          .select(
            "id, tenant_id, description, address, logo_url, banner_url, open_time, close_time, delivery_fee, min_order_value"
          )
          .eq("tenant_id", tenant.id)
          .maybeSingle(),
        supabase
          .from("tenant_subscriptions")
          .select("status, current_period_end, current_period_start, created_at, updated_at")
          .eq("tenant_id", tenant.id)
          .order("updated_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false, nullsFirst: false }),
        supabase
          .from("business_hours")
          .select("day_of_week, open_time, close_time, is_closed")
          .eq("tenant_id", tenant.id),
      ]);

      if (restaurantResult.error) {
        throw restaurantResult.error;
      }

      const subscriptionAccessError = subscriptionResult.error;
      const selectedSubscription = selectCurrentSubscription(subscriptionResult.data ?? []);
      const isBillingBlocked = subscriptionAccessError
        ? isBlockedByTenantFallback(tenant)
        : shouldBlockTenantAccess({
            trialEndsAt: tenant.trial_ends_at,
            tenantStatus: tenant.status,
            subscriptionPeriodEnd: selectedSubscription?.current_period_end ?? null,
            subscriptionStatus: selectedSubscription?.status ?? null,
          });

      if (subscriptionAccessError && !isSubscriptionAccessError(subscriptionAccessError)) {
        throw subscriptionAccessError;
      }

      if (businessHoursResult.error) {
        console.error("Erro ao consultar business_hours público:", businessHoursResult.error);
      }

      const schedule = evaluatePublicStoreAvailability({
        businessHours: (businessHoursResult.data ?? []) as PublicBusinessHour[],
        restaurantOpenTime: restaurantResult.data?.open_time ?? null,
        restaurantCloseTime: restaurantResult.data?.close_time ?? null,
      });

      const restaurant: PublicRestaurant = {
        id: restaurantResult.data?.id ?? tenant.id,
        tenant_id: tenant.id,
        name: tenant.name,
        description: restaurantResult.data?.description ?? null,
        address: restaurantResult.data?.address ?? null,
        phone: tenant.phone,
        logo_url: restaurantResult.data?.logo_url ?? null,
        banner_url: restaurantResult.data?.banner_url ?? null,
        open_time: restaurantResult.data?.open_time ?? null,
        close_time: restaurantResult.data?.close_time ?? null,
        delivery_fee: restaurantResult.data?.delivery_fee ?? null,
        min_order_value: restaurantResult.data?.min_order_value ?? null,
      };

      return {
        tenant,
        restaurant,
        isBillingBlocked,
        isOutsideBusinessHours: schedule.isOutsideBusinessHours,
      };
    },
  });

  const isNotFound = !query.isLoading && !query.isError && Boolean(slug) && !query.data;

  return {
    slug: slug ?? null,
    tenant: query.data?.tenant ?? null,
    tenantId: query.data?.tenant.id ?? null,
    restaurant: query.data?.restaurant ?? null,
    isBillingBlocked: query.data?.isBillingBlocked ?? false,
    isOutsideBusinessHours: query.data?.isOutsideBusinessHours ?? false,
    isNotFound,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}



