import { useEffect, useState } from 'react';

// TodayUtility: today's local calendar date, for anything that compares dates
// with it (a goal overdue, due this month). A page left open past midnight
// moves on to the new day by itself — no journey knowledge.

/**
 * Writes a moment's local calendar date.
 *
 * @param date - The moment, e.g. now.
 * @returns Its local date, `YYYY-MM-DD`.
 */
export const isoDateOf = (date: Date): string => [
  String(date.getFullYear()).padStart(4, '0'),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

/**
 * Tells how long until the next local midnight.
 *
 * @param now - The moment to count from.
 * @returns Milliseconds until the next day starts.
 */
export const msUntilMidnight = (now: Date): number => {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return midnight.getTime() - now.getTime();
};

/**
 * Holds today's local date, moving to the next one at midnight.
 *
 * @returns Today, `YYYY-MM-DD`.
 */
export default function useToday(): string {
  const [today, setToday] = useState(() => isoDateOf(new Date()));

  useEffect(() => {
    const timer = setTimeout(() => setToday(isoDateOf(new Date())), msUntilMidnight(new Date()));
    return () => clearTimeout(timer);
  }, [today]);

  return today;
}
