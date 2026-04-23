import { useState } from "react";
import { AccountSettings } from "../../types";
import { getKoreanDayLabel } from "../../lib/format";
import DatePickerModal from "./DatePickerModal";

type Props = {
  settings: AccountSettings;
  setSettings: React.Dispatch<React.SetStateAction<AccountSettings>>;
  loginIdLocked: boolean;
  handleSettingsChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  handleLoginIdChange: (value: string) => void;
  handleAffiliationCheckedChange: (checked: boolean) => void;
  onOpenPasswordChange: () => void;
  saveSettings: () => void;
  saving: boolean;
};

export default function SettingsForm({
  settings,
  setSettings,
  loginIdLocked,
  handleSettingsChange,
  handleLoginIdChange,
  handleAffiliationCheckedChange,
  onOpenPasswordChange,
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
        <div className="space-y-8 text-left sm:space-y-10">
          <div className="retro-card rounded-[20px] px-4 py-4 sm:px-6 sm:py-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-3">
                <label className="theme-heading text-sm font-semibold">
                  로그인 ID
                </label>
                <input
                  type="text"
                  name="login_id"
                  value={settings.login_id}
                  onChange={(event) => handleLoginIdChange(event.target.value)}
                  placeholder="로그인 ID"
                  autoComplete="username"
                  maxLength={20}
                  disabled={loginIdLocked}
                  className="w-full min-w-0 px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-70 sm:text-center"
                />
                <p className="theme-copy text-[11px] leading-relaxed">
                  {loginIdLocked
                    ? "한번 설정한 ID는 수정할 수 없습니다."
                    : "영문 소문자와 숫자로 4~20자"}
                </p>
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <label className="theme-heading text-sm font-semibold">
                  이메일
                </label>
                <input
                  type="email"
                  name="email"
                  value={settings.email}
                  onChange={handleSettingsChange}
                  placeholder="이메일"
                  autoComplete="email"
                  className="w-full min-w-0 px-4 py-3 text-left sm:text-center"
                />
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <label className="theme-heading text-sm font-semibold">
                  비밀번호 변경
                </label>
                <button
                  type="button"
                  onClick={onOpenPasswordChange}
                  disabled={saving}
                  className="retro-button-solid inline-flex min-h-[46px] w-full items-center justify-center whitespace-nowrap px-4 py-3 text-center text-sm font-semibold disabled:opacity-60 sm:w-auto"
                >
                  비밀번호 변경하기
                </button>
                <p className="theme-copy text-[11px] leading-relaxed">
                  기존 비밀번호 확인 후 팝업에서 새 비밀번호를 설정합니다.
                </p>
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <label className="theme-heading text-sm font-semibold">
                  기사명
                </label>
                <input
                  type="text"
                  name="driver_name"
                  value={settings.driver_name}
                  onChange={handleSettingsChange}
                  placeholder="기사명"
                  className="w-full min-w-0 px-4 py-3 text-left sm:text-center"
                />
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <label className="theme-heading text-sm font-semibold">
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
                  className="w-full min-w-0 px-4 py-3 text-left sm:text-center"
                />
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <label className="theme-heading text-sm font-semibold">
                  가입 유형
                </label>
                <select
                  name="signup_type"
                  value={settings.signup_type}
                  onChange={handleSettingsChange}
                  className="w-full min-w-0 px-4 py-3 text-left sm:text-center"
                >
                  <option value="driver">기사</option>
                  <option value="vendor">벤더</option>
                </select>
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <label className="theme-heading text-sm font-semibold">
                  소속
                </label>
                <label className="flex min-h-[48px] w-full items-center justify-start gap-2 rounded-[16px] border border-[rgba(255,255,255,0.12)] px-4 py-3 text-sm font-medium sm:justify-center">
                  <input
                    type="checkbox"
                    name="is_coupang"
                    checked={settings.is_coupang}
                    onChange={(event) =>
                      handleAffiliationCheckedChange(event.target.checked)
                    }
                  />
                  <span>쿠팡</span>
                </label>
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <label className="theme-heading text-sm font-semibold">
                  배송 단가
                </label>
                <input
                  type="number"
                  name="unit_price"
                  value={settings.unit_price}
                  onChange={handleSettingsChange}
                  placeholder="배송 단가(원)"
                  className="no-spinner w-full min-w-0 px-4 py-3 text-left sm:text-center"
                />
              </div>
            </div>
          </div>

          <div className="retro-card rounded-[20px] p-5 text-left sm:rounded-[24px] sm:p-8">
            <div className="space-y-6 rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-4 sm:px-7 sm:py-7">
              <p className="retro-title theme-heading text-xs leading-relaxed sm:text-sm">
                정산 기간 설정
              </p>

              <div className="flex flex-col gap-4">
                <div className="grid w-full gap-3 sm:max-w-[24rem] sm:grid-cols-2 sm:gap-5">
                  <select
                    name="settlement_start_month_offset"
                    value={settings.settlement_start_month_offset}
                    onChange={handleSettingsChange}
                    className="w-full min-w-0 px-4 py-3 text-left sm:text-center"
                  >
                    <option value="-1">시작월: 지난달</option>
                    <option value="0">시작월: 이번달</option>
                  </select>

                  <select
                    name="settlement_start_day"
                    value={settings.settlement_start_day}
                    onChange={handleSettingsChange}
                    className="w-full min-w-0 px-4 py-3 text-left sm:text-center"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        시작일 {day}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid w-full gap-3 sm:max-w-[24rem] sm:grid-cols-2 sm:gap-5">
                  <select
                    name="settlement_end_month_offset"
                    value={settings.settlement_end_month_offset}
                    onChange={handleSettingsChange}
                    className="w-full min-w-0 px-4 py-3 text-left sm:text-center"
                  >
                    <option value="0">종료월: 이번달</option>
                    <option value="1">종료월: 다음달</option>
                  </select>

                  <select
                    name="settlement_end_day"
                    value={settings.settlement_end_day}
                    onChange={handleSettingsChange}
                    className="w-full min-w-0 px-4 py-3 text-left sm:text-center"
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

          <div className="retro-card rounded-[20px] p-5 text-left sm:rounded-[24px] sm:p-8">
            <div className="space-y-8 rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-5 py-5 sm:px-7 sm:py-7">
              <p className="retro-title theme-heading text-[16px] leading-relaxed">
                고정 휴무
              </p>

              <div className="flex flex-wrap justify-start gap-3 sm:justify-center sm:gap-5">
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

          <div className="retro-card rounded-[20px] p-5 text-left sm:rounded-[24px] sm:p-8">
            <div className="space-y-6">
              <p className="retro-title theme-heading text-[16px] leading-relaxed">
                격주 휴무
              </p>

              <div className="grid w-full gap-3 sm:max-w-[420px] sm:grid-cols-2 sm:gap-6">
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(true)}
                  className="retro-button-solid ui-action-fit min-h-[48px] px-4 py-2.5 text-sm font-semibold"
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
                  >
                    격주휴무 해제
                  </button>
                ) : null}
              </div>

              {settings.biweekly_anchor_date && settings.biweekly_off_days.length > 0 ? (
                <div className="theme-note-box rounded-[18px] px-4 py-3 text-sm leading-relaxed">
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
            className="retro-button-solid ui-action-fit min-h-[52px] w-full px-6 py-3.5 text-base font-semibold disabled:opacity-60 sm:w-auto"
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