import { createPortal } from "react-dom";
import { ReportForm } from "../../types";

type Props = {
  open: boolean;
  selectedDate: string;
  reportForm: ReportForm;
  setReportForm: React.Dispatch<React.SetStateAction<ReportForm>>;
  defaultUnitPrice: number;
  handleReportChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
};

export default function ReportModal({
  open,
  selectedDate,
  reportForm,
  setReportForm,
  defaultUnitPrice,
  handleReportChange,
  onClose,
  onSave,
  saving,
}: Props) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100dvh",
      }}
    >
      <div
        className="retro-panel overflow-y-auto rounded-[24px] px-3 py-3 sm:px-4 sm:py-4"
        style={{
          width: "min(26rem, calc(100vw - 1rem))",
          maxHeight: "76dvh",
        }}
      >
        <div className="mb-2.5 flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <h3 className="retro-title theme-heading text-sm leading-none sm:text-base">
              일일 업무 상세
            </h3>
            <p className="theme-copy text-xs sm:text-sm">{selectedDate}</p>
          </div>
          <button
            onClick={onClose}
            className="retro-button min-h-[32px] shrink-0 px-2.5 py-1 text-xs font-semibold"
          >
            닫기
          </button>
        </div>

        <div className="space-y-2.5">
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <div className="space-y-1">
              <label className="theme-label block text-xs font-semibold">단가</label>
              <input
                type="number"
                name="unit_price_override"
                value={reportForm.unit_price_override}
                onChange={handleReportChange}
                disabled={reportForm.is_day_off}
                placeholder={defaultUnitPrice ? `${defaultUnitPrice}원` : "단가"}
                className="no-spinner h-10 px-3 py-2 text-left text-sm disabled:opacity-60"
              />
            </div>
            <label className="theme-note-box theme-label flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold">
              <input
                id="dayoff"
                type="checkbox"
                checked={reportForm.is_day_off}
                onChange={(e) =>
                  setReportForm((prev) => ({
                    ...prev,
                    is_day_off: e.target.checked,
                    delivered_count: e.target.checked ? "" : prev.delivered_count,
                    returned_count: e.target.checked ? "" : prev.returned_count,
                    canceled_count: e.target.checked ? "" : prev.canceled_count,
                    additional_works: e.target.checked ? [] : prev.additional_works ?? [],
                  }))
                }
              />
              휴무
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="theme-label block text-[11px] font-semibold">배송</label>
              <input
                type="number"
                name="delivered_count"
                value={reportForm.delivered_count}
                onChange={handleReportChange}
                disabled={reportForm.is_day_off}
                placeholder="배송"
                className="no-spinner h-10 px-2 py-2 text-center text-sm disabled:opacity-60"
              />
            </div>

            <div className="space-y-1">
              <label className="theme-label block text-[11px] font-semibold">반품</label>
              <input
                type="number"
                name="returned_count"
                value={reportForm.returned_count}
                onChange={handleReportChange}
                disabled={reportForm.is_day_off}
                placeholder="반품"
                className="no-spinner h-10 px-2 py-2 text-center text-sm disabled:opacity-60"
              />
            </div>

            <div className="space-y-1">
              <label className="theme-label block text-[11px] font-semibold">취소</label>
              <input
                type="number"
                name="canceled_count"
                value={reportForm.canceled_count}
                onChange={handleReportChange}
                disabled={reportForm.is_day_off}
                placeholder="취소"
                className="no-spinner h-10 px-2 py-2 text-center text-sm disabled:opacity-60"
              />
              <div className="flex flex-col gap-1 pt-1 text-[10px]">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={reportForm.include_canceled_in_sales}
                    disabled={reportForm.is_day_off}
                    onChange={(event) => {
                      if (!event.target.checked) {
                        return;
                      }

                      setReportForm((prev) => ({
                        ...prev,
                        include_canceled_in_sales: true,
                      }));
                    }}
                  />
                  취소건 포함
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={!reportForm.include_canceled_in_sales}
                    disabled={reportForm.is_day_off}
                    onChange={(event) => {
                      if (!event.target.checked) {
                        return;
                      }

                      setReportForm((prev) => ({
                        ...prev,
                        include_canceled_in_sales: false,
                      }));
                    }}
                  />
                  취소건 미포함
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="theme-label block text-xs font-semibold">메모</label>
            <textarea
              name="memo"
              value={reportForm.memo}
              onChange={handleReportChange}
              className="min-h-[72px] px-3 py-2 text-sm"
              style={{ height: "72px" }}
            />
          </div>

          <button
            onClick={onSave}
            disabled={saving}
            className="retro-button-solid min-h-[38px] w-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}