type Props = {
  driverName?: string;
  email?: string;
  periodLabel: string;
  onOpenSettings: () => void;
  onLogout: () => void;
};

export default function DashboardHeader({
  driverName,
  email,
  onOpenSettings,
  onLogout,
}: Props) {
  const loginId = email?.split("@")[0]?.trim();
  const headerLabel = driverName
    ? `${driverName} 기사님`
    : loginId
    ? `${loginId} 기사님`
    : "업무 현황";

  return (
    <div className="retro-panel relative rounded-[24px] px-4 py-4 text-left sm:rounded-[28px] sm:px-5 sm:py-5 md:px-6">
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <p
            className="text-xs sm:text-sm"
            style={{
              fontSize: "0.875rem",
              paddingLeft: "0.5rem",
              color: "#f8fafc",
              fontWeight: 700,
            }}
          >
            {headerLabel}
          </p>

          <div
            className="theme-kicker mt-1.5 flex flex-col items-start gap-0.5 text-[10px] sm:text-[11px]"
            style={{ fontSize: "0.6875rem" }}
          >
            {/* <span>{periodLabel}</span> */}
            {/* {email ? <span>{email}</span> : null} */}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 self-start">
          <button
            onClick={onOpenSettings}
            className="retro-button ui-action-fit min-h-[38px] px-3 py-2 text-xs font-semibold md:min-w-[88px]"
            style={{ fontSize: "0.75rem" }}
          >
            기본설정
          </button>
          <button
            onClick={onLogout}
            className="retro-button-solid ui-action-fit min-h-[38px] px-3 py-2 text-xs font-semibold md:min-w-[88px]"
            style={{ fontSize: "0.75rem" }}
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}