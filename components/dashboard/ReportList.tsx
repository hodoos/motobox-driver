import type { CSSProperties } from "react";
import { DailyReportRow } from "../../types";
import { formatMoney, getKoreanDayLabel, toDateString } from "../../lib/format";
import { isBiweeklyOffDate } from "../../lib/offday";
import {
  getReportDayStatus,
  getReportDayStatusLabel,
} from "../../lib/reportStatus";

const REPORT_META_MEMO_MARKER = /\n?\[\[MOTOBOX_REPORT_META:([\s\S]+)\]\]$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getReportExpenseTotal(rawMemo?: string | null) {
  if (!rawMemo) {
    return 0;
  }

  const markerMatch = rawMemo.match(REPORT_META_MEMO_MARKER);

  if (!markerMatch) {
    return 0;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(markerMatch[1]));

    if (!isRecord(parsed) || !Array.isArray(parsed.expenseItems)) {
      return 0;
    }

    return parsed.expenseItems.reduce((sum, item) => {
      if (!isRecord(item)) {
        return sum;
      }

      const amount = Number(item.amount ?? 0);
      return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
  } catch {
    return 0;
  }
}

function formatNegativeMoney(value: number) {
  return `-${formatMoney(value)}`;
}

const offStatusStyle: CSSProperties = {
  borderColor: "rgba(248, 113, 113, 0.72)",
  backgroundColor: "rgba(239, 68, 68, 0.28)",
  color: "#fee2e2",
};

const workedStatusStyle: CSSProperties = {
  borderColor: "rgba(52, 211, 153, 0.72)",
  backgroundColor: "rgba(16, 185, 129, 0.28)",
  color: "#d1fae5",
};

const offCardStyle: CSSProperties = {
  borderColor: "rgba(248, 113, 113, 0.9)",
  borderWidth: "2px",
};

const workedCardStyle: CSSProperties = {
  borderColor: "rgba(52, 211, 153, 0.9)",
  borderWidth: "2px",
};

type Props = {
  dates: Date[];
  reportsMap: Map<string, DailyReportRow>;
  weeklyOffDays: number[];
  biweeklyOffDays: number[];
  biweeklyAnchorDate: string;
  onDateClick: (dateKey: string) => void;
  todayString: string;
};

export default function ReportList({
  dates,
  reportsMap,
  weeklyOffDays,
  biweeklyOffDays,
  biweeklyAnchorDate,
  onDateClick,
  todayString,
}: Props) {
  return (
    <div className="retro-panel rounded-[22px] p-2.5 sm:rounded-[26px] sm:p-4">
      <div className="grid grid-cols-4 gap-1 min-[380px]:grid-cols-5 sm:gap-1 md:grid-cols-6 lg:grid-cols-7">
        {dates.map((date) => {
          const dateKey = toDateString(date);
          const report = reportsMap.get(dateKey);
          const expenseTotal = getReportExpenseTotal(report?.memo);
          const isToday = dateKey === todayString;
          const isWeeklyRegularOff = weeklyOffDays.includes(date.getDay());
          const isBiweeklyRegularOff = isBiweeklyOffDate(
            date,
            biweeklyOffDays,
            biweeklyAnchorDate
          );
          const isBiweeklyAnchor = dateKey === biweeklyAnchorDate;

          const dayStatus = getReportDayStatus({
            report,
            isWeeklyRegularOff,
            isBiweeklyRegularOff,
          });
          const hasWorked = dayStatus === "worked";

          const statusLabel = getReportDayStatusLabel(dayStatus);
          let statusClass =
            "retro-badge px-1 py-0.5 text-[9px] leading-tight text-[var(--text-muted)] sm:px-1.5 sm:text-[10px] md:px-2 md:text-[11px]";
          let statusStyle: CSSProperties | undefined;
          let cardStyle: CSSProperties | undefined;

          if (dayStatus === "additional-off") {
            statusClass = "retro-badge px-1 py-0.5 text-[9px] font-semibold leading-tight sm:px-1.5 sm:text-[10px] md:px-2 md:text-[11px]";
            statusStyle = offStatusStyle;
            cardStyle = offCardStyle;
          } else if (dayStatus === "weekly-off") {
            statusClass = "retro-badge px-1 py-0.5 text-[9px] font-semibold leading-tight sm:px-1.5 sm:text-[10px] md:px-2 md:text-[11px]";
            statusStyle = offStatusStyle;
            cardStyle = offCardStyle;
          } else if (dayStatus === "biweekly-off") {
            statusClass = "retro-badge px-1 py-0.5 text-[9px] font-semibold leading-tight sm:px-1.5 sm:text-[10px] md:px-2 md:text-[11px]";
            statusStyle = offStatusStyle;
            cardStyle = offCardStyle;
          } else if (dayStatus === "worked") {
            statusClass = "retro-badge px-1 py-0.5 text-[9px] font-semibold leading-tight sm:px-1.5 sm:text-[10px] md:px-2 md:text-[11px]";
            statusStyle = workedStatusStyle;
            cardStyle = workedCardStyle;
          }

          return (
            <button
              type="button"
              key={dateKey}
              data-report-date={dateKey}
              onClick={() => onDateClick(dateKey)}
              style={cardStyle}
              className={`flex min-h-[104px] min-w-0 flex-col items-center rounded-[12px] border p-1.5 text-center transition active:scale-[0.99] hover:translate-y-[-1px] sm:min-h-[116px] sm:rounded-[18px] sm:p-2 md:min-h-[124px] md:rounded-[22px] md:p-2.5 ${
                isBiweeklyAnchor
                  ? "border-[var(--border-strong)] bg-[rgba(255,255,255,0.08)]"
                  : isToday
                  ? "border-[var(--border)] bg-[rgba(255,255,255,0.06)]"
                  : "border-[var(--border)] bg-[rgba(255,255,255,0.02)]"
              }`}
            >
              <div className="flex w-full flex-col items-center gap-1">
                <div className="mt-0.5 flex items-center justify-center gap-0.5 whitespace-nowrap">
                  <p
                    className="theme-heading text-[10px] font-semibold tracking-tight sm:text-[12px] md:text-[15px]"
                  >
                    {dateKey.slice(5)}
                  </p>
                  <p
                    className="theme-heading text-[10px] font-semibold tracking-tight sm:text-[12px] md:text-[15px]"
                  >
                    {getKoreanDayLabel(date.getDay())}
                  </p>
                </div>

                {isToday ? (
                  <span className="theme-chip-subtle px-1 py-0.5 text-[8px] font-semibold leading-none sm:px-1.5 sm:text-[9px] md:px-2 md:text-[11px]">
                    TODAY
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex w-full justify-center gap-1">
                <span className={statusClass} style={statusStyle}>
                  {statusLabel}
                </span>
              </div>

              {hasWorked && report ? (
                <div className="mt-2 pt-1">
                  <div className="theme-heading break-all text-[11px] font-bold leading-tight sm:text-[13px] md:text-[17px]">
                    {formatMoney(report.daily_sales)}
                  </div>
                  {expenseTotal > 0 ? (
                    <div className="mt-1 break-all text-[10px] font-semibold leading-tight text-[rgba(248,113,113,0.96)] sm:text-[11px] md:text-[14px]">
                      {formatNegativeMoney(expenseTotal)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}