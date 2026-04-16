import { DailyReportRow } from "@/types";
import { formatMoney, toDateString } from "@/lib/format";
import { isBiweeklyOffDate } from "@/lib/offday";

type Props = {
  calendarCells: (Date | null)[];
  reportsMap: Map<string, DailyReportRow>;
  todayString: string;
  weeklyOffDays: number[];
  biweeklyOffDays: number[];
  biweeklyAnchorDate: string;
  onDateClick: (dateKey: string) => void;
  biweeklyPickMode: boolean;
};

export default function CalendarBoard({
  calendarCells,
  reportsMap,
  todayString,
  weeklyOffDays,
  biweeklyOffDays,
  biweeklyAnchorDate,
  onDateClick,
  biweeklyPickMode,
}: Props) {
  return (
    <div className="rounded-[32px] border border-black/8 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)] md:p-5">
      {biweeklyPickMode && (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
          격주휴무 기준일 선택 중입니다. 아래 달력에서 날짜 하나를 눌러주세요.
        </div>
      )}

      <div className="mb-2 grid grid-cols-7 gap-2">
        {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
          <div
            key={label}
            className="rounded-2xl bg-[#f5f6fa] px-2 py-3 text-center text-xs font-bold text-black/65 md:text-sm"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {calendarCells.map((cell, index) => {
          if (!cell) {
            return <div key={`empty-${index}`} className="min-h-[104px] md:min-h-[120px]" />;
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

          const isEmptySavedReport =
            report &&
            !report.is_day_off &&
            report.delivered_count === 0 &&
            report.returned_count === 0 &&
            report.canceled_count === 0 &&
            (!report.memo || report.memo.trim() === "") &&
            !report.unit_price_override;

          return (
            <button
              key={dateKey}
              onClick={() => onDateClick(dateKey)}
              className={`min-h-[104px] rounded-3xl border p-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition hover:translate-y-[-1px] md:min-h-[120px] ${
                isBiweeklyAnchor
                  ? "border-blue-600 bg-blue-50"
                  : isToday
                  ? "border-black bg-[#f3f4f7]"
                  : "border-black/8 bg-white"
              }`}
            >
              <div className="text-sm font-bold text-black md:text-base">
                {cell.getDate()}
              </div>

              {isBiweeklyAnchor ? (
                <div className="mt-1 text-[10px] font-semibold text-blue-600">
                  격주 기준일
                </div>
              ) : null}

              <div className="mt-2 space-y-1 text-[11px] md:text-xs">
                {report ? (
                  report.is_day_off ? (
                    <div className="font-semibold text-red-600">추가휴무</div>
                  ) : isEmptySavedReport ? (
                    isWeeklyRegularOff ? (
                      <div className="font-semibold text-red-600">정기휴무</div>
                    ) : isBiweeklyRegularOff ? (
                      <div className="font-semibold text-red-600">격주휴무</div>
                    ) : (
                      <div className="text-black/45">미입력</div>
                    )
                  ) : (
                    <>
                      <div className="text-black/70">배송 {report.delivered_count}</div>
                      <div className="font-semibold text-black">
                        {formatMoney(report.daily_sales)}
                      </div>
                    </>
                  )
                ) : isWeeklyRegularOff ? (
                  <div className="font-semibold text-red-600">정기휴무</div>
                ) : isBiweeklyRegularOff ? (
                  <div className="font-semibold text-red-600">격주휴무</div>
                ) : (
                  <div className="text-black/45">미입력</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}