import type { CSSProperties } from "react";

type CardAccent = {
  labelColor: string;
  valueColor: string;
  subColor: string;
  shadowColor: string;
};

const STAT_CARD_ACCENTS: CardAccent[] = [
  {
    labelColor: "rgba(139, 224, 255, 0.96)",
    valueColor: "rgba(239, 250, 255, 0.98)",
    subColor: "rgba(174, 218, 229, 0.84)",
    shadowColor: "rgba(64, 160, 196, 0.18)",
  },
  {
    labelColor: "rgba(255, 203, 128, 0.96)",
    valueColor: "rgba(255, 245, 228, 0.98)",
    subColor: "rgba(229, 206, 173, 0.84)",
    shadowColor: "rgba(195, 126, 50, 0.16)",
  },
  {
    labelColor: "rgba(255, 166, 148, 0.96)",
    valueColor: "rgba(255, 239, 236, 0.98)",
    subColor: "rgba(229, 190, 182, 0.82)",
    shadowColor: "rgba(205, 96, 72, 0.16)",
  },
  {
    labelColor: "rgba(148, 234, 198, 0.96)",
    valueColor: "rgba(236, 253, 246, 0.98)",
    subColor: "rgba(183, 224, 208, 0.84)",
    shadowColor: "rgba(70, 164, 125, 0.16)",
  },
  {
    labelColor: "rgba(173, 210, 255, 0.96)",
    valueColor: "rgba(239, 245, 255, 0.98)",
    subColor: "rgba(188, 205, 230, 0.84)",
    shadowColor: "rgba(83, 128, 204, 0.16)",
  },
  {
    labelColor: "rgba(255, 190, 158, 0.96)",
    valueColor: "rgba(255, 242, 235, 0.98)",
    subColor: "rgba(230, 199, 185, 0.84)",
    shadowColor: "rgba(198, 109, 74, 0.16)",
  },
  {
    labelColor: "rgba(199, 229, 160, 0.96)",
    valueColor: "rgba(246, 252, 235, 0.98)",
    subColor: "rgba(214, 225, 188, 0.84)",
    shadowColor: "rgba(126, 158, 66, 0.16)",
  },
  {
    labelColor: "rgba(188, 225, 220, 0.96)",
    valueColor: "rgba(239, 251, 250, 0.98)",
    subColor: "rgba(193, 221, 218, 0.84)",
    shadowColor: "rgba(79, 152, 145, 0.16)",
  },
];

function getCardAccent(index: number) {
  return STAT_CARD_ACCENTS[index % STAT_CARD_ACCENTS.length];
}

function Card({
  label,
  value,
  sub,
  accent,
  className,
  style,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: CardAccent;
  className?: string;
  style?: CSSProperties;
}) {
  const cardStyle = {
    boxShadow: `0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 0 0 1px ${accent.shadowColor}, 0 24px 80px rgba(0, 0, 0, 0.48)`,
    "--stat-label-color": accent.labelColor,
    "--stat-value-color": accent.valueColor,
    "--stat-sub-color": accent.subColor,
  } as CSSProperties;

  return (
    <div
      className={`retro-card rounded-[20px] p-4 sm:rounded-[24px] sm:p-5 ${className ?? ""}`}
      style={{ ...cardStyle, ...style }}
    >
      <p className="retro-title text-center text-sm leading-relaxed [color:var(--stat-label-color)] sm:text-[15px]">
        {label}
      </p>
      <p className="mt-4 text-center text-2xl font-bold tracking-tight [color:var(--stat-value-color)] sm:text-[2rem]">
        {value}
      </p>
      {sub ? (
        <p className="mt-2 text-center text-sm leading-relaxed [color:var(--stat-sub-color)]">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

type Props = {
  totalQuantity: number;
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
  const cardSpacing = { marginRight: "24px" } as const;
  const primaryRowSpacing = { marginTop: "20px", marginBottom: "20px" } as const;

  const primaryStats = [
    { label: "누적 건 수", value: `${props.totalQuantity}건` },
    { label: "누적 매출", value: props.totalSales },
    { label: "평균 수량", value: `${props.avgQty}건` },
    { label: "예상 매출", value: props.expectedSales },
    { label: "평균 매출", value: props.avgSales },
  ];

  const secondaryStats = [
    { label: "정산기간 일 수", value: `${props.adjustedPeriodDays}일` },
    { label: "근무한 일 수", value: `${props.workedDays}일` },
    { label: "추가휴무 일 수", value: `${props.additionalOffDays}일` },
    { label: "남은 근무 일 수", value: `${props.remainingWorkDays}일` },
  ];

  const secondarySummary = `전체 ${props.totalPeriodDays}일 - 정기/격주휴무 ${props.regularOffDays}일`;

  return (
    <>
      <div
        className="mx-auto flex w-fit max-w-full flex-wrap items-start justify-center gap-3"
        style={primaryRowSpacing}
      >
        {primaryStats.map((card, index) => (
          <Card
            key={card.label}
            label={card.label}
            value={card.value}
            accent={getCardAccent(index)}
            className="w-fit shrink-0"
            style={index < primaryStats.length - 1 ? cardSpacing : undefined}
          />
        ))}
      </div>

      <div className="mx-auto w-fit max-w-full rounded-[24px] px-3 py-3 sm:rounded-[28px] sm:px-4 sm:py-4">
        <div className="flex flex-wrap items-start justify-center gap-3">
          {secondaryStats.map((card, index) => (
            <Card
              key={card.label}
              label={card.label}
              value={card.value}
              sub={card.sub}
              accent={getCardAccent(index + primaryStats.length)}
              className="w-fit shrink-0"
              style={index < secondaryStats.length - 1 ? cardSpacing : undefined}
            />
          ))}
        </div>
        <p className="theme-copy mt-3 text-center text-sm leading-relaxed">
          {secondarySummary}
        </p>
      </div>
    </>
  );
}