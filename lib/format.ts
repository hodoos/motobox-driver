export function formatMoney(value: number) {
  return `${value.toLocaleString()}원`;
}

export function getKoreanDayLabel(day: number) {
  return ["일", "월", "화", "수", "목", "금", "토"][day];
}

export function toDateString(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}