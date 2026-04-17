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
    <div className="retro-panel rounded-[24px] p-4 sm:rounded-[28px] sm:p-5">
      <div className="mb-5 text-center">
        <p className="retro-title theme-kicker text-[10px]">TODAY REPORT</p>
        <h2 className="retro-title theme-heading mt-3 text-base leading-relaxed sm:text-lg md:text-xl">
          QUICK INPUT
        </h2>
        <p className="theme-copy mt-2 text-sm">{todayString}</p>
      </div>

      <div className="space-y-5">
        <div className="theme-note-box rounded-2xl px-4 py-3">
          <label className="theme-label flex items-center justify-start gap-2 font-semibold">
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
          <label className="theme-label block text-left text-sm font-semibold">
            단가
          </label>
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
            <label className="theme-label block text-left text-sm font-semibold">
              배송
            </label>
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
            <label className="theme-label block text-left text-sm font-semibold">
              반품
            </label>
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
            <label className="theme-label block text-left text-sm font-semibold">
              취소
            </label>
            <input
              type="number"
              name="canceled_count"
              value={reportForm.canceled_count}
              onChange={handleReportChange}
              disabled={reportForm.is_day_off}
              placeholder="취소"
              className="no-spinner px-4 py-3 text-left disabled:opacity-60"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="theme-label block text-left text-sm font-semibold">
            특이사항
          </label>
          <textarea
            name="memo"
            value={reportForm.memo}
            onChange={handleReportChange}
            className="min-h-[112px] px-4 py-3"
          />
        </div>

        <button
          onClick={onSave}
          disabled={saving}
          className="retro-button-solid ui-action-fit min-h-[48px] px-5 py-3.5 text-base font-semibold disabled:opacity-60"
        >
          {saving ? "저장 중..." : "오늘 리포트 저장"}
        </button>
      </div>
    </div>
  );
}