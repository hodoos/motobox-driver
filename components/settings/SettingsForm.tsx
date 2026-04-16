import { DriverSettings } from "@/types";
import { getKoreanDayLabel } from "@/lib/format";

type Props = {
  settings: DriverSettings;
  setSettings: React.Dispatch<React.SetStateAction<DriverSettings>>;
  handleSettingsChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  saveSettings: () => void;
  saving: boolean;
  isBiweeklyPickMode: boolean;
  setIsBiweeklyPickMode: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function SettingsForm({
  settings,
  setSettings,
  handleSettingsChange,
  saveSettings,
  saving,
  isBiweeklyPickMode,
  setIsBiweeklyPickMode,
}: Props) {
  const toggleWeeklyOffDay = (day: number) => {
    setSettings((prev) => {
      const exists = prev.off_days.includes(day);
      return {
        ...prev,
        off_days: exists
          ? prev.off_days.filter((d) => d !== day)
          : [...prev.off_days, day].sort((a, b) => a - b),
      };
    });
  };

  return (
    <div className="rounded-[32px] border border-black/8 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.06)] md:p-7">
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-black/70">기사명</label>
            <input
              type="text"
              name="driver_name"
              value={settings.driver_name}
              onChange={handleSettingsChange}
              placeholder="기사명"
              className="w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-black outline-none transition focus:border-black/30 focus:bg-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-black/70">배송 단가</label>
            <input
              type="number"
              name="unit_price"
              value={settings.unit_price}
              onChange={handleSettingsChange}
              placeholder="배송 단가(원)"
              className="no-spinner w-full rounded-2xl border border-black/10 bg-[#fafafa] px-4 py-3 text-black outline-none transition focus:border-black/30 focus:bg-white"
            />
          </div>
        </div>

        <div className="rounded-3xl border border-black/8 bg-[#fafafa] p-4">
          <p className="mb-3 text-sm font-semibold text-black/75">정산 기간 설정</p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-3">
              <select
                name="settlement_start_month_offset"
                value={settings.settlement_start_month_offset}
                onChange={handleSettingsChange}
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-black outline-none"
              >
                <option value="-1">시작월: 지난달</option>
                <option value="0">시작월: 이번달</option>
              </select>

              <select
                name="settlement_start_day"
                value={settings.settlement_start_day}
                onChange={handleSettingsChange}
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-black outline-none"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    시작일 {day}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3">
              <select
                name="settlement_end_month_offset"
                value={settings.settlement_end_month_offset}
                onChange={handleSettingsChange}
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-black outline-none"
              >
                <option value="0">종료월: 이번달</option>
                <option value="1">종료월: 다음달</option>
              </select>

              <select
                name="settlement_end_day"
                value={settings.settlement_end_day}
                onChange={handleSettingsChange}
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-black outline-none"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    종료일 {day}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-black/8 bg-[#fafafa] p-4">
          <p className="mb-3 text-sm font-semibold text-black/75">매주 휴무</p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 7 }, (_, i) => i).map((day) => {
              const active = settings.off_days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleWeeklyOffDay(day)}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "bg-black text-white shadow-[0_10px_25px_rgba(0,0,0,0.18)]"
                      : "border border-black/10 bg-white text-black hover:border-black/20"
                  }`}
                >
                  {getKoreanDayLabel(day)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-black/8 bg-[#fafafa] p-4">
          <p className="mb-2 text-sm font-semibold text-black/75">격주휴무 설정</p>
          <p className="text-sm text-black/55">
            쉬는 주의 날짜를 하루 선택하면 해당 날짜의 요일 기준으로 2주마다 자동 적용됩니다.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsBiweeklyPickMode((prev) => !prev)}
              className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                isBiweeklyPickMode
                  ? "bg-black text-white shadow-[0_10px_25px_rgba(0,0,0,0.18)]"
                  : "border border-black/10 bg-white text-black hover:border-black/20"
              }`}
            >
              {isBiweeklyPickMode ? "선택 모드 종료" : "기준일 선택 시작"}
            </button>

            {settings.biweekly_anchor_date ? (
              <button
                type="button"
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    biweekly_anchor_date: "",
                    biweekly_off_days: [],
                  }))
                }
                className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-black hover:text-white"
              >
                격주휴무 해제
              </button>
            ) : null}
          </div>

          {settings.biweekly_anchor_date && settings.biweekly_off_days.length > 0 && (
            <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-black/70">
              기준일: {settings.biweekly_anchor_date} (
              {getKoreanDayLabel(settings.biweekly_off_days[0])}요일)
            </div>
          )}

          {isBiweeklyPickMode && (
            <p className="mt-3 text-sm font-semibold text-black">
              대시보드 달력에서 기준일로 사용할 날짜를 눌러주세요.
            </p>
          )}
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          className="w-full rounded-2xl bg-black px-4 py-3.5 text-base font-semibold text-white shadow-[0_16px_32px_rgba(0,0,0,0.18)] transition hover:translate-y-[-1px] disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}