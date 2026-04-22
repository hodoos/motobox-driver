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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:p-4">
      <div className="retro-panel max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:max-w-lg sm:rounded-[28px] sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="retro-title theme-heading text-base leading-relaxed">
              REPORT EDIT
            </h3>
            <p className="theme-copy mt-2 text-sm">{selectedDate}</p>
          </div>
          <button
            onClick={onClose}
            className="retro-button min-h-[40px] shrink-0 px-3 py-2 text-sm font-semibold"
          >
            닫기
          </button>
        </div>

        <div className="space-y-4">
          <div className="theme-note-box rounded-2xl px-3 py-3">
            <label className="theme-label flex items-center justify-start gap-2 font-semibold">
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

          <div className="space-y-2">
            <label className="theme-label block text-sm font-semibold">단가</label>
            <input
              type="number"
              name="unit_price_override"
              value={reportForm.unit_price_override}
              onChange={handleReportChange}
              disabled={reportForm.is_day_off}
              placeholder={defaultUnitPrice ? `${defaultUnitPrice}원` : "단가"}
              className="no-spinner px-4 py-3 text-left disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="theme-label block text-sm font-semibold">배송 건수</label>
              <input
                type="number"
                name="delivered_count"
                value={reportForm.delivered_count}
                onChange={handleReportChange}
                disabled={reportForm.is_day_off}
                placeholder="배송"
                className="no-spinner px-4 py-3 text-left disabled:opacity-60"
              />
            </div>

            <div className="space-y-2">
              <label className="theme-label block text-sm font-semibold">반품</label>
              <input
                type="number"
                name="returned_count"
                value={reportForm.returned_count}
                onChange={handleReportChange}
                disabled={reportForm.is_day_off}
                placeholder="반품"
                className="no-spinner px-4 py-3 text-left disabled:opacity-60"
              />
            </div>

            <div className="space-y-2">
              <label className="theme-label block text-sm font-semibold">취소</label>
              <input
                type="number"
                name="canceled_count"
                value={reportForm.canceled_count}
                onChange={handleReportChange}
                disabled={reportForm.is_day_off}
                placeholder="취소"
                className="no-spinner px-4 py-3 text-left disabled:opacity-60"
              />
              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
                <label className="flex items-center gap-2">
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
                <label className="flex items-center gap-2">
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

          <div className="space-y-2">
            <label className="theme-label block text-sm font-semibold">특이사항</label>
            <textarea
              name="memo"
              value={reportForm.memo}
              onChange={handleReportChange}
              className="min-h-[120px] px-4 py-3"
            />
          </div>

          <button
            onClick={onSave}
            disabled={saving}
            className="retro-button-solid ui-action-fit min-h-[48px] px-5 py-3.5 text-base font-semibold disabled:opacity-60"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}