import { DriverSettings } from "../../types";
import { getKoreanDayLabel } from "../../lib/format";

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
    <div className="retro-panel rounded-[28px] p-5 md:p-7">
      <div className="space-y-5 text-center">
        <div className="grid gap-4 md:grid-cols-2 md:text-left">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#9fffc4] md:text-left">
              기사명
            </label>
            <input
              type="text"
              name="driver_name"
              value={settings.driver_name}
              onChange={handleSettingsChange}
              placeholder="기사명"
              className="bg-[#09120d] px-4 py-3 text-center md:text-left"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#9fffc4] md:text-left">
              배송 단가
            </label>
            <input
              type="number"
              name="unit_price"
              value={settings.unit_price}
              onChange={handleSettingsChange}
              placeholder="배송 단가(원)"
              className="no-spinner bg-[#09120d] px-4 py-3 text-center md:text-left"
            />
          </div>
        </div>

        <div className="retro-card rounded-[24px] p-4 text-center md:text-left">
          <p className="retro-title text-[10px] leading-relaxed text-[#6effa6]/58">
            SETTLEMENT PERIOD
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="grid gap-3">
              <select
                name="settlement_start_month_offset"
                value={settings.settlement_start_month_offset}
                onChange={handleSettingsChange}
                className="bg-[#09120d] px-4 py-3 text-center md:text-left"
              >
                <option value="-1">시작월: 지난달</option>
                <option value="0">시작월: 이번달</option>
              </select>

              <select
                name="settlement_start_day"
                value={settings.settlement_start_day}
                onChange={handleSettingsChange}
                className="bg-[#09120d] px-4 py-3 text-center md:text-left"
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
                className="bg-[#09120d] px-4 py-3 text-center md:text-left"
              >
                <option value="0">종료월: 이번달</option>
                <option value="1">종료월: 다음달</option>
              </select>

              <select
                name="settlement_end_day"
                value={settings.settlement_end_day}
                onChange={handleSettingsChange}
                className="bg-[#09120d] px-4 py-3 text-center md:text-left"
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

        <div className="retro-card rounded-[24px] p-4 text-center">
          <p className="retro-title text-[10px] leading-relaxed text-[#6effa6]/58">
            WEEKLY OFF DAYS
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {Array.from({ length: 7 }, (_, i) => i).map((day) => {
              const active = settings.off_days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleWeeklyOffDay(day)}
                  className={`px-4 py-2.5 text-sm font-semibold ${
                    active ? "retro-button-solid" : "retro-button"
                  }`}
                >
                  {getKoreanDayLabel(day)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="retro-card rounded-[24px] p-4 text-center">
          <p className="retro-title text-[10px] leading-relaxed text-[#6effa6]/58">
            BIWEEKLY OFF MODE
          </p>

          <p className="mt-4 text-sm leading-6 text-[#7dffb1]/62">
            쉬는 주의 날짜를 하나 선택하면, 해당 날짜의 요일을 기준으로 2주마다 자동 적용됩니다.
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setIsBiweeklyPickMode((prev) => !prev)}
              className={`px-4 py-2.5 text-sm font-semibold ${
                isBiweeklyPickMode ? "retro-button-solid" : "retro-button"
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
                className="retro-button px-4 py-2.5 text-sm font-semibold"
              >
                격주휴무 해제
              </button>
            ) : null}
          </div>

          {settings.biweekly_anchor_date && settings.biweekly_off_days.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-[rgba(0,255,128,0.18)] bg-[rgba(0,255,128,0.06)] px-4 py-3 text-sm text-[#a7ffca]">
              기준일: {settings.biweekly_anchor_date} (
              {getKoreanDayLabel(settings.biweekly_off_days[0])}요일)
            </div>
          ) : null}

          {isBiweeklyPickMode ? (
            <p className="mt-3 text-sm font-semibold text-[#b8ffd2]">
              대시보드 리스트에서 날짜를 눌러 기준일을 선택하세요.
            </p>
          ) : null}
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          className="retro-button-solid w-full py-3.5 text-base font-semibold disabled:opacity-60"
        >
          {saving ? "저장 중..." : "설정 저장"}
        </button>
      </div>
    </div>
  );
}