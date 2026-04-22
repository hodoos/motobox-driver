export const DASHBOARD_SECTION_EVENT = "motobox:open-dashboard-section";
export const DASHBOARD_SECTION_STORAGE_KEY = "motobox:dashboard-section";

export type DashboardSectionId =
  | "home"
  | "work-summary"
  | "today-quick-card"
  | "stats"
  | "daily-sales-list"
  | "work-calendar";

export function isDashboardSectionId(value: string | null): value is DashboardSectionId {
  return (
    value === "home" ||
    value === "work-summary" ||
    value === "today-quick-card" ||
    value === "stats" ||
    value === "daily-sales-list" ||
    value === "work-calendar"
  );
}