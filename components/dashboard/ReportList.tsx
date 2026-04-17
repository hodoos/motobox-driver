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
    <div className="retro-panel rounded-[24px] p-4 sm:rounded-[28px] sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          
        </div>
      
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 gap-2">
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
                "retro-badge px-2 py-0.5 text-[10px] text-[var(--text-muted)]";
              let statusStyle: CSSProperties | undefined;
              let cardStyle: CSSProperties | undefined;

              if (dayStatus === "additional-off") {
                statusClass = "retro-badge px-2 py-0.5 text-[10px] font-semibold";
                statusStyle = offStatusStyle;
                cardStyle = offCardStyle;
              } else if (dayStatus === "weekly-off") {
                statusClass = "retro-badge px-2 py-0.5 text-[10px] font-semibold";
                statusStyle = offStatusStyle;
                cardStyle = offCardStyle;
              } else if (dayStatus === "biweekly-off") {
                statusClass = "retro-badge px-2 py-0.5 text-[10px] font-semibold";
                statusStyle = offStatusStyle;
                cardStyle = offCardStyle;
              } else if (dayStatus === "worked") {
                statusClass = "retro-badge px-2 py-0.5 text-[10px] font-semibold";
                statusStyle = workedStatusStyle;
                cardStyle = workedCardStyle;
              }

              return (
                <button
                  type="button"
                  key={dateKey}
                  data-report-date={dateKey}
                  onClick={() => onDateClick(dateKey)}
                  title={`${dateKey} 리포트 수정`}
                  style={cardStyle}
                  className={`min-h-[146px] rounded-[20px] border p-3 text-left transition hover:translate-y-[-1px] sm:rounded-[24px] ${
                    isBiweeklyAnchor
                      ? "border-[var(--border-strong)] bg-[rgba(255,255,255,0.08)]"
                      : isToday
                      ? "border-[var(--border)] bg-[rgba(255,255,255,0.06)]"
                      : "border-[var(--border)] bg-[rgba(255,255,255,0.02)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="mt-0.5 flex items-center gap-1 whitespace-nowrap">
                        <p
                          className="theme-heading text-[13px] font-semibold tracking-tight sm:text-sm"
                          style={{ color: "#f8fafc" }}
                        >
                          {dateKey.slice(5)}
                        </p>
                        <p
                          className="theme-heading text-[13px] font-semibold tracking-tight sm:text-sm"
                          style={{ color: "#f8fafc" }}
                        >
                          {getKoreanDayLabel(date.getDay())}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {isToday ? (
                        <span className="theme-chip-subtle px-2 py-0.5 text-[10px] font-semibold">
                          TODAY
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className={statusClass} style={statusStyle}>
                      {statusLabel}
                    </span>
                  </div>

                  {hasWorked && report ? (
                    <div className="mt-3 space-y-1.5">
                      <div className="theme-copy text-[11px]">
                        배송 {report.delivered_count}
                      </div>
                      <div className="theme-copy text-[11px]">
                        반품 {report.returned_count}
                      </div>
                      <div className="theme-copy text-[11px]">
                        취소 {report.canceled_count}
                      </div>
                      <div className="theme-heading pt-1 text-sm font-bold">
                        {formatMoney(report.daily_sales)}
                      </div>
                    </div>
                  ) : null}
                  
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}