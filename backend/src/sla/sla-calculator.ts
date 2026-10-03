import { DateTime } from 'luxon';

export interface SlaCalculatorOptions {
  zone?: string; // Default: 'Asia/Kolkata'
  businessStartHour?: number; // Default: 9 (09:00)
  businessEndHour?: number; // Default: 18 (18:00)
}

const DEFAULT_ZONE = 'Asia/Kolkata';
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 18;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Checks if a given Luxon DateTime is a business day (Monday-Friday and not a holiday).
 */
export function isBusinessDay(
  dt: DateTime,
  holidayDateStrings: string[],
): boolean {
  // 1 = Monday, 7 = Sunday
  if (dt.weekday === 6 || dt.weekday === 7) {
    return false;
  }
  const dateStr = dt.toFormat('yyyy-MM-dd');
  return !holidayDateStrings.includes(dateStr);
}

/**
 * Normalizes an arbitrary timestamp to the current or next valid business moment.
 * If the moment is before 09:00 on a business day, it moves forward to 09:00.
 * If the moment is after 18:00, on a weekend, or on a holiday, it advances to 09:00 on the next business day.
 */
export function snapToNextBusinessMoment(
  dt: any,
  holidayDateStrings: string[],
  startHour = DEFAULT_START_HOUR,
  endHour = DEFAULT_END_HOUR,
): any {
  let current: any = dt;

  while (true) {
    if (!isBusinessDay(current, holidayDateStrings)) {
      // Advance to next day at business start hour
      current = current.plus({ days: 1 }).set({
        hour: startHour,
        minute: 0,
        second: 0,
        millisecond: 0,
      });
      continue;
    }

    if (current.hour < startHour) {
      return current.set({
        hour: startHour,
        minute: 0,
        second: 0,
        millisecond: 0,
      });
    }

    if (current.hour >= endHour) {
      current = current.plus({ days: 1 }).set({
        hour: startHour,
        minute: 0,
        second: 0,
        millisecond: 0,
      });
      continue;
    }

    return current;
  }
}

/**
 * Pure function: Calculates due date by adding business minutes across working hours (09:00 - 18:00 IST),
 * weekends, and company holidays.
 *
 * Guaranteed invariant to host operating system or container process timezone.
 */
export function calculateDueDate(
  startInstant: Date | string,
  durationMinutes: number,
  holidayDateStrings: string[] = [],
  options: SlaCalculatorOptions = {},
): Date {
  const zone = options.zone || DEFAULT_ZONE;
  const startHour = options.businessStartHour ?? DEFAULT_START_HOUR;
  const endHour = options.businessEndHour ?? DEFAULT_END_HOUR;

  const rawDt = typeof startInstant === 'string'
    ? DateTime.fromISO(startInstant, { zone })
    : DateTime.fromJSDate(startInstant, { zone });

  let current = snapToNextBusinessMoment(rawDt, holidayDateStrings, startHour, endHour);
  let remainingMinutes = durationMinutes;

  while (remainingMinutes > 0) {
    const endOfDay = current.set({
      hour: endHour,
      minute: 0,
      second: 0,
      millisecond: 0,
    });

    const minutesLeftToday = Math.max(0, endOfDay.diff(current, 'minutes').minutes);

    if (remainingMinutes <= minutesLeftToday) {
      current = current.plus({ minutes: remainingMinutes });
      remainingMinutes = 0;
    } else {
      remainingMinutes -= minutesLeftToday;
      // Advance to 09:00 on the next business day
      current = snapToNextBusinessMoment(
        current.plus({ days: 1 }).set({
          hour: startHour,
          minute: 0,
          second: 0,
          millisecond: 0,
        }),
        holidayDateStrings,
        startHour,
        endHour,
      );
    }
  }

  return current.toJSDate();
}

/**
 * Pure function: Calculates business minutes elapsed during a pause interval.
 * Used when a ticket transitions WAITING_ON_REQUESTER -> IN_PROGRESS.
 */
export function calculateBusinessMinutesElapsed(
  startInstant: Date | string,
  endInstant: Date | string,
  holidayDateStrings: string[] = [],
  options: SlaCalculatorOptions = {},
): number {
  const zone = options.zone || DEFAULT_ZONE;
  const startHour = options.businessStartHour ?? DEFAULT_START_HOUR;
  const endHour = options.businessEndHour ?? DEFAULT_END_HOUR;

  let current: DateTime = typeof startInstant === 'string'
    ? DateTime.fromISO(startInstant, { zone })
    : DateTime.fromJSDate(startInstant, { zone });

  const end: DateTime = typeof endInstant === 'string'
    ? DateTime.fromISO(endInstant, { zone })
    : DateTime.fromJSDate(endInstant, { zone });

  if (current >= end) {
    return 0;
  }

  current = snapToNextBusinessMoment(current, holidayDateStrings, startHour, endHour);
  if (current >= end) {
    return 0;
  }

  let totalMinutes = 0;

  while (current < end) {
    if (!isBusinessDay(current, holidayDateStrings)) {
      current = current.plus({ days: 1 }).set({
        hour: startHour,
        minute: 0,
        second: 0,
        millisecond: 0,
      });
      continue;
    }

    const endOfCurrentBusinessDay = current.set({
      hour: endHour,
      minute: 0,
      second: 0,
      millisecond: 0,
    });

    const windowEnd = end < endOfCurrentBusinessDay ? end : endOfCurrentBusinessDay;
    const diffMins = Math.max(0, windowEnd.diff(current, 'minutes').minutes);
    totalMinutes += diffMins;

    if (end <= endOfCurrentBusinessDay) {
      break;
    }

    current = snapToNextBusinessMoment(
      current.plus({ days: 1 }).set({
        hour: startHour,
        minute: 0,
        second: 0,
        millisecond: 0,
      }),
      holidayDateStrings,
      startHour,
      endHour,
    );
  }

  return Math.round(totalMinutes);
}

/**
 * Pure function: Extends due dates by elapsed paused business minutes.
 */
export function extendDueDate(
  originalDueDate: Date | string,
  pausedBusinessMinutes: number,
  holidayDateStrings: string[] = [],
  options: SlaCalculatorOptions = {},
): Date {
  return calculateDueDate(
    originalDueDate,
    pausedBusinessMinutes,
    holidayDateStrings,
    options,
  );
}

/**
 * Pure function: Evaluates whether a resolved ticket is within the 72-hour reopen window.
 * Uses flat calendar wall-clock duration (Decision 008/009 recommendation) anchored to UTC timestamps.
 */
export function isWithinReopenWindow(
  resolvedAt: Date | string,
  now: Date | string = new Date(),
): boolean {
  const resolvedMs = typeof resolvedAt === 'string'
    ? new Date(resolvedAt).getTime()
    : resolvedAt.getTime();

  const nowMs = typeof now === 'string'
    ? new Date(now).getTime()
    : now.getTime();

  const elapsed = nowMs - resolvedMs;
  return elapsed >= 0 && elapsed <= THREE_DAYS_MS;
}
