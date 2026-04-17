import { DailyReportRow } from "../../types";
import { formatMoney, getKoreanDayLabel, toDateString } from "../../lib/format";
import { isBiweeklyOffDate } from "../../lib/offday";

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
      <div className="mb-4">
        <p className="retro-title theme-kicker text-[10px]">SETTLEMENT LIST</p>
        <h2 className="retro-title theme-heading mt-3 text-base leading-relaxed sm:text-lg md:text-xl">
          PERIOD RECORDS
        </h2>
      </div>

      <div className="space-y-3">
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

          const hasWorked =
            !!report &&
            !report.is_day_off &&
            (report.delivered_count > 0 ||
              report.returned_count > 0 ||
              report.canceled_count > 0 ||
              (report.memo && report.memo.trim() !== "") ||
              !!report.unit_price_override);

          let statusLabel = "미입력";
          let statusClass = "retro-badge text-[var(--text-muted)]";

          if (report?.is_day_off) {
            statusLabel = "추가휴무";
            statusClass = "retro-badge retro-danger";
          } else if (isWeeklyRegularOff) {
            statusLabel = "정기휴무";
            statusClass = "retro-badge retro-danger";
          } else if (isBiweeklyRegularOff) {
            statusLabel = "격주휴무";
            statusClass = "retro-badge retro-danger";
          } else if (hasWorked) {
            statusLabel = "근무";
            statusClass =
              "theme-chip-strong px-3 py-1 text-xs font-semibold";
          }

          return (
            <button
              key={dateKey}
              onClick={() => onDateClick(dateKey)}
              className={`w-full rounded-[20px] border p-4 text-left transition hover:translate-y-[-1px] sm:rounded-[24px] sm:p-5 ${
                isBiweeklyAnchor
                  ? "border-[var(--border-strong)] bg-[rgba(255,255,255,0.08)]"
                  : isToday
                  ? "border-[var(--border)] bg-[rgba(255,255,255,0.05)]"
                  : "border-[var(--border)] bg-[rgba(255,255,255,0.02)]"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="theme-heading text-base font-bold tracking-tight sm:text-lg">
                      {dateKey}
                    </p>
                    <span className="theme-copy text-sm">
                      {getKoreanDayLabel(date.getDay())}
                    </span>
                    {isToday ? (
                      <span className="theme-chip-subtle px-2 py-0.5 text-[10px] font-semibold">
                        TODAY
                      </span>
                    ) : null}
                    {isBiweeklyAnchor ? (
                      <span className="theme-chip-strong px-2 py-0.5 text-[10px] font-semibold">
                        격주 기준일
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={statusClass}>{statusLabel}</span>

                    {hasWorked ? (
                      <>
                        <span className="theme-chip-subtle px-3 py-1 text-xs font-semibold">
                          배송 {report?.delivered_count ?? 0}
                        </span>
                        <span className="theme-chip-subtle px-3 py-1 text-xs font-semibold">
                          반품 {report?.returned_count ?? 0}
                        </span>
                        <span className="theme-chip-subtle px-3 py-1 text-xs font-semibold">
                          취소 {report?.canceled_count ?? 0}
                        </span>
                      </>
                    ) : null}
                  </div>

                  {report?.memo ? (
                    <p className="theme-copy mt-3 line-clamp-2 text-sm">
                      {report.memo}
                    </p>
                  ) : null}
                </div>

                <div className="w-full shrink-0 text-left sm:w-auto sm:text-right">
                  {hasWorked ? (
                    <>
                      <p className="retro-title theme-kicker text-[10px] leading-relaxed">
                        SALES
                      </p>
                      <p className="theme-heading mt-2 text-lg font-bold">
                        {formatMoney(report?.daily_sales ?? 0)}
                      </p>
                    </>
                  ) : (
                    <p className="theme-empty text-sm font-semibold"></p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}