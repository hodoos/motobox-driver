import { DailyReportRow } from "../types";

export type ReportDayStatus =
  | "worked"
  | "weekly-off"
  | "biweekly-off"
  | "additional-off"
  | "empty";

export function hasWorkActivity(report?: DailyReportRow | null) {
  return Boolean(
    report &&
      (report.delivered_count > 0 ||
        report.returned_count > 0 ||
        report.canceled_count > 0 ||
        (report.memo && report.memo.trim() !== "") ||
        report.unit_price_override)
  );
}

export function getReportDayStatus({
  report,
  isWeeklyRegularOff,
  isBiweeklyRegularOff,
}: {
  report?: DailyReportRow | null;
  isWeeklyRegularOff: boolean;
  isBiweeklyRegularOff: boolean;
}): ReportDayStatus {
  if (hasWorkActivity(report)) {
    return "worked";
  }

  if (isWeeklyRegularOff) {
    return "weekly-off";
  }

  if (isBiweeklyRegularOff) {
    return "biweekly-off";
  }

  if (report?.is_day_off) {
    return "additional-off";
  }

  return "empty";
}

export function isRegularOffStatus(status: ReportDayStatus) {
  return status === "weekly-off" || status === "biweekly-off";
}

export function getReportDayStatusLabel(status: ReportDayStatus) {
  switch (status) {
    case "worked":
      return "근무";
    case "weekly-off":
      return "정기휴무";
    case "biweekly-off":
      return "격주휴무";
    case "additional-off":
      return "추가휴무";
    default:
      return "미입력";
  }
}