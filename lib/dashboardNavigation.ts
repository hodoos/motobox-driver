export const DASHBOARD_SECTION_EVENT = "motobox:open-dashboard-section";
export const DASHBOARD_SECTION_STORAGE_KEY = "motobox:dashboard-section";

export type DashboardSectionId = "today-quick-card" | "stats" | "work-calendar";

export function isDashboardSectionId(value: string | null): value is DashboardSectionId {
  return value === "today-quick-card" || value === "stats" || value === "work-calendar";
}