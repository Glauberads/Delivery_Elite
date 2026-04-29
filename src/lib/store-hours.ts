export type PublicBusinessHour = {
  day_of_week: string | null;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean | null;
};

type StoreAvailabilityInput = {
  businessHours?: PublicBusinessHour[] | null;
  restaurantOpenTime?: string | null;
  restaurantCloseTime?: string | null;
  now?: Date;
};

type StoreAvailabilitySource = "business_hours" | "restaurant" | "none";

export type StoreAvailability = {
  isOpenNow: boolean;
  isOutsideBusinessHours: boolean;
  hasScheduleConfigured: boolean;
  source: StoreAvailabilitySource;
};

const DAYS_IN_PORTUGUESE = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getTodayInPortuguese(now: Date) {
  return DAYS_IN_PORTUGUESE[now.getDay()];
}

function toMinutes(value?: string | null) {
  if (!value) {
    return null;
  }

  const [hourPart, minutePart] = value.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}

function isInsideWindow(currentMinutes: number, openMinutes: number, closeMinutes: number) {
  if (openMinutes === closeMinutes) {
    return true;
  }

  if (closeMinutes > openMinutes) {
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  }

  // Janela virando o dia (ex.: 18:00 até 02:00)
  return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
}

export function evaluatePublicStoreAvailability({
  businessHours,
  restaurantOpenTime,
  restaurantCloseTime,
  now = new Date(),
}: StoreAvailabilityInput): StoreAvailability {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayNormalized = normalizeText(getTodayInPortuguese(now));
  const normalizedRows = (businessHours ?? []).filter((row) => normalizeText(row.day_of_week).length > 0);

  if (normalizedRows.length > 0) {
    const todayRows = normalizedRows.filter(
      (row) => normalizeText(row.day_of_week) === todayNormalized
    );

    if (todayRows.length === 0) {
      return {
        isOpenNow: false,
        isOutsideBusinessHours: true,
        hasScheduleConfigured: true,
        source: "business_hours",
      };
    }

    const openWindows = todayRows
      .filter((row) => !row.is_closed)
      .map((row) => ({
        openMinutes: toMinutes(row.open_time),
        closeMinutes: toMinutes(row.close_time),
      }))
      .filter(
        (
          row
        ): row is {
          openMinutes: number;
          closeMinutes: number;
        } => row.openMinutes !== null && row.closeMinutes !== null
      );

    if (openWindows.length === 0) {
      return {
        isOpenNow: false,
        isOutsideBusinessHours: true,
        hasScheduleConfigured: true,
        source: "business_hours",
      };
    }

    const isOpenNow = openWindows.some((window) =>
      isInsideWindow(currentMinutes, window.openMinutes, window.closeMinutes)
    );

    return {
      isOpenNow,
      isOutsideBusinessHours: !isOpenNow,
      hasScheduleConfigured: true,
      source: "business_hours",
    };
  }

  const fallbackOpenMinutes = toMinutes(restaurantOpenTime);
  const fallbackCloseMinutes = toMinutes(restaurantCloseTime);

  if (fallbackOpenMinutes !== null && fallbackCloseMinutes !== null) {
    const isOpenNow = isInsideWindow(currentMinutes, fallbackOpenMinutes, fallbackCloseMinutes);

    return {
      isOpenNow,
      isOutsideBusinessHours: !isOpenNow,
      hasScheduleConfigured: true,
      source: "restaurant",
    };
  }

  return {
    isOpenNow: true,
    isOutsideBusinessHours: false,
    hasScheduleConfigured: false,
    source: "none",
  };
}



