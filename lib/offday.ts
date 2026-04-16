import { startOfDay } from "./settlement";

export function startOfWeek(date: Date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function isBiweeklyOffDate(
  date: Date,
  biweeklyOffDays: number[],
  anchorDateString: string
) {
  if (!anchorDateString) return false;
  if (!biweeklyOffDays.includes(date.getDay())) return false;

  const anchor = new Date(anchorDateString);
  const weekA = startOfWeek(anchor);
  const weekB = startOfWeek(date);
  const diffMs = weekB.getTime() - weekA.getTime();
  const diffWeeks = Math.round(diffMs / (1000 * 60 * 60 * 24 * 7));

  return Math.abs(diffWeeks) % 2 === 0;
}