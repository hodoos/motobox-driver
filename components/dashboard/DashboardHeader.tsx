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
  periodLabel,
  onOpenSettings,
  onLogout,
}: Props) {
  return (
    <div className="retro-panel relative rounded-[24px] px-4 py-5 text-left sm:rounded-[28px] sm:px-5 sm:py-6 md:px-6">
      <div className="flex flex-col items-start gap-4 sm:gap-5 md:flex-row md:items-center md:justify-between">
        <div className="w-full">
          <p className="retro-title theme-kicker text-[10px]">DRIVER REPORT</p>
          <h1 className="retro-title theme-heading mt-3 text-base leading-relaxed sm:text-lg md:text-xl">
            DASHBOARD
          </h1>
          <p className="theme-copy mt-3 text-sm">
            {driverName ? `${driverName} 기사님` : "업무 현황"}
          </p>

          <div className="theme-kicker mt-2 flex flex-col items-start gap-1 text-[11px] sm:text-xs md:flex-row md:items-center md:gap-3">
            <span>{periodLabel}</span>
            {email ? <span>{email}</span> : null}
          </div>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 md:w-auto">
          <button
            onClick={onOpenSettings}
            className="retro-button ui-action-fit min-h-[46px] px-4 py-2.5 text-sm font-semibold md:min-w-[120px]"
          >
            기본설정
          </button>
          <button
            onClick={onLogout}
            className="retro-button-solid ui-action-fit min-h-[46px] px-4 py-2.5 text-sm font-semibold md:min-w-[120px]"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}