export const DASHBOARD_SECTION_EVENT = "motobox:open-dashboard-section";
export const DASHBOARD_SECTION_STORAGE_KEY = "motobox:dashboard-section";

export type DashboardSectionId = "home" | "today-quick-card" | "stats" | "work-calendar";

export function isDashboardSectionId(value: string | null): value is DashboardSectionId {
  return (
    value === "home" ||
    value === "today-quick-card" ||
    value === "stats" ||
    value === "work-calendar"
  );
}