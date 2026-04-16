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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm md:items-center md:p-4">
      <div className="retro-panel w-full max-w-md rounded-t-[28px] p-5 md:rounded-[28px]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="retro-title text-sm leading-relaxed text-[#b8ffd2]">
              REPORT EDIT
            </h3>
            <p className="mt-2 text-sm text-[#7dffb1]/65">{selectedDate}</p>
          </div>
          <button
            onClick={onClose}
            className="retro-button px-3 py-2 text-sm font-semibold"
          >
            닫기
          </button>
        </div>

        <div className="space-y-3.5">
          <div className="rounded-2xl border border-[rgba(0,255,128,0.18)] bg-[rgba(0,255,128,0.05)] px-3 py-3">
            <label className="flex items-center gap-2 font-semibold text-[#a7ffca]">
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
                  }))
                }
              />
              휴무
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#9fffc4]">단가</label>
            <input
              type="number"
              name="unit_price_override"
              value={reportForm.unit_price_override}
              onChange={handleReportChange}
              disabled={reportForm.is_day_off}
              placeholder={defaultUnitPrice ? `${defaultUnitPrice}원` : "단가"}
              className="no-spinner bg-[#09120d] px-4 py-3 disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#9fffc4]">배송 건수</label>
              <input
                type="number"
                name="delivered_count"
                value={reportForm.delivered_count}
                onChange={handleReportChange}
                disabled={reportForm.is_day_off}
                placeholder="배송"
                className="no-spinner bg-[#09120d] px-3 py-3 disabled:opacity-60"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#9fffc4]">반품</label>
              <input
                type="number"
                name="returned_count"
                value={reportForm.returned_count}
                onChange={handleReportChange}
                disabled={reportForm.is_day_off}
                placeholder="반품"
                className="no-spinner bg-[#09120d] px-3 py-3 disabled:opacity-60"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#9fffc4]">취소</label>
              <input
                type="number"
                name="canceled_count"
                value={reportForm.canceled_count}
                onChange={handleReportChange}
                disabled={reportForm.is_day_off}
                placeholder="취소"
                className="no-spinner bg-[#09120d] px-3 py-3 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#9fffc4]">특이사항</label>
            <textarea
              name="memo"
              value={reportForm.memo}
              onChange={handleReportChange}
              className="min-h-[96px] bg-[#09120d] px-4 py-3"
            />
          </div>

          <button
            onClick={onSave}
            disabled={saving}
            className="retro-button-solid w-full py-3.5 text-base font-semibold disabled:opacity-60"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}