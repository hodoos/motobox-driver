import type { CSSProperties } from "react";
import { toDateString } from "../../lib/format";
import { ReportForm } from "../../types";

const compactInputStyle = {
  width: "100%",
  maxWidth: "8rem",
} as CSSProperties;

function parseDateKey(dateKey: string) {
  const parsed = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function shiftDateKey(dateKey: string, diffDays: number) {
  const parsed = parseDateKey(dateKey);

  if (!parsed) {
    return dateKey;
  }

  parsed.setDate(parsed.getDate() + diffDays);
  return toDateString(parsed);
}

type Props = {
  selectedDate: string;
  minDate: string;
  maxDate: string;
  onDateChange: (dateKey: string) => void;
  reportForm: ReportForm;
  setReportForm: React.Dispatch<React.SetStateAction<ReportForm>>;
  defaultUnitPrice: number;
  handleReportChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  onSave: () => void;
  saving: boolean;
};

export default function TodayQuickCard({
  selectedDate,
  minDate,
  maxDate,
  onDateChange,
  reportForm,
  setReportForm,
  defaultUnitPrice,
  handleReportChange,
  onSave,
  saving,
}: Props) {
  const previousDate = shiftDateKey(selectedDate, -1);
  const nextDate = shiftDateKey(selectedDate, 1);
  const canMoveToPreviousDate = previousDate >= minDate;
  const canMoveToNextDate = nextDate <= maxDate;

  return (
    <div className="retro-panel rounded-[24px] p-4 sm:rounded-[28px] sm:p-5">
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="theme-label block text-left text-sm font-semibold">
            {/* 입력 날짜 */}
          </label>
          <div
            className="theme-label mx-auto flex w-fit items-center justify-center gap-5 text-[16px] font-semibold"
            style={{ marginTop: "12px", marginBottom: "12px" }}
          >
            <label className="flex items-center gap-2">
              <input
                id="today-dayoff"
                type="checkbox"
                checked={reportForm.is_day_off}
                onChange={(e) =>
                  setReportForm((prev) => ({
                    ...prev,
                    is_day_off: e.target.checked,
                    delivered_count: e.target.checked ? "" : prev.delivered_count,
                    returned_count: e.target.checked ? "" : prev.returned_count,
                    canceled_count: e.target.checked ? "" : prev.canceled_count,
                  }))
                }
              />
              추가 휴무
            </label>
          </div>
          <div className="mx-auto flex w-full max-w-[12rem] items-center justify-between gap-2 rounded-[18px] border border-[var(--border)] bg-[var(--field-bg)] px-2 py-2.5">
              <button
                type="button"
                onClick={() => onDateChange(previousDate)}
                disabled={!canMoveToPreviousDate}
                className="retro-button min-h-[32px] min-w-[32px] px-2 py-1.5 text-xs font-semibold disabled:cursor-default disabled:opacity-40"
                aria-label="이전 날짜"
              >
                ←
              </button>

              <p className="theme-heading text-xs font-semibold tracking-tight sm:text-sm">
                {selectedDate}
              </p>

              <button
                type="button"
                onClick={() => onDateChange(nextDate)}
                disabled={!canMoveToNextDate}
                className="retro-button min-h-[32px] min-w-[32px] px-2 py-1.5 text-xs font-semibold disabled:cursor-default disabled:opacity-40"
                aria-label="다음 날짜"
              >
                →
              </button>
          </div>
          <p className="theme-copy text-xs">
            {/* 좌우 화살표를 눌러 하루씩 이동할 수 있습니다. */}
          </p>
        </div>

        <div className="mx-auto grid max-w-[20rem] grid-cols-2 justify-items-center gap-x-4 gap-y-4">
          <div className="flex w-full max-w-[8rem] flex-col items-center space-y-2">
            <label className="theme-label block text-center text-sm font-semibold">
              단가
            </label>
            <input
              type="number"
              name="unit_price_override"
              value={reportForm.unit_price_override}
              onChange={handleReportChange}
              disabled={reportForm.is_day_off}
              placeholder={defaultUnitPrice ? `${defaultUnitPrice}원` : "단가"}
              className="no-spinner px-4 py-3 text-center disabled:opacity-60"
              style={{ ...compactInputStyle, marginBottom: "12px" }}
            />
          </div>

          <div className="flex w-full max-w-[8rem] flex-col items-center space-y-2">
            <label className="theme-label block text-center text-sm font-semibold">
              배송
            </label>
            <input
              type="number"
              name="delivered_count"
              value={reportForm.delivered_count}
              onChange={handleReportChange}
              disabled={reportForm.is_day_off}
              placeholder="배송"
              className="no-spinner px-4 py-3 text-center disabled:opacity-60"
              style={{ ...compactInputStyle, marginBottom: "12px" }}
            />
          </div>

          <div className="flex w-full max-w-[8rem] flex-col items-center space-y-2">
            <label className="theme-label block text-center text-sm font-semibold">
              반품
            </label>
            <input
              type="number"
              name="returned_count"
              value={reportForm.returned_count}
              onChange={handleReportChange}
              disabled={reportForm.is_day_off}
              placeholder="반품"
              className="no-spinner px-4 py-3 text-center disabled:opacity-60"
              style={{ ...compactInputStyle, marginBottom: "12px" }}
            />
          </div>

          <div className="flex w-full max-w-[8rem] flex-col items-center space-y-2">
            <label className="theme-label block text-center text-sm font-semibold">
              취소
            </label>
            <input
              type="number"
              name="canceled_count"
              value={reportForm.canceled_count}
              onChange={handleReportChange}
              disabled={reportForm.is_day_off}
              placeholder="취소"
              className="no-spinner px-4 py-3 text-center disabled:opacity-60"
              style={{ ...compactInputStyle, marginBottom: "12px" }}
            />
          </div>
        </div>

        <div className="space-y-2 text-center">
          <label
            className="theme-label block text-center text-sm font-semibold"
            style={{ marginBottom: "12px" }}
          >
            특이사항
          </label>
          <textarea
            name="memo"
            value={reportForm.memo}
            onChange={handleReportChange}
            className="min-h-[112px] px-4 py-3 text-left"
            style={{ marginBottom: "12px" }}
          />
        </div>

        <button
          onClick={onSave}
          disabled={saving}
          className="retro-button-solid ui-action-fit min-h-[48px] px-5 py-3.5 text-base font-semibold disabled:opacity-60"
          style={{ marginBottom: "12px" }}
        >
          {saving ? "저장 중..." : "저 장"}
        </button>
      </div>
    </div>
  );
}