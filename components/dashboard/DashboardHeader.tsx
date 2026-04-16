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
    <div className="rounded-[32px] border border-black/8 bg-white px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.06)] md:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-black/40">
            DRIVER REPORT
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            업무 리포트 달력
          </h1>
          <p className="mt-1 text-sm text-black/60">
            {driverName ? `${driverName} 기사님` : email}
          </p>
          <p className="mt-1 text-sm font-medium text-black/70">
            정산기간: {periodLabel}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onOpenSettings}
            className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:border-black/20 hover:bg-black hover:text-white"
          >
            기본설정
          </button>
          <button
            onClick={onLogout}
            className="rounded-2xl bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(0,0,0,0.18)] transition hover:translate-y-[-1px]"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}