import { DailyReportRow } from "@/types";
import { formatMoney, toDateString } from "@/lib/format";
import { isBiweeklyOffDate } from "@/lib/offday";
import {
  getReportDayStatus,
  getReportDayStatusLabel,
} from "@/lib/reportStatus";

type Props = {
  calendarCells: (Date | null)[];
  reportsMap: Map<string, DailyReportRow>;
  todayString: string;
  weeklyOffDays: number[];
  biweeklyOffDays: number[];
  biweeklyAnchorDate: string;
  onDateClick: (dateKey: string) => void;
};

export default function CalendarBoard({
  calendarCells,
  reportsMap,
  todayString,
  weeklyOffDays,
  biweeklyOffDays,
  biweeklyAnchorDate,
  onDateClick,
}: Props) {
  return (
    <div className="overflow-x-auto">
      <div className="retro-card min-w-[560px] rounded-[28px] p-3 sm:p-4 md:rounded-[32px] md:p-5">
        <div className="mb-2 grid grid-cols-7 gap-2">
          {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
            <div
              key={label}
              className="rounded-2xl bg-[rgba(255,255,255,0.05)] px-2 py-2 text-center text-xs font-bold text-[var(--text-muted)] md:py-3 md:text-sm"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarCells.map((cell, index) => {
            if (!cell) {
              return <div key={`empty-${index}`} className="min-h-[88px] md:min-h-[120px]" />;
            }

            const dateKey = toDateString(cell);
            const report = reportsMap.get(dateKey);
            const isToday = dateKey === todayString;
            const isWeeklyRegularOff = weeklyOffDays.includes(cell.getDay());
            const isBiweeklyRegularOff = isBiweeklyOffDate(
              cell,
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

            return (
              <button
                key={dateKey}
                onClick={() => onDateClick(dateKey)}
                className={`min-h-[88px] rounded-[24px] border p-2.5 text-left transition hover:translate-y-[-1px] md:min-h-[120px] md:rounded-3xl md:p-3 ${
                  isBiweeklyAnchor
                    ? "border-[var(--border-strong)] bg-[rgba(255,255,255,0.08)]"
                    : isToday
                    ? "border-[var(--border)] bg-[rgba(255,255,255,0.06)]"
                    : "border-[var(--border)] bg-[rgba(255,255,255,0.02)]"
                }`}
              >
                <div className="theme-heading text-sm font-bold md:text-base">
                  {cell.getDate()}
                </div>

                {isBiweeklyAnchor ? (
                  <div className="theme-kicker mt-1 text-[10px] font-semibold">
                    격주 기준일
                  </div>
                ) : null}

                <div className="mt-2 space-y-1 text-[11px] md:text-xs">
                  {hasWorked && report ? (
                    <>
                      <div className="theme-copy">배송 {report.delivered_count}</div>
                      <div className="theme-heading font-semibold">
                        {formatMoney(report.daily_sales)}
                      </div>
                    </>
                  ) : dayStatus === "empty" ? (
                    <div className="theme-empty">미입력</div>
                  ) : (
                    <div className="theme-heading font-semibold">
                      {getReportDayStatusLabel(dayStatus)}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}