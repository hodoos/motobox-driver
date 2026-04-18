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
      <div>
        <div className="space-y-16 text-center sm:space-y-20">
          <div className="retro-card rounded-[18px] px-5 py-5 sm:px-7 sm:py-7">
            <div className="flex flex-wrap justify-center gap-10">
              <div className="flex w-full max-w-[11rem] flex-col items-center gap-5">
                <label
                  className="theme-heading block text-sm font-semibold"
                  style={{ marginTop: "0.875rem", marginBottom: "0.875rem" }}
                >
                  기사명
                </label>
                <input
                  type="text"
                  name="driver_name"
                  value={settings.driver_name}
                  onChange={handleSettingsChange}
                  placeholder="기사명"
                  className="w-full max-w-[11rem] px-4 py-3 text-center"
                  style={{ marginBottom: "0.875rem" }}
                />
              </div>

              <div className="flex w-full max-w-[11rem] flex-col items-center gap-5">
                <label
                  className="theme-heading block text-sm font-semibold"
                  style={{ marginTop: "0.875rem", marginBottom: "0.875rem" }}
                >
                  휴대폰 번호
                </label>
                <input
                  type="tel"
                  name="phone_number"
                  value={settings.phone_number}
                  onChange={handleSettingsChange}
                  placeholder="휴대폰 번호"
                  inputMode="tel"
                  autoComplete="tel"
                  className="w-full max-w-[11rem] px-4 py-3 text-center"
                  style={{ marginBottom: "0.875rem" }}
                />
              </div>

              <div className="flex w-full max-w-[11rem] flex-col items-center gap-5">
                <label
                  className="theme-heading block text-sm font-semibold"
                  style={{ marginTop: "0.875rem", marginBottom: "0.875rem" }}
                >
                  배송 단가
                </label>
                <input
                  type="number"
                  name="unit_price"
                  value={settings.unit_price}
                  onChange={handleSettingsChange}
                  placeholder="배송 단가(원)"
                  className="no-spinner w-full max-w-[11rem] px-4 py-3 text-center"
                  style={{ marginBottom: "0.875rem" }}
                />
              </div>
            </div>
          </div>

          <div className="retro-card rounded-[20px] p-6 text-center sm:rounded-[24px] sm:p-8">
            <div className="space-y-8 rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-5 py-5 sm:px-7 sm:py-7">
              <p className="retro-title theme-heading text-xs leading-relaxed sm:text-sm">
                정산 기간 설정
              </p>

              <div className="flex flex-col items-center">
                <div className="mx-auto grid w-full max-w-[24rem] grid-cols-2 gap-4 sm:gap-5">
                  <select
                    name="settlement_start_month_offset"
                    value={settings.settlement_start_month_offset}
                    onChange={handleSettingsChange}
                    className="w-full min-w-0 px-4 py-3 text-center"
                  >
                    <option value="-1">시작월: 지난달</option>
                    <option value="0">시작월: 이번달</option>
                  </select>

                  <select
                    name="settlement_start_day"
                    value={settings.settlement_start_day}
                    onChange={handleSettingsChange}
                    className="w-full min-w-0 px-4 py-3 text-center"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        시작일 {day}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  className="mx-auto grid w-full max-w-[24rem] grid-cols-2 gap-4 sm:gap-5"
                  style={{ marginTop: "0.875rem", marginBottom: "0.625rem" }}
                >
                  <select
                    name="settlement_end_month_offset"
                    value={settings.settlement_end_month_offset}
                    onChange={handleSettingsChange}
                    className="w-full min-w-0 px-4 py-3 text-center"
                  >
                    <option value="0">종료월: 이번달</option>
                    <option value="1">종료월: 다음달</option>
                  </select>

                  <select
                    name="settlement_end_day"
                    value={settings.settlement_end_day}
                    onChange={handleSettingsChange}
                    className="w-full min-w-0 px-4 py-3 text-center"
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
          </div>

          <div className="retro-card rounded-[20px] p-6 text-center sm:rounded-[24px] sm:p-8">
            <div className="space-y-8 rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-5 py-5 sm:px-7 sm:py-7">
              <p className="retro-title theme-heading text-[16px] leading-relaxed">
                고정 휴무
              </p>

              <div
                className="flex flex-wrap justify-center gap-5"
                style={{ marginBottom: "0.875rem" }}
              >
                {Array.from({ length: 7 }, (_, i) => i).map((day) => {
                  const active = settings.off_days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeeklyOffDay(day)}
                      className={`ui-action-inset min-h-[46px] px-3.5 py-2.5 text-sm font-semibold ${
                        active ? "retro-button-solid" : "retro-button"
                      }`}
                    >
                      {getKoreanDayLabel(day)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="retro-card rounded-[20px] p-6 text-center sm:rounded-[24px] sm:p-8">
            <div className="space-y-8">
              <p className="retro-title theme-heading text-[16px] leading-relaxed">
                격주 휴무
              </p>


              <div className="mx-auto grid w-full gap-6 sm:max-w-[420px] sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(true)}
                  className="retro-button-solid ui-action-fit min-h-[48px] px-4 py-2.5 text-sm font-semibold"
                  style={{ marginBottom: "0.875rem" }}
                >
                  {settings.biweekly_anchor_date ? "기준일 다시 선택" : "격주휴무 설정"}
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
                    style={{ marginBottom: "0.875rem" }}
                  >
                    격주휴무 해제
                  </button>
                ) : null}
              </div>

              {settings.biweekly_anchor_date && settings.biweekly_off_days.length > 0 ? (
                <div>
                  격주 휴무 요일: {getKoreanDayLabel(settings.biweekly_off_days[0])}
                  요일
                </div>
              ) : (
                <p className="theme-heading text-sm font-semibold">
                  {/* 설정 페이지에서 바로 달력을 열어 기준일을 고를 수 있습니다. */}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="retro-button-solid ui-action-fit min-h-[52px] px-6 py-3.5 text-base font-semibold disabled:opacity-60"
            style={{ marginTop: "0.875rem", marginBottom: "0.875rem" }}
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