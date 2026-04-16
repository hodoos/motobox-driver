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
    <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <p className="text-xs font-semibold tracking-wide text-black/55">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-black">{value}</p>
      {sub ? <p className="mt-1 text-xs text-black/45">{sub}</p> : null}
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
      <div className="grid gap-3 md:grid-cols-4">
        <Card label="평균 수량" value={`${props.avgQty}건`} />
        <Card label="평균 매출" value={props.avgSales} />
        <Card label="현재까지 총 수익" value={props.totalSales} />
        <Card label="예상 매출" value={props.expectedSales} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card
          label="정산기간 일 수"
          value={`${props.adjustedPeriodDays}일`}
          sub={`전체 ${props.totalPeriodDays}일 - 정기/격주휴무 ${props.regularOffDays}일`}
        />
        <Card label="근무한 일 수" value={`${props.workedDays}일`} />
        <Card label="추가휴무 일 수" value={`${props.additionalOffDays}일`} />
        <Card label="앞으로 남은 근무 일 수" value={`${props.remainingWorkDays}일`} />
      </div>
    </>
  );
}