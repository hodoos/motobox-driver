import { ReportForm } from "@/types";

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
    <div className="rounded-[32px] border border-black/8 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)] md:p-5">
      <div className="mb-4">
        <p className="text-xs font-semibold tracking-[0.2em] text-black/40">
          TODAY REPORT
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-black">
          오늘 리포트
        </h2>
        <p className="mt-1 text-sm text-black/55">{todayString}</p>
      </div>

      <div className="space-y-3.5">
        <div className="flex items-center gap-2 rounded-2xl bg-[#f7f8fb] px-3 py-3">
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
          <label htmlFor="today-dayoff" className="font-semibold text-black">
            오늘 휴무
          </label>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-black/70">단가</label>
          <input
            type="number"
            name="unit_price_override"
            value={reportForm.unit_price_override}
            onChange={handleReportChange}
            disabled={reportForm.is_day_off}
            placeholder={defaultUnitPrice ? `${defaultUnitPrice}원` : "단가"}
            className="no-spinner w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-black placeholder:text-black/35 outline-none transition focus:border-black/25 focus:bg-white disabled:bg-[#f2f3f6]"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-black/70">배송 건수</label>
            <input
              type="number"
              name="delivered_count"
              value={reportForm.delivered_count}
              onChange={handleReportChange}
              disabled={reportForm.is_day_off}
              placeholder="배송 건수"
              className="no-spinner w-full rounded-2xl border border-black/10 bg-[#fafafa] px-3 py-3 text-black placeholder:text-black/35 outline-none transition focus:border-black/25 focus:bg-white disabled:bg-[#f2f3f6]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-black/70">반품</label>
            <input
              type="number"
              name="returned_count"
              value={reportForm.returned_count}
              onChange={handleReportChange}
              disabled={reportForm.is_day_off}
              placeholder="반품"
              className="no-spinner w-full rounded-2xl border border-black/10 bg-[#fafafa] px-3 py-3 text-black placeholder:text-black/35 outline-none transition focus:border-black/25 focus:bg-white disabled:bg-[#f2f3f6]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-black/70">취소</label>
            <input
              type="number"
              name="canceled_count"
              value={reportForm.canceled_count}
              onChange={handleReportChange}
              disabled={reportForm.is_day_off}
              placeholder="취소"
              className="no-spinner w-full rounded-2xl border border-black/10 bg-[#fafafa] px-3 py-3 text-black placeholder:text-black/35 outline-none transition focus:border-black/25 focus:bg-white disabled:bg-[#f2f3f6]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-black/70">특이사항</label>
          <textarea
            name="memo"
            value={reportForm.memo}
            onChange={handleReportChange}
            className="min-h-[88px] w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-black outline-none transition focus:border-black/25 focus:bg-white"
          />
        </div>

        <button
          onClick={onSave}
          disabled={saving}
          className="w-full rounded-2xl bg-black px-4 py-3.5 text-base font-semibold text-white shadow-[0_16px_32px_rgba(0,0,0,0.18)] transition hover:translate-y-[-1px] disabled:opacity-50"
        >
          {saving ? "저장 중..." : "오늘 리포트 저장"}
        </button>
      </div>
    </div>
  );
}