export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function eachDateBetween(start: Date, end: Date) {
  const result: Date[] = [];
  const current = new Date(start);

  while (current <= end) {
    result.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return result;
}

export function buildSettlementCalendarGrid(start: Date, end: Date) {
  const startDayOfWeek = start.getDay();
  const leadingNulls = Array.from({ length: startDayOfWeek }, () => null);
  const dates = eachDateBetween(start, end);
  const cells = [...leadingNulls, ...dates];

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export function getSettlementRange(
  baseDate: Date,
  startDay: number,
  startMonthOffset: number,
  endDay: number,
  endMonthOffset: number
) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  return {
    start: new Date(year, month + startMonthOffset, startDay),
    end: new Date(year, month + endMonthOffset, endDay),
  };
}

export function shiftSettlementAnchor(anchorDate: Date, diffMonths: number) {
  return new Date(
    anchorDate.getFullYear(),
    anchorDate.getMonth() + diffMonths,
    1
  );
}