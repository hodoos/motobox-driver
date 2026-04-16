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
  biweeklyPickMode: boolean;
};

export default function ReportList({
  dates,
  reportsMap,
  weeklyOffDays,
  biweeklyOffDays,
  biweeklyAnchorDate,
  onDateClick,
  todayString,
  biweeklyPickMode,
}: Props) {
  return (
    <div className="retro-panel rounded-[28px] p-4 md:p-5">
      {biweeklyPickMode && (
        <div className="mb-4 rounded-2xl border border-[rgba(0,255,128,0.28)] bg-[rgba(0,255,128,0.08)] px-4 py-3 text-sm font-semibold text-[#b8ffd2]">
          격주휴무 기준일 선택 중입니다. 아래 리스트에서 날짜 하나를 눌러주세요.
        </div>
      )}

      <div className="mb-4">
        <p className="retro-title text-[10px] text-[#6effa6]/60">SETTLEMENT LIST</p>
        <h2 className="retro-title mt-3 text-lg leading-relaxed text-[#b8ffd2] md:text-xl">
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
          let statusClass = "retro-badge text-[#7dffb1]/65";

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
              "rounded-full border border-[rgba(0,255,128,0.45)] bg-[rgba(0,255,128,0.14)] px-3 py-1 text-xs font-semibold text-[#b8ffd2]";
          }

          return (
            <button
              key={dateKey}
              onClick={() => onDateClick(dateKey)}
              className={`rounded-[24px] border p-4 text-left transition hover:translate-y-[-1px] ${
                isBiweeklyAnchor
                  ? "border-[rgba(0,255,128,0.48)] bg-[rgba(0,255,128,0.09)]"
                  : isToday
                  ? "border-[rgba(0,255,128,0.35)] bg-[rgba(0,255,128,0.06)]"
                  : "border-[rgba(0,255,128,0.16)] bg-[rgba(7,14,9,0.72)]"
              }`}
              style={{ width: 'fit-content', minWidth: 'fit-content' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-bold tracking-tight text-[#b8ffd2]">
                      {dateKey}
                    </p>
                    <span className="text-sm text-[#7dffb1]/50">
                      {getKoreanDayLabel(date.getDay())}
                    </span>
                    {isToday ? (
                      <span className="retro-badge px-2 py-0.5 text-[10px] font-semibold text-[#b8ffd2]">
                        TODAY
                      </span>
                    ) : null}
                    {isBiweeklyAnchor ? (
                      <span className="rounded-full border border-[rgba(0,255,128,0.45)] bg-[rgba(0,255,128,0.16)] px-2 py-0.5 text-[10px] font-semibold text-[#b8ffd2]">
                        격주 기준일
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={statusClass}>{statusLabel}</span>

                    {hasWorked ? (
                      <>
                        <span className="retro-badge px-3 py-1 text-xs font-semibold text-[#9fffc4]">
                          배송 {report?.delivered_count ?? 0}
                        </span>
                        <span className="retro-badge px-3 py-1 text-xs font-semibold text-[#9fffc4]">
                          반품 {report?.returned_count ?? 0}
                        </span>
                        <span className="retro-badge px-3 py-1 text-xs font-semibold text-[#9fffc4]">
                          취소 {report?.canceled_count ?? 0}
                        </span>
                      </>
                    ) : null}
                  </div>

                  {report?.memo ? (
                    <p className="mt-3 text-sm text-[#7dffb1]/55 line-clamp-2">
                      {report.memo}
                    </p>
                  ) : null}
                </div>

                <div className="shrink-0 text-right">
                  {hasWorked ? (
                    <>
                      <p className="retro-title text-[10px] leading-relaxed text-[#6effa6]/55">
                        SALES
                      </p>
                      <p className="mt-2 text-lg font-bold text-[#b8ffd2]">
                        {formatMoney(report?.daily_sales ?? 0)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-[#7dffb1]/35"></p>
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