import {
  calculateDueDate,
  calculateBusinessMinutesElapsed,
  isWithinReopenWindow,
  isBusinessDay,
  snapToNextBusinessMoment,
} from './sla-calculator';
import { DateTime } from 'luxon';

describe('SlaCalculator (Pure Functions - Asia/Kolkata)', () => {
  const holidays = ['2026-01-26', '2026-08-15', '2026-10-02']; // Republic Day, Independence Day, Gandhi Jayanti

  describe('isBusinessDay', () => {
    it('identifies Monday through Friday as business days when not holidays', () => {
      // 2026-10-05 is a Monday
      const monday = DateTime.fromISO('2026-10-05T10:00:00', { zone: 'Asia/Kolkata' });
      expect(isBusinessDay(monday, holidays)).toBe(true);
    });

    it('identifies Saturday and Sunday as non-business days', () => {
      // 2026-10-03 is Saturday, 2026-10-04 is Sunday
      const saturday = DateTime.fromISO('2026-10-03T10:00:00', { zone: 'Asia/Kolkata' });
      const sunday = DateTime.fromISO('2026-10-04T10:00:00', { zone: 'Asia/Kolkata' });
      expect(isBusinessDay(saturday, holidays)).toBe(false);
      expect(isBusinessDay(sunday, holidays)).toBe(false);
    });

    it('identifies gazetted holidays as non-business days', () => {
      // 2026-10-02 is Gandhi Jayanti (Friday)
      const holiday = DateTime.fromISO('2026-10-02T10:00:00', { zone: 'Asia/Kolkata' });
      expect(isBusinessDay(holiday, holidays)).toBe(false);
    });
  });

  describe('snapToNextBusinessMoment', () => {
    it('snaps after-hours ticket to 09:00 next business day', () => {
      // Monday 2026-10-05 at 20:00 IST -> Tuesday 2026-10-06 at 09:00 IST
      const evening = DateTime.fromISO('2026-10-05T20:00:00', { zone: 'Asia/Kolkata' });
      const snapped = snapToNextBusinessMoment(evening, holidays);
      expect(snapped.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-10-06 09:00');
    });

    it('snaps weekend ticket to Monday 09:00 IST', () => {
      // Saturday 2026-10-03 at 14:00 IST -> Monday 2026-10-05 at 09:00 IST
      const saturday = DateTime.fromISO('2026-10-03T14:00:00', { zone: 'Asia/Kolkata' });
      const snapped = snapToNextBusinessMoment(saturday, holidays);
      expect(snapped.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-10-05 09:00');
    });
  });

  describe('calculateDueDate', () => {
    it('calculates due date within the same business day', () => {
      // Monday 2026-10-05 at 10:00 IST + 120 mins -> Monday 12:00 IST
      const start = '2026-10-05T10:00:00+05:30';
      const due = calculateDueDate(start, 120, holidays);
      const dueIst = DateTime.fromJSDate(due, { zone: 'Asia/Kolkata' });
      expect(dueIst.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-10-05 12:00');
    });

    it('spans overnight to next business day at 09:00 IST', () => {
      // Monday 2026-10-05 at 17:00 IST + 120 mins:
      // 1 hour left today (17:00 -> 18:00), remaining 60 mins into Tuesday 09:00 -> 10:00 IST
      const start = '2026-10-05T17:00:00+05:30';
      const due = calculateDueDate(start, 120, holidays);
      const dueIst = DateTime.fromJSDate(due, { zone: 'Asia/Kolkata' });
      expect(dueIst.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-10-06 10:00');
    });

    it('spans over the weekend (Friday afternoon into Monday)', () => {
      // Friday 2026-10-09 at 16:00 IST + 240 mins (4 hours):
      // 2 hours on Friday (16:00 -> 18:00), skips Sat/Sun, remaining 2 hours on Monday (09:00 -> 11:00 IST)
      const start = '2026-10-09T16:00:00+05:30';
      const due = calculateDueDate(start, 240, holidays);
      const dueIst = DateTime.fromJSDate(due, { zone: 'Asia/Kolkata' });
      expect(dueIst.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-10-12 11:00');
    });

    it('spans over gazetted holidays', () => {
      // Thursday 2026-10-01 at 17:00 IST + 180 mins:
      // 1 hour on Thursday (17:00 -> 18:00).
      // Friday 2026-10-02 is Gandhi Jayanti (holiday - skipped).
      // Saturday 2026-10-03 & Sunday 2026-10-04 (weekend - skipped).
      // Remaining 120 mins applied to Monday 2026-10-05 (09:00 -> 11:00 IST).
      const start = '2026-10-01T17:00:00+05:30';
      const due = calculateDueDate(start, 180, holidays);
      const dueIst = DateTime.fromJSDate(due, { zone: 'Asia/Kolkata' });
      expect(dueIst.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-10-05 11:00');
    });
  });

  describe('calculateBusinessMinutesElapsed', () => {
    it('calculates elapsed minutes during working hours', () => {
      // Monday 10:00 IST to 11:30 IST -> 90 minutes
      const start = '2026-10-05T10:00:00+05:30';
      const end = '2026-10-05T11:30:00+05:30';
      expect(calculateBusinessMinutesElapsed(start, end, holidays)).toBe(90);
    });

    it('excludes night hours, weekends, and holidays from paused duration', () => {
      // Paused Friday 17:00 IST, resumed Monday 10:00 IST:
      // Friday: 17:00 -> 18:00 = 60 mins
      // Weekend: 0 mins
      // Monday: 09:00 -> 10:00 = 60 mins
      // Total business minutes paused = 120 mins
      const start = '2026-10-09T17:00:00+05:30';
      const end = '2026-10-12T10:00:00+05:30';
      expect(calculateBusinessMinutesElapsed(start, end, holidays)).toBe(120);
    });
  });

  describe('isWithinReopenWindow', () => {
    it('returns true if within 72 calendar hours', () => {
      const resolvedAt = new Date('2026-10-01T10:00:00Z');
      const at48Hours = new Date('2026-10-03T10:00:00Z');
      expect(isWithinReopenWindow(resolvedAt, at48Hours)).toBe(true);
    });

    it('returns false if past 72 calendar hours', () => {
      const resolvedAt = new Date('2026-10-01T10:00:00Z');
      const at73Hours = new Date('2026-10-04T11:00:00Z');
      expect(isWithinReopenWindow(resolvedAt, at73Hours)).toBe(false);
    });
  });
});
