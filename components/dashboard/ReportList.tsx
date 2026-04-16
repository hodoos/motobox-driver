import { DailyReportRow } from "@/types";
import { formatMoney, getKoreanDayLabel, toDateString } from "@/lib/format";
import { isBiweeklyOffDate } from "@/lib/offday";

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
    <div className="rounded-[32px] border border-black/8 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)] md:p-5">
      {biweeklyPickMode && (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
          격주휴무 기준일 선택 중입니다. 아래 리스트에서 날짜 하나를 눌러주세요.
        </div>
      )}

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
          const isRegularOff = isWeeklyRegularOff || isBiweeklyRegularOff;
          const isBiweeklyAnchor = dateKey === biweeklyAnchorDate;

          const hasWorked =
            !!report &&
            !report.is_day_off &&
            (
              report.delivered_count > 0 ||
              report.returned_count > 0 ||
              report.canceled_count > 0 ||
              (report.memo && report.memo.trim() !== "") ||
              !!report.unit_price_override
            );

          let statusLabel = "미입력";
          let statusClass = "bg-black/5 text-black/60";

          if (report?.is_day_off) {
            statusLabel = "추가휴무";
            statusClass = "bg-red-50 text-red-600";
          } else if (isWeeklyRegularOff) {
            statusLabel = "정기휴무";
            statusClass = "bg-red-50 text-red-600";
          } else if (isBiweeklyRegularOff) {
            statusLabel = "격주휴무";
            statusClass = "bg-red-50 text-red-600";
          } else if (hasWorked) {
            statusLabel = "근무";
            statusClass = "bg-black text-white";
          }

          return (
            <button
              key={dateKey}
              onClick={() => onDateClick(dateKey)}
              className={`w-full rounded-3xl border p-4 text-left transition hover:translate-y-[-1px] ${
                isBiweeklyAnchor
                  ? "border-blue-600 bg-blue-50"
                  : isToday
                  ? "border-black bg-[#f4f5f8]"
                  : "border-black/8 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold tracking-tight text-black">
                      {dateKey}
                    </p>
                    <span className="text-sm text-black/45">
                      {getKoreanDayLabel(date.getDay())}요일
                    </span>
                    {isToday ? (
                      <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-semibold text-white">
                        TODAY
                      </span>
                    ) : null}
                    {isBiweeklyAnchor ? (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                        격주 기준일
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}
                    >
                      {statusLabel}
                    </span>

                    {hasWorked ? (
                      <>
                        <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-black/70">
                          배송 {report?.delivered_count ?? 0}
                        </span>
                        <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-black/70">
                          반품 {report?.returned_count ?? 0}
                        </span>
                        <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-black/70">
                          취소 {report?.canceled_count ?? 0}
                        </span>
                      </>
                    ) : null}
                  </div>

                  {report?.memo ? (
                    <p className="mt-3 text-sm text-black/55 line-clamp-2">
                      {report.memo}
                    </p>
                  ) : null}
                </div>

                <div className="shrink-0 text-right">
                  {hasWorked ? (
                    <>
                      <p className="text-xs font-semibold text-black/45">매출</p>
                      <p className="mt-1 text-lg font-bold text-black">
                        {formatMoney(report?.daily_sales ?? 0)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-black/35">입력하기</p>
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