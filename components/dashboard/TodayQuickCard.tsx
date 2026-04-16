import { ReportForm } from "../../types";

type Props = {
  todayString: string;
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
  todayString,
  reportForm,
  setReportForm,
  defaultUnitPrice,
  handleReportChange,
  onSave,
  saving,
}: Props) {
  return (
    <div className="retro-panel rounded-[28px] p-4 md:p-5">
      <div className="mb-5 text-center">
        <p className="retro-title text-[10px] text-[#6effa6]/60">TODAY REPORT</p>
        <h2 className="retro-title mt-3 text-lg leading-relaxed text-[#b8ffd2] md:text-xl">
          QUICK INPUT
        </h2>
        <p className="mt-2 text-sm text-[#7dffb1]/65">{todayString}</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-[rgba(0,255,128,0.18)] bg-[rgba(0,255,128,0.05)] px-3 py-3">
          <label className="flex items-center justify-center gap-2 font-semibold text-[#a7ffca]">
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
            휴무
          </label>
        </div>

        <div className="space-y-2">
          <label className="block text-center text-sm font-semibold text-[#9fffc4]">
            단가
          </label>
          <input
            type="number"
            name="unit_price_override"
            value={reportForm.unit_price_override}
            onChange={handleReportChange}
            disabled={reportForm.is_day_off}
            placeholder={defaultUnitPrice ? `${defaultUnitPrice}원` : "단가"}
            className="no-spinner bg-[#09120d] px-4 py-3 text-center disabled:opacity-60"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-2">
            <label className="block text-center text-sm font-semibold text-[#9fffc4]">
              배송
            </label>
            <input
              type="number"
              name="delivered_count"
              value={reportForm.delivered_count}
              onChange={handleReportChange}
              disabled={reportForm.is_day_off}
              placeholder="배송"
              className="no-spinner bg-[#09120d] px-3 py-3 text-center disabled:opacity-60"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-center text-sm font-semibold text-[#9fffc4]">
              반품
            </label>
            <input
              type="number"
              name="returned_count"
              value={reportForm.returned_count}
              onChange={handleReportChange}
              disabled={reportForm.is_day_off}
              placeholder="반품"
              className="no-spinner bg-[#09120d] px-3 py-3 text-center disabled:opacity-60"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-center text-sm font-semibold text-[#9fffc4]">
              취소
            </label>
            <input
              type="number"
              name="canceled_count"
              value={reportForm.canceled_count}
              onChange={handleReportChange}
              disabled={reportForm.is_day_off}
              placeholder="취소"
              className="no-spinner bg-[#09120d] px-3 py-3 text-center disabled:opacity-60"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-center text-sm font-semibold text-[#9fffc4]">
            특이사항
          </label>
          <textarea
            name="memo"
            value={reportForm.memo}
            onChange={handleReportChange}
            className="min-h-[88px] bg-[#09120d] px-4 py-3"
          />
        </div>

        <button
          onClick={onSave}
          disabled={saving}
          className="retro-button-solid px-5 py-3.5 text-base font-semibold disabled:opacity-60"
          style={{ width: 'fit-content', minWidth: 'fit-content', alignSelf: 'center' }}
        >
          {saving ? "저장 중..." : "오늘 리포트 저장"}
        </button>
      </div>
    </div>
  );
}