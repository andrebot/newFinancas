import { describe, expect, it } from 'vitest';
import calendarDate from '../../../src/utilities/calendar';

describe('calendarDate', () => {
  it.each([
    ['2026-10-17T02:59:59Z', '2026-10-16'],
    ['2026-10-17T03:00:00Z', '2026-10-17'],
    ['2026-01-01T02:00:00Z', '2025-12-31'],
  ])('reads %s as %s in São Paulo (UTC−3)', (instant, date) => {
    expect(calendarDate(new Date(instant), 'America/Sao_Paulo')).toBe(date);
  });

  it('follows the time zone it is given', () => {
    expect(calendarDate(new Date('2026-10-17T02:00:00Z'), 'UTC')).toBe('2026-10-17');
  });
});
