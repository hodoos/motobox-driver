"use client";

import type { CollisionDetection, DragEndEvent } from "@dnd-kit/core";
import type { User } from "@supabase/supabase-js";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import {
  consumePendingToast,
  createToastState,
  getKoreanErrorMessage,
  ToastState,
} from "../../lib/toast";
import { extractDriverProfileSeed } from "../../lib/driverSettings";
import { formatMoney, getKoreanDayLabel, toDateString } from "../../lib/format";
import {
  DASHBOARD_SECTION_EVENT,
  DASHBOARD_SECTION_STORAGE_KEY,
  isDashboardSectionId,
  type DashboardSectionId,
} from "../../lib/dashboardNavigation";
import {
  eachDateBetween,
  getSettlementRange,
  shiftSettlementAnchor,
} from "../../lib/settlement";
import { isBiweeklyOffDate } from "../../lib/offday";
import { getReportDayStatus, isRegularOffStatus } from "../../lib/reportStatus";
import {
  AdditionalWorkItemForm,
  DailyReportRow,
  DriverSettings,
  ExpenseItemForm,
  FreshbackRecoveryItemForm,
  ReportForm,
  UserType,
} from "../../types";
import StatCards from "../../components/dashboard/StatCards";
import ReportModal from "../../components/dashboard/ReportModal";
import ReportList from "../../components/dashboard/ReportList";
import TodayQuickCard from "../../components/dashboard/TodayQuickCard";
import WeatherCard from "../../components/dashboard/WeatherCard";
import PageShell, { PageLoadingShell } from "../../components/layout/PageShell";
import ToastViewport from "../../components/ui/ToastViewport";

type WorkSummaryStripProps = {
  adjustedPeriodDays: number;
  totalPeriodDays: number;
  regularOffDays: number;
  workedDays: number;
  additionalOffDays: number;
  remainingWorkDays: number;
};

type DailySalesListItem = {
  dateKey: string;
  dateLabel: string;
  quantityLabel: string;
  salesLabel: string;
  expenseLabel: string | null;
};

type DashboardHomeMetricCardData = {
  label: string;
  value: string;
  sub?: string;
  labelClassName?: string;
  valueClassName?: string;
};

const DASHBOARD_HOME_WORK_SUMMARY_ITEM_IDS = [
  "work-summary-adjusted-period-days",
  "work-summary-worked-days",
  "work-summary-additional-off-days",
  "work-summary-remaining-work-days",
  "work-summary-period-overview",
] as const;

const DASHBOARD_HOME_SALES_STAT_ITEM_IDS = [
  "sales-stat-total-quantity",
  "sales-stat-total-sales",
  "sales-stat-avg-qty",
  "sales-stat-expected-sales",
  "sales-stat-avg-sales",
] as const;

const WORK_SUMMARY_OVERVIEW_ITEM_ID = "work-summary-period-overview";
const LEGACY_STATS_HOME_LAYOUT_ID = "stats";

const WORK_SUMMARY_ITEMS = [
  {
    id: "work-summary-adjusted-period-days",
    label: "이달 근무",
    valueKey: "adjustedPeriodDays",
    labelClassName: "text-[rgba(255,203,128,0.96)]",
    valueClassName: "text-[rgba(255,245,228,0.98)]",
  },
  {
    id: "work-summary-worked-days",
    label: "정상 근무",
    valueKey: "workedDays",
    labelClassName: "text-[rgba(199,229,160,0.96)]",
    valueClassName: "text-[rgba(246,252,235,0.98)]",
  },
  {
    id: "work-summary-additional-off-days",
    label: "추가 휴무",
    valueKey: "additionalOffDays",
    labelClassName: "text-[rgba(148,234,198,0.96)]",
    valueClassName: "text-[rgba(236,253,246,0.98)]",
  },
  {
    id: "work-summary-remaining-work-days",
    label: "남은 근무",
    valueKey: "remainingWorkDays",
    labelClassName: "text-[rgba(173,210,255,0.96)]",
    valueClassName: "text-[rgba(239,245,255,0.98)]",
  },
] as const;

function WorkSummaryStrip(props: WorkSummaryStripProps) {
  const values = {
    adjustedPeriodDays: `${props.adjustedPeriodDays}일`,
    workedDays: `${props.workedDays}일`,
    additionalOffDays: `${props.additionalOffDays}일`,
    remainingWorkDays: `${props.remainingWorkDays}일`,
  } as const;

  return (
    <section className="mt-1 w-full">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {WORK_SUMMARY_ITEMS.map((item) => (
          <div
            key={item.label}
            className="retro-card min-w-0 rounded-[20px] p-3 text-center sm:rounded-[24px] sm:p-5"
          >
            <p className={`retro-title text-sm leading-relaxed ${item.labelClassName}`}>
              {item.label}
            </p>
            <p className={`mt-2 text-xl font-bold tracking-tight sm:mt-3 sm:text-[2rem] ${item.valueClassName}`}>
              {values[item.valueKey]}
            </p>
          </div>
        ))}
      </div>
      <p className="theme-copy mt-3 text-center text-sm leading-relaxed">
        전체 {props.totalPeriodDays}일 - 정기/격주휴무 {props.regularOffDays}일
      </p>
    </section>
  );
}

function formatDashboardDateLabel(date: Date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${getKoreanDayLabel(date.getDay())})`;
}

const DASHBOARD_HOME_LAYOUT_SECTION_IDS = [
  "work-calendar",
  "daily-sales-list",
  "today-quick-card",
    "weather-card",
  ...DASHBOARD_HOME_WORK_SUMMARY_ITEM_IDS,
  ...DASHBOARD_HOME_SALES_STAT_ITEM_IDS,
] as const;

type DashboardHomeLayoutSectionId =
  (typeof DASHBOARD_HOME_LAYOUT_SECTION_IDS)[number];

type DashboardHomeLayoutItem = {
  id: DashboardHomeLayoutSectionId;
  visible: boolean;
};

const DASHBOARD_HOME_LAYOUT_LABELS: Record<DashboardHomeLayoutSectionId, string> = {
  "today-quick-card": "일일 리포트 작성",
    "weather-card": "날씨 정보",
  "work-summary-adjusted-period-days": "근무 통계 - 이달 근무",
  "work-summary-worked-days": "근무 통계 - 정상 근무",
  "work-summary-additional-off-days": "근무 통계 - 추가 휴무",
  "work-summary-remaining-work-days": "근무 통계 - 남은 근무",
  "work-summary-period-overview": "근무 통계 - 전체 기간 요약",
  "sales-stat-total-quantity": "매출 통계 - 누적 건 수",
  "sales-stat-total-sales": "매출 통계 - 누적 매출",
  "sales-stat-avg-qty": "매출 통계 - 평균 수량",
  "sales-stat-expected-sales": "매출 통계 - 예상 매출",
  "sales-stat-avg-sales": "매출 통계 - 평균 매출",
  "daily-sales-list": "일별 총 매출",
  "work-calendar": "업무 캘린더",
};

const DEFAULT_DASHBOARD_HOME_LAYOUT: DashboardHomeLayoutItem[] = [
  { id: "work-calendar", visible: false },
  { id: "daily-sales-list", visible: false },
  { id: "today-quick-card", visible: true },
    { id: "weather-card", visible: false },
  ...DASHBOARD_HOME_WORK_SUMMARY_ITEM_IDS.map((id) => ({ id, visible: false })),
  ...DASHBOARD_HOME_SALES_STAT_ITEM_IDS.map((id) => ({ id, visible: false })),
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDashboardHomeLayoutSectionId(
  value: unknown
): value is DashboardHomeLayoutSectionId {
  return DASHBOARD_HOME_LAYOUT_SECTION_IDS.some((id) => id === value);
}

function isDashboardHomeMetricCardId(value: DashboardHomeLayoutSectionId) {
  return (
    value !== "today-quick-card" &&
      value !== "weather-card" &&
    value !== "daily-sales-list" &&
    value !== "work-calendar"
  );
}

const dashboardHomeLayoutCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);

  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  return closestCenter(args);
};

function expandDashboardHomeLayoutSectionIds(value: unknown): DashboardHomeLayoutSectionId[] {
  if (value === LEGACY_STATS_HOME_LAYOUT_ID) {
    return [...DASHBOARD_HOME_SALES_STAT_ITEM_IDS];
  }

  return isDashboardHomeLayoutSectionId(value) ? [value] : [];
}

function normalizeDashboardHomeLayout(value: unknown) {
  const storedItems = Array.isArray(value) ? value : [];
  const storedOrder: DashboardHomeLayoutSectionId[] = [];
  const storedVisibility = new Map<DashboardHomeLayoutSectionId, boolean>();

  storedItems.forEach((item) => {
    if (!isRecord(item)) {
      return;
    }

    const expandedIds = expandDashboardHomeLayoutSectionIds(item.id);

    if (expandedIds.length === 0) {
      return;
    }

    expandedIds.forEach((id) => {
      if (!storedOrder.includes(id)) {
        storedOrder.push(id);
      }

      storedVisibility.set(id, item.visible !== false);
    });
  });

  DASHBOARD_HOME_LAYOUT_SECTION_IDS.forEach((id) => {
    if (!storedOrder.includes(id)) {
      storedOrder.push(id);
    }
  });

  return storedOrder.map((id) => ({
    id,
    visible:
      storedVisibility.get(id) ??
      DEFAULT_DASHBOARD_HOME_LAYOUT.find((item) => item.id === id)?.visible ??
      true,
  }));
}

function readDashboardHomeLayout(user?: Pick<User, "user_metadata"> | null) {
  return normalizeDashboardHomeLayout(user?.user_metadata?.dashboard_home_layout);
}

type DashboardHomeLayoutEditorItemProps = {
  item: DashboardHomeLayoutItem;
  label: string;
  onToggleVisible: () => void;
};

function DashboardHomeLayoutEditorItem({
  item,
  label,
  onToggleVisible,
}: DashboardHomeLayoutEditorItemProps) {
  return (
    <label className="theme-note-box flex min-h-[38px] cursor-pointer items-center gap-2.5 rounded-[16px] px-3 py-2.5">
      <input
        type="checkbox"
        checked={item.visible}
        onChange={onToggleVisible}
        className="h-4 w-4 shrink-0 cursor-pointer accent-[rgb(244,176,75)]"
      />
      <span className="theme-heading break-keep text-sm font-semibold leading-snug">
        {label}
      </span>
    </label>
  );
}

type DashboardHomeSortableSectionProps = {
  itemId: DashboardHomeLayoutSectionId;
  label: string;
  dragLocked: boolean;
  compact: boolean;
  renderSection: (dragHandle: ReactNode) => ReactNode;
};

function DashboardHomeSortableSection({
  itemId,
  label,
  dragLocked,
  compact,
  renderSection,
}: DashboardHomeSortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId, disabled: dragLocked });

  const transformStyle = transform
    ? CSS.Transform.toString({
        ...transform,
        scaleX: 1,
        scaleY: 1,
      })
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transformStyle,
        transition,
      }}
      className={`${compact ? "w-[6.8rem] max-w-full flex-none min-[380px]:w-[7rem] sm:w-[7.2rem]" : "w-full basis-full"}${
        isDragging ? " opacity-85" : ""
      }`}
    >
      {renderSection(
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={`${label} 홈 카드 드래그`}
          disabled={dragLocked}
          className="retro-button flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] px-0 py-0 text-base active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-45 [touch-action:none]"
          {...attributes}
          {...listeners}
        >
          <span className="sr-only">{label} 홈 카드 드래그</span>
          <span aria-hidden="true" className="grid grid-cols-2 gap-[5px]">
            {Array.from({ length: 6 }).map((_, dotIndex) => (
              <span
                key={`${itemId}-home-drag-dot-${dotIndex}`}
                className="h-[5px] w-[5px] rounded-full bg-[rgba(255,255,255,0.82)] sm:h-[6px] sm:w-[6px]"
              />
            ))}
          </span>
        </button>
      )}
    </div>
  );
}

type StoredAdditionalWorkItem = Omit<AdditionalWorkItemForm, "key">;
type StoredFreshbackRecoveryItem = Omit<FreshbackRecoveryItemForm, "key">;
type StoredExpenseItem = Omit<ExpenseItemForm, "key">;

const LEGACY_ADDITIONAL_WORK_MEMO_MARKER =
  /\n?\[\[MOTOBOX_ADDITIONAL_WORK:([0-9]+(?:\.[0-9]+)?)\]\]$/;
const ADDITIONAL_WORKS_MEMO_MARKER = /\n?\[\[MOTOBOX_ADDITIONAL_WORKS:([\s\S]+)\]\]$/;
const REPORT_META_MEMO_MARKER = /\n?\[\[MOTOBOX_REPORT_META:([\s\S]+)\]\]$/;

let additionalWorkKeySeed = 0;
let freshbackRecoveryKeySeed = 0;
let expenseItemKeySeed = 0;

function createAdditionalWorkItem(
  overrides: Partial<StoredAdditionalWorkItem> = {}
): AdditionalWorkItemForm {
  additionalWorkKeySeed += 1;

  return {
    key: `additional-work-${additionalWorkKeySeed}`,
    unit_price: overrides.unit_price ?? "",
    delivered_count: overrides.delivered_count ?? "",
    returned_count: overrides.returned_count ?? "",
    canceled_count: overrides.canceled_count ?? "",
  };
}

function hasAdditionalWorkValues(item: StoredAdditionalWorkItem | AdditionalWorkItemForm) {
  return Boolean(
    item.unit_price.trim() ||
      item.delivered_count.trim() ||
      item.returned_count.trim() ||
      item.canceled_count.trim()
  );
}

function createFreshbackRecoveryItem(
  overrides: Partial<StoredFreshbackRecoveryItem> = {}
): FreshbackRecoveryItemForm {
  freshbackRecoveryKeySeed += 1;

  return {
    key: `freshback-recovery-${freshbackRecoveryKeySeed}`,
    unit_price: overrides.unit_price ?? "",
    quantity: overrides.quantity ?? "",
  };
}

function createExpenseItem(
  overrides: Partial<StoredExpenseItem> = {}
): ExpenseItemForm {
  expenseItemKeySeed += 1;

  return {
    key: `expense-item-${expenseItemKeySeed}`,
    description: overrides.description ?? "",
    amount: overrides.amount ?? "",
  };
}

function createDefaultExpenseItems(): ExpenseItemForm[] {
  return [createExpenseItem()];
}

function ensureExpenseItems(items: ExpenseItemForm[]): ExpenseItemForm[] {
  return items.length > 0 ? items : createDefaultExpenseItems();
}

function createDefaultFreshbackRecoveryItems(): FreshbackRecoveryItemForm[] {
  return [createFreshbackRecoveryItem()];
}

function ensureFreshbackRecoveryItems(
  items: FreshbackRecoveryItemForm[]
): FreshbackRecoveryItemForm[] {
  return items.length > 0 ? items : createDefaultFreshbackRecoveryItems();
}

function hasFreshbackRecoveryItemValues(
  item: StoredFreshbackRecoveryItem | FreshbackRecoveryItemForm
) {
  return Boolean(item.unit_price.trim() || item.quantity.trim());
}

function hasExpenseItemValues(item: StoredExpenseItem | ExpenseItemForm) {
  return Boolean(item.description.trim() || item.amount.trim());
}

function mapStoredFreshbackRecovery(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) =>
      createFreshbackRecoveryItem({
        unit_price:
          typeof item?.unit_price === "string"
            ? item.unit_price
            : String(item?.unit_price ?? ""),
        quantity:
          typeof item?.quantity === "string"
            ? item.quantity
            : String(item?.quantity ?? ""),
      })
    );
  }

  if (!isRecord(value)) {
    return [] as FreshbackRecoveryItemForm[];
  }

  return [
    createFreshbackRecoveryItem({
      unit_price: "100",
      quantity:
        typeof value.count100 === "string"
          ? value.count100
          : String(value.count100 ?? ""),
    }),
    createFreshbackRecoveryItem({
      unit_price: "150",
      quantity:
        typeof value.count150 === "string"
          ? value.count150
          : String(value.count150 ?? ""),
    }),
    createFreshbackRecoveryItem({
      unit_price: "200",
      quantity:
        typeof value.count200 === "string"
          ? value.count200
          : String(value.count200 ?? ""),
    }),
  ].filter(hasFreshbackRecoveryItemValues);
}

function hasFreshbackRecoveryValues(value: FreshbackRecoveryItemForm[]) {
  return value.some(hasFreshbackRecoveryItemValues);
}

function getFreshbackRecoverySales(value: FreshbackRecoveryItemForm[]) {
  return value.reduce(
    (sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0),
    0
  );
}

function getAdditionalWorkMetrics(
  additionalWorks: AdditionalWorkItemForm[],
  includeCanceledInSales: boolean
) {
  return additionalWorks.reduce(
    (totals, item) => {
      const deliveredCount = Number(item.delivered_count || 0);
      const returnedCount = Number(item.returned_count || 0);
      const canceledCount = Number(item.canceled_count || 0);
      const unitPrice = Number(item.unit_price || 0);
      const workCount =
        deliveredCount +
        returnedCount +
        (includeCanceledInSales ? canceledCount : 0);

      totals.deliveredCount += deliveredCount;
      totals.returnedCount += returnedCount;
      totals.canceledCount += canceledCount;

      if (unitPrice > 0) {
        totals.sales += workCount > 0 ? workCount * unitPrice : unitPrice;
      }

      return totals;
    },
    {
      deliveredCount: 0,
      returnedCount: 0,
      canceledCount: 0,
      sales: 0,
    }
  );
}

function mapStoredAdditionalWorks(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as AdditionalWorkItemForm[];
  }

  return value.map((item) =>
    createAdditionalWorkItem({
      unit_price:
        typeof item?.unit_price === "string"
          ? item.unit_price
          : String(item?.unit_price ?? ""),
      delivered_count:
        typeof item?.delivered_count === "string"
          ? item.delivered_count
          : String(item?.delivered_count ?? ""),
      returned_count:
        typeof item?.returned_count === "string"
          ? item.returned_count
          : String(item?.returned_count ?? ""),
      canceled_count:
        typeof item?.canceled_count === "string"
          ? item.canceled_count
          : String(item?.canceled_count ?? ""),
    })
  );
}

function mapStoredExpenses(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as ExpenseItemForm[];
  }

  return value.map((item) =>
    createExpenseItem({
      description:
        typeof item?.description === "string"
          ? item.description
          : String(item?.description ?? ""),
      amount:
        typeof item?.amount === "string"
          ? item.amount
          : String(item?.amount ?? ""),
    })
  );
}

function parseStoredMemo(rawMemo?: string | null) {
  if (!rawMemo) {
    return {
      memo: "",
      additionalWorks: [] as AdditionalWorkItemForm[],
      includeCanceledInSales: false,
      freshbackRecoveryItems: [] as FreshbackRecoveryItemForm[],
      expenseItems: [] as ExpenseItemForm[],
    };
  }

  const reportMetaMatch = rawMemo.match(REPORT_META_MEMO_MARKER);

  if (reportMetaMatch && typeof reportMetaMatch.index === "number") {
    try {
      const decoded = decodeURIComponent(reportMetaMatch[1] ?? "");
      const parsed = JSON.parse(decoded) as {
        additionalWorks?: unknown;
        includeCanceledInSales?: unknown;
        freshbackRecovery?: unknown;
        expenseItems?: unknown;
      };

      return {
        memo: rawMemo.slice(0, reportMetaMatch.index).trimEnd(),
        additionalWorks: mapStoredAdditionalWorks(parsed.additionalWorks),
        includeCanceledInSales: parsed.includeCanceledInSales === true,
        freshbackRecoveryItems: mapStoredFreshbackRecovery(parsed.freshbackRecovery),
        expenseItems: mapStoredExpenses(parsed.expenseItems),
      };
    } catch {
      return {
        memo: rawMemo,
        additionalWorks: [] as AdditionalWorkItemForm[],
        includeCanceledInSales: false,
        freshbackRecoveryItems: [] as FreshbackRecoveryItemForm[],
        expenseItems: [] as ExpenseItemForm[],
      };
    }
  }

  const worksMatch = rawMemo.match(ADDITIONAL_WORKS_MEMO_MARKER);

  if (worksMatch && typeof worksMatch.index === "number") {
    try {
      const decoded = decodeURIComponent(worksMatch[1] ?? "");
      const parsed = JSON.parse(decoded);

      if (Array.isArray(parsed)) {
        return {
          memo: rawMemo.slice(0, worksMatch.index).trimEnd(),
          additionalWorks: mapStoredAdditionalWorks(parsed),
          includeCanceledInSales: false,
          freshbackRecoveryItems: [] as FreshbackRecoveryItemForm[],
          expenseItems: [] as ExpenseItemForm[],
        };
      }
    } catch {
      return {
        memo: rawMemo,
        additionalWorks: [] as AdditionalWorkItemForm[],
        includeCanceledInSales: false,
        freshbackRecoveryItems: [] as FreshbackRecoveryItemForm[],
        expenseItems: [] as ExpenseItemForm[],
      };
    }
  }

  const legacyMatch = rawMemo.match(LEGACY_ADDITIONAL_WORK_MEMO_MARKER);

  if (legacyMatch && typeof legacyMatch.index === "number") {
    return {
      memo: rawMemo.slice(0, legacyMatch.index).trimEnd(),
      additionalWorks: [createAdditionalWorkItem({ unit_price: legacyMatch[1] ?? "" })],
      includeCanceledInSales: false,
      freshbackRecoveryItems: [] as FreshbackRecoveryItemForm[],
      expenseItems: [] as ExpenseItemForm[],
    };
  }

  return {
    memo: rawMemo,
    additionalWorks: [] as AdditionalWorkItemForm[],
    includeCanceledInSales: false,
    freshbackRecoveryItems: [] as FreshbackRecoveryItemForm[],
    expenseItems: [] as ExpenseItemForm[],
  };
}

function buildStoredMemo(
  memo: string,
  additionalWorks: AdditionalWorkItemForm[],
  includeCanceledInSales: boolean,
  freshbackRecoveryItems: FreshbackRecoveryItemForm[],
  expenseItems: ExpenseItemForm[]
) {
  const trimmedMemo = memo.trimEnd();
  const sanitizedAdditionalWorks = additionalWorks
    .filter(hasAdditionalWorkValues)
    .map(({ unit_price, delivered_count, returned_count, canceled_count }) => ({
      unit_price,
      delivered_count,
      returned_count,
      canceled_count,
    }));

  const sanitizedFreshbackRecovery = freshbackRecoveryItems
    .filter(hasFreshbackRecoveryItemValues)
    .map(({ unit_price, quantity }) => ({
      unit_price,
      quantity,
    }));
  const sanitizedExpenseItems = expenseItems
    .filter(hasExpenseItemValues)
    .map(({ description, amount }) => ({
      description,
      amount,
    }));
  const hasFreshbackRecovery = sanitizedFreshbackRecovery.length > 0;
  const hasExpenseItems = sanitizedExpenseItems.length > 0;

  if (
    sanitizedAdditionalWorks.length === 0 &&
    !includeCanceledInSales &&
    !hasFreshbackRecovery &&
    !hasExpenseItems
  ) {
    return trimmedMemo;
  }

  const marker = `[[MOTOBOX_REPORT_META:${encodeURIComponent(
    JSON.stringify({
      additionalWorks: sanitizedAdditionalWorks,
      includeCanceledInSales,
      freshbackRecovery: hasFreshbackRecovery ? sanitizedFreshbackRecovery : undefined,
      expenseItems: hasExpenseItems ? sanitizedExpenseItems : undefined,
    })
  )}]]`;

  return trimmedMemo ? `${trimmedMemo}\n${marker}` : marker;
}

function createEmptyReportForm(dateKey: string): ReportForm {
  return {
    report_date: dateKey,
    delivered_count: "",
    returned_count: "",
    canceled_count: "",
    include_canceled_in_sales: false,
    memo: "",
    is_day_off: false,
    unit_price_override: "",
    additional_works: [],
    freshback_recovery_items: createDefaultFreshbackRecoveryItems(),
    expense_items: createDefaultExpenseItems(),
  };
}

function getReportFormForDate(rows: DailyReportRow[], dateKey: string): ReportForm {
  const report = rows.find((item) => item.report_date === dateKey);

  if (!report) {
    return createEmptyReportForm(dateKey);
  }

  const parsedMemo = parseStoredMemo(report.memo);
  const additionalWorkMetrics = getAdditionalWorkMetrics(
    parsedMemo.additionalWorks,
    parsedMemo.includeCanceledInSales
  );

  return {
    report_date: report.report_date,
    delivered_count: String(
      Math.max((report.delivered_count ?? 0) - additionalWorkMetrics.deliveredCount, 0)
    ),
    returned_count: String(
      Math.max((report.returned_count ?? 0) - additionalWorkMetrics.returnedCount, 0)
    ),
    canceled_count: String(
      Math.max((report.canceled_count ?? 0) - additionalWorkMetrics.canceledCount, 0)
    ),
    include_canceled_in_sales: parsedMemo.includeCanceledInSales,
    memo: parsedMemo.memo,
    is_day_off: Boolean(report.is_day_off),
    unit_price_override: report.unit_price_override
      ? String(report.unit_price_override)
      : "",
    additional_works: parsedMemo.additionalWorks,
    freshback_recovery_items: ensureFreshbackRecoveryItems(
      parsedMemo.freshbackRecoveryItems
    ),
    expense_items: ensureExpenseItems(parsedMemo.expenseItems),
  };
}

function getBillableQuantity(
  deliveredCount: number,
  returnedCount: number,
  canceledCount: number,
  includeCanceledInSales: boolean
) {
  return (
    deliveredCount +
    (returnedCount > 0 ? 1 : 0) +
    (includeCanceledInSales ? canceledCount : 0)
  );
}

function getDailySales(
  deliveredCount: number,
  returnedCount: number,
  canceledCount: number,
  includeCanceledInSales: boolean,
  unitPrice: number
) {
  return (
    deliveredCount +
    returnedCount +
    (includeCanceledInSales ? canceledCount : 0)
  ) * unitPrice;
}

function getDateWithinRange(
  dateKey: string,
  startDateKey: string,
  endDateKey: string,
  fallbackDateKey: string
) {
  if (dateKey >= startDateKey && dateKey <= endDateKey) {
    return dateKey;
  }

  if (fallbackDateKey >= startDateKey && fallbackDateKey <= endDateKey) {
    return fallbackDateKey;
  }

  return startDateKey;
}

async function loadDriverSettings(userId: string) {
  const { data, error } = await supabase
    .from("driver_settings")
    .select("*")
    .eq("user_id", userId)
    .limit(1);

  return {
    data: Array.isArray(data) ? data[0] ?? null : null,
    error,
  };
}

async function loadReportsForRange(
  userId: string,
  startDate: string,
  endDate: string
) {
  return supabase
    .from("daily_reports")
    .select("*")
    .eq("user_id", userId)
    .gte("report_date", startDate)
    .lte("report_date", endDate)
    .order("report_date", { ascending: true });
}

export default function DashboardPage() {
  const router = useRouter();
  const now = new Date();
  const todayString = toDateString(now);
  const dashboardHomeLayoutSensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const [dashboardSection, setDashboardSection] = useState<DashboardSectionId>("home");

  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [dashboardHomeLayout, setDashboardHomeLayout] = useState<
    DashboardHomeLayoutItem[]
  >(DEFAULT_DASHBOARD_HOME_LAYOUT);
  const [dashboardHomeLayoutDraft, setDashboardHomeLayoutDraft] = useState<
    DashboardHomeLayoutItem[]
  >(DEFAULT_DASHBOARD_HOME_LAYOUT);
  const [dashboardHomeLayoutEditorOpen, setDashboardHomeLayoutEditorOpen] =
    useState(false);
  const [dashboardHomeLayoutDragLocked, setDashboardHomeLayoutDragLocked] =
    useState(false);
  const [dashboardHomeLayoutSaving, setDashboardHomeLayoutSaving] = useState(false);
  const [dashboardHomeLayoutAutoSavePending, setDashboardHomeLayoutAutoSavePending] =
    useState(false);
  const dashboardHomeLayoutDraftRef = useRef<DashboardHomeLayoutItem[]>(
    DEFAULT_DASHBOARD_HOME_LAYOUT
  );
  const dashboardHomeLayoutPersistedRef = useRef<DashboardHomeLayoutItem[]>(
    DEFAULT_DASHBOARD_HOME_LAYOUT
  );
  const dashboardHomeLayoutPendingLayoutRef = useRef<DashboardHomeLayoutItem[] | null>(
    null
  );
  const dashboardHomeLayoutAutoSaveTimeoutRef = useRef<number | null>(null);
  const dashboardHomeLayoutSaveInFlightRef = useRef(false);

  const [periodAnchor, setPeriodAnchor] = useState<Date>(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );

  const [settings, setSettings] = useState<DriverSettings>({
    driver_name: "",
    phone_number: "",
    unit_price: "",
    settlement_start_day: "26",
    settlement_start_month_offset: "-1",
    settlement_end_day: "25",
    settlement_end_month_offset: "0",
    off_days: [],
    biweekly_off_days: [],
    biweekly_anchor_date: "",
  });

  const [reports, setReports] = useState<DailyReportRow[]>([]);
  const [quickEntryDate, setQuickEntryDate] = useState(todayString);
  const [selectedDate, setSelectedDate] = useState(todayString);
  const [reportListScrollDate, setReportListScrollDate] = useState<string | null>(null);
  const [reportForm, setReportForm] = useState<ReportForm>(
    createEmptyReportForm(todayString)
  );
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const quickEntryDateRef = useRef(quickEntryDate);
  const workSummarySectionRef = useRef<HTMLElement | null>(null);
  const quickEntryCardRef = useRef<HTMLElement | null>(null);
  const statCardsSectionRef = useRef<HTMLElement | null>(null);
  const dailySalesListSectionRef = useRef<HTMLElement | null>(null);
  const reportListSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    quickEntryDateRef.current = quickEntryDate;
  }, [quickEntryDate]);

  useEffect(() => {
    dashboardHomeLayoutDraftRef.current = dashboardHomeLayoutDraft;
  }, [dashboardHomeLayoutDraft]);

  useEffect(() => {
    dashboardHomeLayoutPersistedRef.current = dashboardHomeLayout;
  }, [dashboardHomeLayout]);

  useEffect(() => {
    return () => {
      if (dashboardHomeLayoutAutoSaveTimeoutRef.current !== null) {
        window.clearTimeout(dashboardHomeLayoutAutoSaveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const pendingToast = consumePendingToast();

    if (!pendingToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(createToastState(pendingToast));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const showToast = (tone: ToastState["tone"], title: string, message?: string) => {
    setToast(createToastState({ tone, title, message }));
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const applyDashboardSection = (nextSection: DashboardSectionId) => {
      setDashboardSection(nextSection);
      setReportListScrollDate(null);
    };

    const storedSection = window.sessionStorage.getItem(DASHBOARD_SECTION_STORAGE_KEY);

    if (isDashboardSectionId(storedSection)) {
      applyDashboardSection(storedSection);
      window.sessionStorage.removeItem(DASHBOARD_SECTION_STORAGE_KEY);
    }

    const handleDashboardSectionEvent = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;

      if (!isDashboardSectionId(detail)) {
        return;
      }

      applyDashboardSection(detail);
    };

    window.addEventListener(DASHBOARD_SECTION_EVENT, handleDashboardSectionEvent);

    return () => {
      window.removeEventListener(DASHBOARD_SECTION_EVENT, handleDashboardSectionEvent);
    };
  }, []);

  const isHomeDashboardSection = dashboardSection === "home";
  const visibleDashboardHomeLayout = dashboardHomeLayout.filter((item) => item.visible);
  const visibleDashboardHomeLayoutDraft = dashboardHomeLayoutDraft.filter(
    (item) => item.visible
  );
  const activeHomeDashboardLayout = visibleDashboardHomeLayoutDraft;
  const activeHomeDashboardLayoutIds = activeHomeDashboardLayout.map((item) => item.id);
  const dashboardHomeLayoutEditorItems = useMemo(
    () =>
      [...dashboardHomeLayoutDraft].sort((leftItem, rightItem) =>
        DASHBOARD_HOME_LAYOUT_LABELS[leftItem.id].localeCompare(
          DASHBOARD_HOME_LAYOUT_LABELS[rightItem.id],
          "ko"
        )
      ),
    [dashboardHomeLayoutDraft]
  );
  const isQuickEntryVisibleOnHome = visibleDashboardHomeLayout.some(
    (item) => item.id === "today-quick-card"
  );
  const isDailySalesListVisibleOnHome = visibleDashboardHomeLayout.some(
    (item) => item.id === "daily-sales-list"
  );
  const isCalendarVisibleOnHome = visibleDashboardHomeLayout.some(
    (item) => item.id === "work-calendar"
  );
  const showSummaryStrip = dashboardSection === "work-summary";
  const showQuickEntrySection =
    dashboardSection === "today-quick-card" ||
    (isHomeDashboardSection && isQuickEntryVisibleOnHome);
  const showStatsSection = dashboardSection === "stats";
  const showDailySalesListSection =
    dashboardSection === "daily-sales-list" ||
    (isHomeDashboardSection && isDailySalesListVisibleOnHome);
  const showCalendarSection =
    dashboardSection === "work-calendar" ||
    (isHomeDashboardSection && isCalendarVisibleOnHome);

  useEffect(() => {
    if (dashboardSection !== "work-summary") return;

    const animationFrameId = window.requestAnimationFrame(() => {
      workSummarySectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [dashboardSection]);

  useEffect(() => {
    if (dashboardSection !== "today-quick-card") return;

    const animationFrameId = window.requestAnimationFrame(() => {
      quickEntryCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [dashboardSection]);

  useEffect(() => {
    if (dashboardSection !== "stats") return;

    const animationFrameId = window.requestAnimationFrame(() => {
      statCardsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [dashboardSection]);

  useEffect(() => {
    if (dashboardSection !== "daily-sales-list") return;

    const animationFrameId = window.requestAnimationFrame(() => {
      dailySalesListSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [dashboardSection]);

  useEffect(() => {
    if (dashboardSection !== "work-calendar" || reportListScrollDate) return;

    const animationFrameId = window.requestAnimationFrame(() => {
      reportListSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [dashboardSection, reportListScrollDate]);

  useEffect(() => {
    if (!showCalendarSection || !reportListScrollDate || reportsLoading) return;

    const animationFrameId = window.requestAnimationFrame(() => {
      const targetCard = document.querySelector<HTMLElement>(
        `[data-report-date="${reportListScrollDate}"]`
      );

      if (!targetCard) {
        return;
      }

      targetCard.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      setReportListScrollDate(null);
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [showCalendarSection, reportListScrollDate, reportsLoading, reports]);

  const defaultUnitPrice = Number(settings.unit_price || 0);

  const settlementRange = useMemo(() => {
    return getSettlementRange(
      periodAnchor,
      Number(settings.settlement_start_day || 1),
      Number(settings.settlement_start_month_offset || 0),
      Number(settings.settlement_end_day || 31),
      Number(settings.settlement_end_month_offset || 0)
    );
  }, [periodAnchor, settings]);

  const periodDates = useMemo(() => {
    return eachDateBetween(settlementRange.start, settlementRange.end);
  }, [settlementRange]);

  const reportsMap = useMemo(() => {
    const map = new Map<string, DailyReportRow>();
    reports.forEach((report) => map.set(report.report_date, report));
    return map;
  }, [reports]);

  const settlementStartKey = toDateString(settlementRange.start);
  const settlementEndKey = toDateString(settlementRange.end);
  const periodMonthLabel = `${periodAnchor.getFullYear()}년 ${periodAnchor.getMonth() + 1}월`;
  const todayCalendarLabel = formatDashboardDateLabel(now);
  const activeQuickEntryDate = getDateWithinRange(
    quickEntryDate,
    settlementStartKey,
    settlementEndKey,
    todayString
  );

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      const profileSeed = extractDriverProfileSeed(user);
      const nextDashboardHomeLayout = readDashboardHomeLayout(user);
      setUser({
        id: user.id,
        email: user.email,
        driver_name: profileSeed.driverName,
        phone_number: profileSeed.phoneNumber,
      });
      setDashboardHomeLayout(nextDashboardHomeLayout);
      setDashboardHomeLayoutDraft(nextDashboardHomeLayout);

      setSettings((prev) => ({
        ...prev,
        driver_name: profileSeed.driverName || prev.driver_name,
        phone_number: profileSeed.phoneNumber || prev.phone_number,
      }));

      setLoading(false);
    };

    init();
  }, [router]);

  useEffect(() => {
    if (user) {
      const loadSettings = async () => {
        const { data, error } = await loadDriverSettings(user.id);

        if (error) {
          showToast(
            "error",
            "기본설정 불러오기 실패",
            getKoreanErrorMessage(error.message, "기본설정을 불러오지 못했습니다.")
          );
          return;
        }

        if (!data) {
          return;
        }

        setSettings({
          driver_name: data.driver_name ?? user.driver_name ?? "",
          phone_number: data.phone_number ?? user.phone_number ?? "",
          unit_price: data.unit_price ? String(data.unit_price) : "",
          settlement_start_day: data.settlement_start_day
            ? String(data.settlement_start_day)
            : "26",
          settlement_start_month_offset:
            data.settlement_start_month_offset !== null &&
            data.settlement_start_month_offset !== undefined
              ? String(data.settlement_start_month_offset)
              : "-1",
          settlement_end_day: data.settlement_end_day
            ? String(data.settlement_end_day)
            : "25",
          settlement_end_month_offset:
            data.settlement_end_month_offset !== null &&
            data.settlement_end_month_offset !== undefined
              ? String(data.settlement_end_month_offset)
              : "0",
          off_days: Array.isArray(data.off_days) ? data.off_days : [],
          biweekly_off_days: Array.isArray(data.biweekly_off_days)
            ? data.biweekly_off_days
            : [],
          biweekly_anchor_date: data.biweekly_anchor_date ?? "",
        });
      };

      void loadSettings();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const loadReports = async () => {
        setReportsLoading(true);

        const { data, error } = await loadReportsForRange(
          user.id,
          settlementStartKey,
          settlementEndKey
        );

        setReportsLoading(false);

        if (error) {
          showToast(
            "error",
            "리포트 불러오기 실패",
            getKoreanErrorMessage(error.message, "리포트를 불러오지 못했습니다.")
          );
          return;
        }

        const rows = (data as DailyReportRow[]) ?? [];
        const nextQuickEntryDate = getDateWithinRange(
          quickEntryDateRef.current,
          settlementStartKey,
          settlementEndKey,
          todayString
        );

        setQuickEntryDate(nextQuickEntryDate);
        setReports(rows);
        setReportForm(getReportFormForDate(rows, nextQuickEntryDate));
      };

      void loadReports();
    }
  }, [user, settlementEndKey, settlementStartKey, todayString]);

  const refreshReports = async (nextDateKey = activeQuickEntryDate) => {
    if (!user) return;

    setReportsLoading(true);

    const { data, error } = await loadReportsForRange(
      user.id,
      settlementStartKey,
      settlementEndKey
    );

    setReportsLoading(false);

    if (error) {
      showToast(
        "error",
        "리포트 불러오기 실패",
        getKoreanErrorMessage(error.message, "리포트를 불러오지 못했습니다.")
      );
      return;
    }

    const rows = (data as DailyReportRow[]) ?? [];
    const nextQuickEntryDate = getDateWithinRange(
      nextDateKey,
      settlementStartKey,
      settlementEndKey,
      todayString
    );

    setQuickEntryDate(nextQuickEntryDate);
    setReports(rows);
    setReportForm(getReportFormForDate(rows, nextQuickEntryDate));
  };

  const handleReportChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setReportForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleQuickEntryDateChange = (dateKey: string) => {
    if (!dateKey) return;

    const nextQuickEntryDate = getDateWithinRange(
      dateKey,
      settlementStartKey,
      settlementEndKey,
      todayString
    );

    setQuickEntryDate(nextQuickEntryDate);
    setReportForm(getReportFormForDate(reports, nextQuickEntryDate));
  };

  const openReportModal = (dateKey: string) => {
    const nextQuickEntryDate = getDateWithinRange(
      dateKey,
      settlementStartKey,
      settlementEndKey,
      todayString
    );

    setSelectedDate(nextQuickEntryDate);
    setIsReportModalOpen(true);

    const existing = reportsMap.get(nextQuickEntryDate);

    if (existing) {
      const parsedMemo = parseStoredMemo(existing.memo);
      const additionalWorkMetrics = getAdditionalWorkMetrics(
        parsedMemo.additionalWorks,
        parsedMemo.includeCanceledInSales
      );

      setReportForm({
        report_date: existing.report_date,
        delivered_count: String(
          Math.max((existing.delivered_count ?? 0) - additionalWorkMetrics.deliveredCount, 0)
        ),
        returned_count: String(
          Math.max((existing.returned_count ?? 0) - additionalWorkMetrics.returnedCount, 0)
        ),
        canceled_count: String(
          Math.max((existing.canceled_count ?? 0) - additionalWorkMetrics.canceledCount, 0)
        ),
        include_canceled_in_sales: parsedMemo.includeCanceledInSales,
        memo: parsedMemo.memo,
        is_day_off: Boolean(existing.is_day_off),
        unit_price_override: existing.unit_price_override
          ? String(existing.unit_price_override)
          : "",
        additional_works: parsedMemo.additionalWorks,
        freshback_recovery_items: ensureFreshbackRecoveryItems(
          parsedMemo.freshbackRecoveryItems
        ),
        expense_items: ensureExpenseItems(parsedMemo.expenseItems),
      });
    } else {
      setReportForm(createEmptyReportForm(nextQuickEntryDate));
    }
  };

  const closeReportModal = () => {
    setIsReportModalOpen(false);
    setReportForm(getReportFormForDate(reports, activeQuickEntryDate));
  };

  const saveReportInternal = async (form: ReportForm) => {
    if (!user) return false;

    const additionalWorks = form.additional_works ?? [];
    const sanitizedAdditionalWorks = additionalWorks.filter(hasAdditionalWorkValues);
    const freshbackRecovery = form.is_day_off
      ? []
      : form.freshback_recovery_items ?? [];
    const sanitizedExpenseItems = (form.is_day_off ? [] : form.expense_items ?? []).filter(
      hasExpenseItemValues
    );
    const additionalWorkMetrics = form.is_day_off
      ? {
          deliveredCount: 0,
          returnedCount: 0,
          canceledCount: 0,
          sales: 0,
        }
      : getAdditionalWorkMetrics(
          sanitizedAdditionalWorks,
          form.include_canceled_in_sales
        );

    const hasStandardWorkInput =
      !form.is_day_off &&
      (form.delivered_count !== "" ||
        form.returned_count !== "" ||
        form.canceled_count !== "");

    if (!settings.unit_price && hasStandardWorkInput && !form.unit_price_override) {
      showToast(
        "error",
        "기본 단가가 필요합니다",
        "먼저 기본설정에서 배송 단가를 입력해주세요."
      );
      return false;
    }

    const isEmptyReport =
      !form.is_day_off &&
      form.delivered_count === "" &&
      form.returned_count === "" &&
      form.canceled_count === "" &&
      form.memo.trim() === "" &&
      form.unit_price_override === "" &&
      sanitizedAdditionalWorks.length === 0 &&
      !hasFreshbackRecoveryValues(form.freshback_recovery_items ?? []) &&
      sanitizedExpenseItems.length === 0;

    if (isEmptyReport) {
      const { error } = await supabase
        .from("daily_reports")
        .delete()
        .eq("user_id", user.id)
        .eq("report_date", form.report_date);

      if (error) {
        showToast(
          "error",
          "미입력 처리 실패",
          getKoreanErrorMessage(error.message, "미입력 처리 중 문제가 발생했습니다.")
        );
        return false;
      }

      return true;
    }

    const appliedUnitPrice = form.unit_price_override
      ? Number(form.unit_price_override)
      : defaultUnitPrice;

    const deliveredCount = form.is_day_off ? 0 : Number(form.delivered_count || 0);
    const returnedCount = form.is_day_off ? 0 : Number(form.returned_count || 0);
    const canceledCount = form.is_day_off ? 0 : Number(form.canceled_count || 0);
    const storedMemo = buildStoredMemo(
      form.memo,
      form.is_day_off ? [] : sanitizedAdditionalWorks,
      form.include_canceled_in_sales,
      freshbackRecovery,
      sanitizedExpenseItems
    );
    const payload = {
      user_id: user.id,
      report_date: form.report_date,
      delivered_count: deliveredCount + additionalWorkMetrics.deliveredCount,
      returned_count: returnedCount + additionalWorkMetrics.returnedCount,
      canceled_count: canceledCount + additionalWorkMetrics.canceledCount,
      memo: storedMemo,
      daily_sales: form.is_day_off
        ? 0
        : getDailySales(
            deliveredCount,
            returnedCount,
            canceledCount,
            form.include_canceled_in_sales,
            appliedUnitPrice
          ) +
          additionalWorkMetrics.sales +
          getFreshbackRecoverySales(freshbackRecovery),
      is_day_off: form.is_day_off,
      unit_price_override: form.unit_price_override
        ? Number(form.unit_price_override)
        : null,
    };

    const { error } = await supabase
      .from("daily_reports")
      .upsert(payload, { onConflict: "user_id,report_date" });

    if (error) {
      showToast(
        "error",
        "저장 실패",
        getKoreanErrorMessage(error.message, "저장 중 문제가 발생했습니다.")
      );
      return false;
    }

    return true;
  };

  const saveTodayQuick = async () => {
    setSaving(true);
    const ok = await saveReportInternal(reportForm);
    setSaving(false);

    if (!ok) return;

    const savedDateKey = activeQuickEntryDate;

    showToast("success", "리포트 저장 완료", `${savedDateKey} 내용을 저장했습니다.`);
    await refreshReports(savedDateKey);

    if (dashboardSection === "work-calendar" || isCalendarVisibleOnHome) {
      setReportListScrollDate(savedDateKey);
    } else {
      setReportListScrollDate(null);
    }
  };

  const saveModalReport = async () => {
    setSaving(true);
    const ok = await saveReportInternal(reportForm);
    setSaving(false);

    if (!ok) return;

    const savedDateKey = reportForm.report_date;

    showToast("success", "저장 완료", `${reportForm.report_date} 내용을 반영했습니다.`);
    setIsReportModalOpen(false);
    await refreshReports(activeQuickEntryDate);

    if (dashboardSection === "work-calendar" || isCalendarVisibleOnHome) {
      setReportListScrollDate(savedDateKey);
    }
  };

  const clearDashboardHomeLayoutAutoSaveTimer = () => {
    if (dashboardHomeLayoutAutoSaveTimeoutRef.current !== null) {
      window.clearTimeout(dashboardHomeLayoutAutoSaveTimeoutRef.current);
      dashboardHomeLayoutAutoSaveTimeoutRef.current = null;
    }
  };

  const persistDashboardHomeLayout = async () => {
    if (dashboardHomeLayoutSaveInFlightRef.current) {
      return;
    }

    dashboardHomeLayoutSaveInFlightRef.current = true;
    setDashboardHomeLayoutSaving(true);

    while (dashboardHomeLayoutPendingLayoutRef.current) {
      const nextLayout = normalizeDashboardHomeLayout(
        dashboardHomeLayoutPendingLayoutRef.current
      );
      dashboardHomeLayoutPendingLayoutRef.current = null;

      const {
        data: { user: currentUser },
        error: readUserError,
      } = await supabase.auth.getUser();

      if (readUserError || !currentUser) {
        const persistedLayout = dashboardHomeLayoutPersistedRef.current;

        dashboardHomeLayoutSaveInFlightRef.current = false;
        setDashboardHomeLayoutSaving(false);
        setDashboardHomeLayoutAutoSavePending(false);
        dashboardHomeLayoutDraftRef.current = persistedLayout;
        setDashboardHomeLayoutDraft(persistedLayout);
        showToast(
          "error",
          "홈 구성 저장 실패",
          getKoreanErrorMessage(
            readUserError?.message,
            "세션을 확인한 뒤 다시 시도해주세요."
          )
        );
        return;
      }

      const { error } = await supabase.auth.updateUser({
        data: {
          ...(currentUser.user_metadata ?? {}),
          dashboard_home_layout: nextLayout,
        },
      });

      if (error) {
        const persistedLayout = dashboardHomeLayoutPersistedRef.current;

        dashboardHomeLayoutSaveInFlightRef.current = false;
        setDashboardHomeLayoutSaving(false);
        setDashboardHomeLayoutAutoSavePending(false);
        dashboardHomeLayoutDraftRef.current = persistedLayout;
        setDashboardHomeLayoutDraft(persistedLayout);
        showToast(
          "error",
          "홈 구성 저장 실패",
          getKoreanErrorMessage(error.message, "홈 구성을 저장하지 못했습니다.")
        );
        return;
      }

  dashboardHomeLayoutPersistedRef.current = nextLayout;
  dashboardHomeLayoutDraftRef.current = nextLayout;
      setDashboardHomeLayout(nextLayout);
      setDashboardHomeLayoutDraft(nextLayout);

      if (!nextLayout.some((item) => item.id === "work-calendar" && item.visible)) {
        setReportListScrollDate(null);
      }
    }

    dashboardHomeLayoutSaveInFlightRef.current = false;
    setDashboardHomeLayoutSaving(false);
    setDashboardHomeLayoutAutoSavePending(false);
  };

  const scheduleDashboardHomeLayoutAutoSave = (
    nextLayout: DashboardHomeLayoutItem[]
  ) => {
    const normalizedNextLayout = normalizeDashboardHomeLayout(nextLayout);

    dashboardHomeLayoutDraftRef.current = normalizedNextLayout;
    setDashboardHomeLayoutDraft(normalizedNextLayout);
    dashboardHomeLayoutPendingLayoutRef.current = normalizedNextLayout;
    setDashboardHomeLayoutAutoSavePending(true);

    clearDashboardHomeLayoutAutoSaveTimer();

    dashboardHomeLayoutAutoSaveTimeoutRef.current = window.setTimeout(() => {
      clearDashboardHomeLayoutAutoSaveTimer();
      void persistDashboardHomeLayout();
    }, 180);
  };

  const handleDashboardHomeLayoutVisibilityToggle = (
    sectionId: DashboardHomeLayoutSectionId
  ) => {
    const nextLayout = dashboardHomeLayoutDraftRef.current.map((item) =>
      item.id === sectionId ? { ...item, visible: !item.visible } : item
    );

    scheduleDashboardHomeLayoutAutoSave(nextLayout);
  };

  const reorderVisibleDashboardHomeLayout = (
    layout: DashboardHomeLayoutItem[],
    activeId: DashboardHomeLayoutSectionId,
    overId: DashboardHomeLayoutSectionId
  ) => {
    const visibleItems = layout.filter((item) => item.visible);
    const activeVisibleIndex = visibleItems.findIndex((item) => item.id === activeId);
    const overVisibleIndex = visibleItems.findIndex((item) => item.id === overId);

    if (
      activeVisibleIndex < 0 ||
      overVisibleIndex < 0 ||
      activeVisibleIndex === overVisibleIndex
    ) {
      return layout;
    }

    const reorderedVisibleItems = arrayMove(
      visibleItems,
      activeVisibleIndex,
      overVisibleIndex
    );

    let reorderedVisibleIndex = 0;

    return layout.map((item) => {
      if (!item.visible) {
        return item;
      }

      const nextItem = reorderedVisibleItems[reorderedVisibleIndex];
      reorderedVisibleIndex += 1;
      return nextItem;
    });
  };

  const handleDashboardHomeLayoutDragEnd = ({ active, over }: DragEndEvent) => {
    if (dashboardHomeLayoutDragLocked) {
      return;
    }

    if (!over || active.id === over.id) {
      return;
    }

    const nextLayout = reorderVisibleDashboardHomeLayout(
      dashboardHomeLayoutDraftRef.current,
      active.id as DashboardHomeLayoutSectionId,
      over.id as DashboardHomeLayoutSectionId
    );

    if (nextLayout === dashboardHomeLayoutDraftRef.current) {
      return;
    }

    scheduleDashboardHomeLayoutAutoSave(nextLayout);
  };

  const summary = useMemo(() => {
    const periodData = periodDates.map((date) => {
      const key = toDateString(date);
      const report = reportsMap.get(key);
      const isWeeklyRegularOff = settings.off_days.includes(date.getDay());
      const isBiweeklyRegularOff = isBiweeklyOffDate(
        date,
        settings.biweekly_off_days,
        settings.biweekly_anchor_date
      );
      const dayStatus = getReportDayStatus({
        report,
        isWeeklyRegularOff,
        isBiweeklyRegularOff,
      });
      const isWorked = dayStatus === "worked";
      const isRegularOff = isRegularOffStatus(dayStatus);
      const isAdditionalOff = dayStatus === "additional-off";

      return {
        date,
        report,
        dayStatus,
        isRegularOff,
        isWorked,
        isAdditionalOff,
      };
    });

    const workedDays = periodData.filter((item) => item.isWorked).length;
    const additionalOffDays = periodData.filter((item) => item.isAdditionalOff).length;

    const totalQuantity = periodData.reduce((sum, item) => {
      if (!item.isWorked || !item.report) return sum;
      const parsedMemo = parseStoredMemo(item.report.memo);

      return sum + getBillableQuantity(
        item.report.delivered_count || 0,
        item.report.returned_count || 0,
        item.report.canceled_count || 0,
        parsedMemo.includeCanceledInSales
      );
    }, 0);

    const totalSales = periodData.reduce((sum, item) => {
      if (!item.isWorked || !item.report) return sum;
      return sum + (item.report.daily_sales || 0);
    }, 0);

    const avgQty = workedDays > 0 ? Math.round(totalQuantity / workedDays) : 0;
    const avgSales = workedDays > 0 ? Math.round(totalSales / workedDays) : 0;

    const totalPeriodDays = periodDates.length;
    const regularOffDays = periodData.filter((item) => item.isRegularOff).length;
    const adjustedPeriodDays = totalPeriodDays - regularOffDays;
    const remainingWorkDays = Math.max(
      adjustedPeriodDays - workedDays - additionalOffDays,
      0
    );
    const expectedSales = totalSales + avgSales * remainingWorkDays;
    const dailySalesList: DailySalesListItem[] = periodData
      .filter((item) => item.isWorked && item.report)
      .map((item) => {
        const parsedMemo = parseStoredMemo(item.report?.memo);
        const quantity = getBillableQuantity(
          item.report?.delivered_count || 0,
          item.report?.returned_count || 0,
          item.report?.canceled_count || 0,
          parsedMemo.includeCanceledInSales
        );
        const expenseTotal = parsedMemo.expenseItems.reduce(
          (sum, expenseItem) => sum + Number(expenseItem.amount || 0),
          0
        );

        return {
          dateKey: item.report!.report_date,
          dateLabel: formatDashboardDateLabel(item.date),
          quantityLabel: `${quantity}건`,
          salesLabel: formatMoney(item.report?.daily_sales || 0),
          expenseLabel: expenseTotal > 0 ? `-${formatMoney(expenseTotal)}` : null,
        };
      });

    return {
      totalQuantity,
      avgQty,
      avgSales,
      totalSales,
      expectedSales,
      totalPeriodDays,
      regularOffDays,
      adjustedPeriodDays,
      workedDays,
      additionalOffDays,
      remainingWorkDays,
      dailySalesList,
    };
  }, [periodDates, reportsMap, settings]);

  if (loading) {
    return <PageLoadingShell message="불러오는 중..." />;
  }

  const dashboardHomeMetricCards: Partial<
    Record<DashboardHomeLayoutSectionId, DashboardHomeMetricCardData>
  > = {
    "work-summary-adjusted-period-days": {
      label: "이달 근무",
      value: `${summary.adjustedPeriodDays}일`,
      labelClassName: WORK_SUMMARY_ITEMS[0].labelClassName,
      valueClassName: WORK_SUMMARY_ITEMS[0].valueClassName,
    },
    "work-summary-worked-days": {
      label: "정상 근무",
      value: `${summary.workedDays}일`,
      labelClassName: WORK_SUMMARY_ITEMS[1].labelClassName,
      valueClassName: WORK_SUMMARY_ITEMS[1].valueClassName,
    },
    "work-summary-additional-off-days": {
      label: "추가 휴무",
      value: `${summary.additionalOffDays}일`,
      labelClassName: WORK_SUMMARY_ITEMS[2].labelClassName,
      valueClassName: WORK_SUMMARY_ITEMS[2].valueClassName,
    },
    "work-summary-remaining-work-days": {
      label: "남은 근무",
      value: `${summary.remainingWorkDays}일`,
      labelClassName: WORK_SUMMARY_ITEMS[3].labelClassName,
      valueClassName: WORK_SUMMARY_ITEMS[3].valueClassName,
    },
    [WORK_SUMMARY_OVERVIEW_ITEM_ID]: {
      label: "전체 기간 요약",
      value: `전체 ${summary.totalPeriodDays}일`,
      sub: `정기/격주휴무 ${summary.regularOffDays}일`,
    },
    "sales-stat-total-quantity": {
      label: "누적 건 수",
      value: `${summary.totalQuantity}건`,
    },
    "sales-stat-total-sales": {
      label: "누적 매출",
      value: formatMoney(summary.totalSales),
    },
    "sales-stat-avg-qty": {
      label: "평균 수량",
      value: `${summary.avgQty}건`,
    },
    "sales-stat-expected-sales": {
      label: "예상 매출",
      value: formatMoney(summary.expectedSales),
    },
    "sales-stat-avg-sales": {
      label: "평균 매출",
      value: formatMoney(summary.avgSales),
    },
  };

  const renderQuickEntrySection = (key: string, dragHandle?: ReactNode) => (
    <section key={key} ref={quickEntryCardRef} className="relative">
      {dragHandle ? (
        <div
          className="pointer-events-none z-10"
          style={{
            position: "absolute",
            top: "0.75rem",
            right: "3.25rem",
            bottom: "auto",
            left: "auto",
          }}
        >
          <div className="pointer-events-auto">{dragHandle}</div>
        </div>
      ) : null}

      <TodayQuickCard
        selectedDate={activeQuickEntryDate}
        minDate={settlementStartKey}
        maxDate={settlementEndKey}
        onDateChange={handleQuickEntryDateChange}
        reportForm={reportForm}
        setReportForm={setReportForm}
        defaultUnitPrice={defaultUnitPrice}
        handleReportChange={handleReportChange}
        onSave={saveTodayQuick}
        saving={saving}
      />
    </section>
  );

  const renderStatsSection = (key: string) => (
    <section key={key} ref={statCardsSectionRef}>
      <div className="retro-panel mb-3 rounded-[24px] px-3 py-3 sm:rounded-[28px] sm:px-4 sm:py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <button
            onClick={() => setPeriodAnchor(shiftSettlementAnchor(periodAnchor, -1))}
            className="retro-button min-h-[44px] w-full px-4 py-2.5 text-sm font-semibold sm:w-auto"
          >
            이전달
          </button>

          <p className="retro-title theme-heading text-center text-base leading-relaxed sm:text-lg">
            {periodMonthLabel} 매출 통계
          </p>

          <button
            onClick={() => setPeriodAnchor(shiftSettlementAnchor(periodAnchor, 1))}
            className="retro-button min-h-[44px] w-full px-4 py-2.5 text-sm font-semibold sm:w-auto"
          >
            다음달
          </button>
        </div>
      </div>

      <StatCards
        totalQuantity={summary.totalQuantity}
        avgQty={summary.avgQty}
        avgSales={formatMoney(summary.avgSales)}
        totalSales={formatMoney(summary.totalSales)}
        expectedSales={formatMoney(summary.expectedSales)}
      />
    </section>
  );

  const renderWeatherSection = (key: string, dragHandle?: ReactNode) => (
    <section key={key} className="relative">
      {dragHandle ? (
        <div
          className="pointer-events-none z-10"
          style={{
            position: "absolute",
            top: "0.75rem",
            right: "0.75rem",
            bottom: "auto",
            left: "auto",
          }}
        >
          <div className="pointer-events-auto">{dragHandle}</div>
        </div>
      ) : null}

      <WeatherCard />
    </section>
  );

  const renderDashboardHomeMetricCardSection = (
    key: string,
    sectionId: DashboardHomeLayoutSectionId,
    dragHandle?: ReactNode
  ) => {
    const metricCard = dashboardHomeMetricCards[sectionId];

    if (!metricCard) {
      return null;
    }

    return (
      <section key={key} className="w-full max-w-full">
        <div className="theme-note-box relative flex aspect-square w-full flex-col rounded-[17px] px-2 py-2 sm:px-2.5 sm:py-2.5">
          {dragHandle ? (
            <div
              className="z-10 scale-[0.72] origin-top-right sm:scale-[0.8]"
              style={{
                position: "absolute",
                top: "0.25rem",
                right: "0.25rem",
                bottom: "auto",
                left: "auto",
              }}
            >
              {dragHandle}
            </div>
          ) : null}

          <div className="flex h-full flex-col items-center justify-between gap-1 text-center">
            <p
              className={`retro-title text-xs ${
                metricCard.labelClassName ?? "theme-heading"
              } w-full px-5 text-[10px] leading-snug sm:text-[11px]`}
            >
              {metricCard.label}
            </p>

            <div className="w-full space-y-0.5 text-center">
              <p
                className={`text-[clamp(0.88rem,3.7vw,1.1rem)] font-bold leading-[1.05] tracking-tight ${
                  metricCard.valueClassName ?? "theme-heading"
                }`}
              >
                {metricCard.value}
              </p>
              {metricCard.sub ? (
                <p className="theme-copy text-[8px] leading-snug sm:text-[9px]">
                  {metricCard.sub}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderDailySalesListSection = (key: string, dragHandle?: ReactNode) => (
    <section key={key} ref={dailySalesListSectionRef} className="relative">
      {dragHandle ? (
        <div
          className="pointer-events-none z-10"
          style={{
            position: "absolute",
            top: "0.75rem",
            right: "0.75rem",
            bottom: "auto",
            left: "auto",
          }}
        >
          <div className="pointer-events-auto">{dragHandle}</div>
        </div>
      ) : null}

      <div className="retro-panel rounded-[24px] px-4 py-5 sm:rounded-[28px] sm:px-5 sm:py-5">
        <div className="flex items-start gap-3 pr-12 sm:pr-14">
          <div className="space-y-1">
            <p className="retro-title theme-heading text-base sm:text-lg">
              일별 총 매출
            </p>
            <p className="theme-copy text-sm leading-relaxed">
              업무 캘린더에 저장된 날짜별 총 매출을 세로로 나열했습니다.
            </p>
          </div>
        </div>

        {summary.dailySalesList.length > 0 ? (
          <div className="mt-4 space-y-2">
            {summary.dailySalesList.map((item) => (
              <button
                type="button"
                key={item.dateKey}
                onClick={() => openReportModal(item.dateKey)}
                className="theme-note-box flex w-full flex-col items-start gap-3 rounded-[20px] px-4 py-3 text-left transition active:scale-[0.99] hover:-translate-y-px sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="theme-copy text-sm leading-relaxed sm:text-base">
                    {item.dateLabel}
                  </p>
                </div>
                <p className="theme-copy text-sm leading-relaxed sm:shrink-0 sm:text-base">
                  {item.quantityLabel}
                </p>
                <div className="flex w-full items-center justify-between gap-4 text-right sm:w-auto sm:shrink-0 sm:gap-5">
                  <p className="theme-heading whitespace-nowrap text-base font-semibold sm:text-lg">
                    {item.salesLabel}
                  </p>
                  {item.expenseLabel ? (
                    <p className="whitespace-nowrap text-sm font-semibold leading-none text-[rgba(248,113,113,0.96)] sm:text-base">
                      {item.expenseLabel}
                    </p>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="theme-note-box mt-4 rounded-[20px] px-4 py-4 text-sm leading-relaxed">
            아직 저장된 일별 매출 데이터가 없습니다.
          </div>
        )}
      </div>
    </section>
  );

  const renderCalendarSection = (key: string, dragHandle?: ReactNode) => (
    <section key={key} ref={reportListSectionRef} className="relative">
      {dragHandle ? (
        <div
          className="pointer-events-none z-10"
          style={{
            position: "absolute",
            top: "0.75rem",
            right: "3.25rem",
            bottom: "auto",
            left: "auto",
          }}
        >
          <div className="pointer-events-auto">{dragHandle}</div>
        </div>
      ) : null}

      <div className="retro-panel mb-3 rounded-[24px] px-3 py-3 sm:rounded-[28px] sm:px-4 sm:py-4">
        <div className="flex items-center gap-2 pr-12 sm:gap-3 sm:pr-14">
          <button
            type="button"
            onClick={() => setPeriodAnchor(shiftSettlementAnchor(periodAnchor, -1))}
            aria-label="이전달 보기"
            className="retro-button flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] px-0 py-0 text-lg font-semibold"
          >
            <span aria-hidden="true">&lt;</span>
          </button>

          <div className="min-w-0 flex-1 text-center">
            <p className="retro-title theme-heading text-base leading-none sm:text-lg">
              {periodMonthLabel}
            </p>
            <p className="theme-copy mt-1 text-[11px] leading-none sm:text-xs">
              오늘 {todayCalendarLabel}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setPeriodAnchor(shiftSettlementAnchor(periodAnchor, 1))}
            aria-label="다음달 보기"
            className="retro-button flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] px-0 py-0 text-lg font-semibold"
          >
            <span aria-hidden="true">&gt;</span>
          </button>
        </div>
      </div>

      {reportsLoading ? (
        <div className="retro-panel rounded-[24px] p-8 text-center sm:rounded-[28px] sm:p-10">
          달력 불러오는 중...
        </div>
      ) : (
        <ReportList
          dates={periodDates}
          reportsMap={reportsMap}
          weeklyOffDays={settings.off_days}
          biweeklyOffDays={settings.biweekly_off_days}
          biweeklyAnchorDate={settings.biweekly_anchor_date}
          onDateClick={openReportModal}
          todayString={todayString}
        />
      )}
    </section>
  );

  const renderHomeDashboardSection = (
    item: DashboardHomeLayoutItem,
    dragHandle?: ReactNode
  ) => {
    const metricCardSection = renderDashboardHomeMetricCardSection(
      `home-${item.id}`,
      item.id,
      dragHandle
    );

    if (metricCardSection) {
      return metricCardSection;
    }

    switch (item.id) {
      case "today-quick-card":
        return renderQuickEntrySection(`home-${item.id}`, dragHandle);
            case "weather-card":
              return renderWeatherSection(`home-${item.id}`, dragHandle);
      case "daily-sales-list":
        return renderDailySalesListSection(`home-${item.id}`, dragHandle);
      case "work-calendar":
        return renderCalendarSection(`home-${item.id}`, dragHandle);
      default:
        return null;
    }
  };

  return (
    <PageShell contentClassName="flex w-full min-w-0 max-w-[34rem] flex-col gap-3 sm:max-w-2xl sm:gap-4 xl:max-w-5xl">
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} />
      <div className="flex w-full flex-col gap-3 sm:gap-4">
        {showSummaryStrip ? (
          <section ref={workSummarySectionRef} className="w-full">
            <div className="retro-panel rounded-[24px] px-4 py-5 sm:rounded-[28px] sm:px-5 sm:py-5">
              <div className="space-y-1">
                <p className="retro-title theme-heading text-base sm:text-lg">근무 통계</p>
                <p className="theme-copy text-sm leading-relaxed">
                  이달 근무, 정상 근무, 추가 휴무, 남은 근무 현황을 한 번에 확인합니다.
                </p>
              </div>

              <WorkSummaryStrip
                adjustedPeriodDays={summary.adjustedPeriodDays}
                totalPeriodDays={summary.totalPeriodDays}
                regularOffDays={summary.regularOffDays}
                workedDays={summary.workedDays}
                additionalOffDays={summary.additionalOffDays}
                remainingWorkDays={summary.remainingWorkDays}
              />
            </div>
          </section>
        ) : null}

        {isHomeDashboardSection ? (
          <section className="retro-panel rounded-[22px] px-3 py-3 sm:rounded-[24px] sm:px-4 sm:py-3">
            <div className="flex flex-col gap-3 sm:grid sm:min-h-[34px] sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div aria-hidden="true" className="hidden sm:block" />

              <div className="flex min-w-0 flex-wrap items-center justify-center gap-2.5 text-center">
                <p className="retro-title theme-heading text-sm sm:text-base">
                  홈 화면 편집
                </p>
                {dashboardHomeLayoutSaving || dashboardHomeLayoutAutoSavePending ? (
                  <span className="theme-copy text-xs leading-none">저장 중</span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-self-end">
                <button
                  type="button"
                  onClick={() =>
                    setDashboardHomeLayoutDragLocked((currentValue) => !currentValue)
                  }
                  className="retro-button min-h-[34px] px-3 py-1.5 text-xs font-semibold"
                >
                  {dashboardHomeLayoutDragLocked
                    ? "잠금 해제"
                    : "드래그 잠금"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDashboardHomeLayoutEditorOpen((currentValue) => !currentValue)
                  }
                  className="retro-button flex min-h-[34px] min-w-[56px] items-center justify-center rounded-[12px] px-2.5 py-1.5 text-xs font-semibold"
                  aria-expanded={dashboardHomeLayoutEditorOpen}
                >
                  {dashboardHomeLayoutEditorOpen ? "닫기" : "열기"}
                </button>
              </div>
            </div>

            {dashboardHomeLayoutEditorOpen ? (
              <div className="mt-2.5 space-y-2.5">
                <div className="max-h-[14rem] overflow-y-auto pr-1">
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {dashboardHomeLayoutEditorItems.map((item) => (
                      <DashboardHomeLayoutEditorItem
                        key={item.id}
                        item={item}
                        label={DASHBOARD_HOME_LAYOUT_LABELS[item.id]}
                        onToggleVisible={() => handleDashboardHomeLayoutVisibilityToggle(item.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {isHomeDashboardSection ? (
          activeHomeDashboardLayout.length > 0 ? (
            <DndContext
              sensors={dashboardHomeLayoutSensors}
              collisionDetection={dashboardHomeLayoutCollisionDetection}
              onDragEnd={handleDashboardHomeLayoutDragEnd}
            >
              <SortableContext
                items={activeHomeDashboardLayoutIds}
                strategy={rectSortingStrategy}
              >
                <div className="flex flex-wrap items-start gap-3 sm:gap-4">
                  {activeHomeDashboardLayout.map((item) => (
                    <DashboardHomeSortableSection
                      key={item.id}
                      itemId={item.id}
                      label={DASHBOARD_HOME_LAYOUT_LABELS[item.id]}
                      dragLocked={dashboardHomeLayoutDragLocked}
                      compact={isDashboardHomeMetricCardId(item.id)}
                      renderSection={(dragHandle) =>
                        renderHomeDashboardSection(item, dragHandle)
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="theme-note-box rounded-[20px] px-4 py-4 text-sm leading-relaxed">
              현재 홈에 표시되는 기능이 없습니다. 편집에서 원하는 기능을 다시 켜주세요.
            </div>
          )
        ) : null}

        {!isHomeDashboardSection && showQuickEntrySection
          ? renderQuickEntrySection("standalone-today-quick-card")
          : null}
        {!isHomeDashboardSection && showStatsSection
          ? renderStatsSection("standalone-stats")
          : null}
        {!isHomeDashboardSection && showDailySalesListSection
          ? renderDailySalesListSection("standalone-daily-sales-list")
          : null}
        {!isHomeDashboardSection && showCalendarSection
          ? renderCalendarSection("standalone-work-calendar")
          : null}
      </div>

      <ReportModal
        open={isReportModalOpen}
        selectedDate={selectedDate}
        reportForm={reportForm}
        setReportForm={setReportForm}
        defaultUnitPrice={defaultUnitPrice}
        handleReportChange={handleReportChange}
        onClose={closeReportModal}
        onSave={saveModalReport}
        saving={saving}
      />
    </PageShell>
  );
}