import type { CSSProperties } from "react";
import { DailyReportRow } from "../../types";
import { formatMoney, getKoreanDayLabel, toDateString } from "../../lib/format";
import { isBiweeklyOffDate } from "../../lib/offday";
import {
  getReportDayStatus,
  getReportDayStatusLabel,
} from "../../lib/reportStatus";

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
    <div className="retro-panel rounded-[24px] p-3 sm:rounded-[28px] sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="retro-title theme-heading text-xs leading-relaxed sm:text-sm">
            날짜를 눌러 바로 수정
          </p>
          <p className="theme-copy text-xs leading-relaxed sm:text-sm">
            {/* 모바일에서는 날짜 카드가 5칸 기준으로 촘촘하게 정리됩니다. */}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 min-[380px]:grid-cols-5 sm:gap-1.5 md:grid-cols-6 lg:grid-cols-7">
        {dates.map((date) => {
          const dateKey = toDateString(date);
          const report = reportsMap.get(dateKey);
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
            "retro-badge px-1 py-0.5 text-[8px] leading-tight text-[var(--text-muted)] sm:px-1.5 sm:text-[9px] md:px-2 md:text-[10px]";
          let statusStyle: CSSProperties | undefined;
          let cardStyle: CSSProperties | undefined;

          if (dayStatus === "additional-off") {
            statusClass = "retro-badge px-1 py-0.5 text-[8px] font-semibold leading-tight sm:px-1.5 sm:text-[9px] md:px-2 md:text-[10px]";
            statusStyle = offStatusStyle;
            cardStyle = offCardStyle;
          } else if (dayStatus === "weekly-off") {
            statusClass = "retro-badge px-1 py-0.5 text-[8px] font-semibold leading-tight sm:px-1.5 sm:text-[9px] md:px-2 md:text-[10px]";
            statusStyle = offStatusStyle;
            cardStyle = offCardStyle;
          } else if (dayStatus === "biweekly-off") {
            statusClass = "retro-badge px-1 py-0.5 text-[8px] font-semibold leading-tight sm:px-1.5 sm:text-[9px] md:px-2 md:text-[10px]";
            statusStyle = offStatusStyle;
            cardStyle = offCardStyle;
          } else if (dayStatus === "worked") {
            statusClass = "retro-badge px-1 py-0.5 text-[8px] font-semibold leading-tight sm:px-1.5 sm:text-[9px] md:px-2 md:text-[10px]";
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
              className={`flex min-h-[118px] min-w-0 flex-col rounded-[12px] border p-1.5 text-left transition active:scale-[0.99] hover:translate-y-[-1px] sm:min-h-[132px] sm:rounded-[18px] sm:p-2.5 md:min-h-[140px] md:rounded-[24px] md:p-3 ${
                isBiweeklyAnchor
                  ? "border-[var(--border-strong)] bg-[rgba(255,255,255,0.08)]"
                  : isToday
                  ? "border-[var(--border)] bg-[rgba(255,255,255,0.06)]"
                  : "border-[var(--border)] bg-[rgba(255,255,255,0.02)]"
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <div className="mt-0.5 flex items-center gap-0.5 whitespace-nowrap">
                    <p
                      className="theme-heading text-[9px] font-semibold tracking-tight sm:text-[11px] md:text-sm"
                    >
                      {dateKey.slice(5)}
                    </p>
                    <p
                      className="theme-heading text-[9px] font-semibold tracking-tight sm:text-[11px] md:text-sm"
                    >
                      {getKoreanDayLabel(date.getDay())}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {isToday ? (
                    <span className="theme-chip-subtle px-1 py-0.5 text-[7px] font-semibold leading-none sm:px-1.5 sm:text-[8px] md:px-2 md:text-[10px]">
                      TODAY
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                <span className={statusClass} style={statusStyle}>
                  {statusLabel}
                </span>
              </div>

              {hasWorked && report ? (
                <div className="mt-auto pt-1.5 space-y-0.5 sm:pt-2 sm:space-y-1">
                  <div className="theme-copy text-[8px] leading-tight sm:text-[10px] md:text-xs">
                    배송 {report.delivered_count}
                  </div>
                  <div className="theme-copy text-[8px] leading-tight sm:text-[10px] md:text-xs">
                    반품 {report.returned_count}
                  </div>
                  <div className="theme-copy text-[8px] leading-tight sm:text-[10px] md:text-xs">
                    취소 {report.canceled_count}
                  </div>
                  <div className="theme-heading break-all pt-1 text-[9px] font-bold leading-tight sm:text-[11px] md:text-[15px]">
                    {formatMoney(report.daily_sales)}
                  </div>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}