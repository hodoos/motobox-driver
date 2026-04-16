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
    <div className="retro-panel rounded-[28px] px-4 py-5 text-center md:px-6 md:text-left">
      <div className="flex flex-col items-center gap-4 md:flex-row md:items-center md:justify-between">
        <div className="w-full">
          <p className="retro-title text-[10px] text-[#6effa6]/60">DRIVER REPORT</p>
          <h1 className="retro-title mt-3 text-lg leading-relaxed text-[#b8ffd2] md:text-xl">
            DASHBOARD
          </h1>
          <p className="mt-3 text-sm text-[#7dffb1]/72">
            {driverName ? `${driverName} 기사님` : email}
          </p>
          <p className="mt-1 text-sm font-medium text-[#a7ffca]">{periodLabel}</p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <button
            onClick={onOpenSettings}
            className="retro-button w-full px-4 py-3 text-sm font-semibold md:w-auto"
          >
            기본설정
          </button>
          <button
            onClick={onLogout}
            className="retro-button-solid w-full px-4 py-3 text-sm font-semibold md:w-auto"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}