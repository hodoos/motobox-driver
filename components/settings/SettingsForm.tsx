import { useState } from "react";
import { DriverSettings } from "../../types";
import { getKoreanDayLabel } from "../../lib/format";
import DatePickerModal from "./DatePickerModal";

type Props = {
  settings: DriverSettings;
  setSettings: React.Dispatch<React.SetStateAction<DriverSettings>>;
  handleSettingsChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  saveSettings: () => void;
  saving: boolean;
};

export default function SettingsForm({
  settings,
  setSettings,
  handleSettingsChange,
  saveSettings,
  saving,
}: Props) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

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

  const applyBiweeklyAnchorDate = (dateKey: string) => {
    const pickedDate = new Date(`${dateKey}T12:00:00`);

    setSettings((prev) => ({
      ...prev,
      biweekly_anchor_date: dateKey,
      biweekly_off_days: [pickedDate.getDay()],
    }));

    setIsDatePickerOpen(false);
  };

  return (
    <>
      <div className="retro-panel rounded-[24px] p-4 sm:rounded-[28px] sm:p-6 md:p-7">
        <div className="space-y-6 text-left sm:space-y-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="theme-label block text-sm font-semibold">
                기사명
              </label>
              <input
                type="text"
                name="driver_name"
                value={settings.driver_name}
                onChange={handleSettingsChange}
                placeholder="기사명"
                className="px-4 py-3 text-left"
              />
            </div>

            <div className="space-y-2">
              <label className="theme-label block text-sm font-semibold">
                배송 단가
              </label>
              <input
                type="number"
                name="unit_price"
                value={settings.unit_price}
                onChange={handleSettingsChange}
                placeholder="배송 단가(원)"
                className="no-spinner px-4 py-3 text-left"
              />
            </div>
          </div>

          <div className="retro-card rounded-[20px] p-4 text-left sm:rounded-[24px] sm:p-5">
            <p className="retro-title theme-kicker text-[10px] leading-relaxed">
              SETTLEMENT PERIOD
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-3">
                <select
                  name="settlement_start_month_offset"
                  value={settings.settlement_start_month_offset}
                  onChange={handleSettingsChange}
                  className="px-4 py-3 text-left"
                >
                  <option value="-1">시작월: 지난달</option>
                  <option value="0">시작월: 이번달</option>
                </select>

                <select
                  name="settlement_start_day"
                  value={settings.settlement_start_day}
                  onChange={handleSettingsChange}
                  className="px-4 py-3 text-left"
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
                  className="px-4 py-3 text-left"
                >
                  <option value="0">종료월: 이번달</option>
                  <option value="1">종료월: 다음달</option>
                </select>

                <select
                  name="settlement_end_day"
                  value={settings.settlement_end_day}
                  onChange={handleSettingsChange}
                  className="px-4 py-3 text-left"
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

          <div className="retro-card rounded-[20px] p-4 text-left sm:rounded-[24px] sm:p-5">
            <p className="retro-title theme-kicker text-[10px] leading-relaxed">
              WEEKLY OFF DAYS
            </p>

            <div className="mt-4 grid grid-cols-4 gap-3 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
              {Array.from({ length: 7 }, (_, i) => i).map((day) => {
                const active = settings.off_days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeeklyOffDay(day)}
                    className={`ui-action-inset min-h-[46px] w-full px-2 py-2.5 text-sm font-semibold sm:w-[72px] ${
                      active ? "retro-button-solid" : "retro-button"
                    }`}
                  >
                    {getKoreanDayLabel(day)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="retro-card rounded-[20px] p-4 text-left sm:rounded-[24px] sm:p-5">
            <p className="retro-title theme-kicker text-[10px] leading-relaxed">
              BIWEEKLY OFF MODE
            </p>

            <p className="theme-copy mt-4 text-sm leading-6">
              기준일 하루를 고르면 해당 요일이 2주 간격 정기휴무로 자동 적용됩니다.
            </p>

            <div className="mt-5 grid w-full gap-4 sm:max-w-[420px] sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setIsDatePickerOpen(true)}
                className="retro-button-solid ui-action-fit min-h-[48px] px-4 py-2.5 text-sm font-semibold"
              >
                {settings.biweekly_anchor_date ? "기준일 다시 선택" : "기준일 선택"}
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
                  className="retro-button ui-action-fit min-h-[48px] px-4 py-2.5 text-sm font-semibold"
                >
                  격주휴무 해제
                </button>
              ) : null}
            </div>

            {settings.biweekly_anchor_date && settings.biweekly_off_days.length > 0 ? (
              <div className="theme-note-box mt-4 rounded-2xl px-4 py-3 text-sm">
                기준일: {settings.biweekly_anchor_date} (
                {getKoreanDayLabel(settings.biweekly_off_days[0])}요일)
              </div>
            ) : (
              <p className="theme-heading mt-4 text-sm font-semibold">
                설정 페이지에서 바로 달력을 열어 기준일을 고를 수 있습니다.
              </p>
            )}
          </div>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="retro-button-solid ui-action-fit min-h-[52px] px-6 py-3.5 text-base font-semibold disabled:opacity-60"
          >
            {saving ? "저장 중..." : "설정 저장"}
          </button>
        </div>
      </div>

      {isDatePickerOpen ? (
        <DatePickerModal
          anchorDate={settings.biweekly_anchor_date}
          biweeklyOffDays={settings.biweekly_off_days}
          onClose={() => setIsDatePickerOpen(false)}
          onApply={applyBiweeklyAnchorDate}
        />
      ) : null}
    </>
  );
}