function Card({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="retro-card rounded-[20px] p-4 sm:rounded-[24px] sm:p-5">
      <p className="retro-title theme-kicker text-[10px] leading-relaxed">
        {label}
      </p>
      <p className="theme-heading mt-4 text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
      {sub ? <p className="theme-copy mt-2 text-xs">{sub}</p> : null}
    </div>
  );
}

type Props = {
  avgQty: number;
  avgSales: string;
  totalSales: string;
  expectedSales: string;
  adjustedPeriodDays: number;
  totalPeriodDays: number;
  regularOffDays: number;
  workedDays: number;
  additionalOffDays: number;
  remainingWorkDays: number;
};

export default function StatCards(props: Props) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="평균 수량" value={`${props.avgQty}건`} />
        <Card label="평균 매출" value={props.avgSales} />
        <Card label="현재 총 수익" value={props.totalSales} />
        <Card label="예상 매출" value={props.expectedSales} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          label="정산기간 일 수"
          value={`${props.adjustedPeriodDays}일`}
          sub={`전체 ${props.totalPeriodDays}일 - 정기/격주휴무 ${props.regularOffDays}일`}
        />
        <Card label="근무한 일 수" value={`${props.workedDays}일`} />
        <Card label="추가휴무 일 수" value={`${props.additionalOffDays}일`} />
        <Card label="남은 근무 일 수" value={`${props.remainingWorkDays}일`} />
      </div>
    </>
  );
}