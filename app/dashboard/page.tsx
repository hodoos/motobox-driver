"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import {
  consumePendingToast,
  createToastState,
  getKoreanErrorMessage,
  ToastState,
} from "../../lib/toast";
import { isAdminUser } from "../../lib/admin";
import { extractDriverProfileSeed } from "../../lib/driverSettings";
import { formatMoney, toDateString } from "../../lib/format";
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
  ReportForm,
  UserType,
} from "../../types";
import StatCards from "../../components/dashboard/StatCards";
import ReportModal from "../../components/dashboard/ReportModal";
import ReportList from "../../components/dashboard/ReportList";
import TodayQuickCard from "../../components/dashboard/TodayQuickCard";
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

const WORK_SUMMARY_ITEMS = [
  {
    label: "이달 근무",
    valueKey: "adjustedPeriodDays",
    labelClassName: "text-[rgba(255,203,128,0.96)]",
    valueClassName: "text-[rgba(255,245,228,0.98)]",
  },
  {
    label: "정상 근무",
    valueKey: "workedDays",
    labelClassName: "text-[rgba(199,229,160,0.96)]",
    valueClassName: "text-[rgba(246,252,235,0.98)]",
  },
  {
    label: "추가 휴무",
    valueKey: "additionalOffDays",
    labelClassName: "text-[rgba(148,234,198,0.96)]",
    valueClassName: "text-[rgba(236,253,246,0.98)]",
  },
  {
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
        {WORK_SUMMARY_ITEMS.map((item, index) => (
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

type StoredAdditionalWorkItem = Omit<AdditionalWorkItemForm, "key">;

const LEGACY_ADDITIONAL_WORK_MEMO_MARKER =
  /\n?\[\[MOTOBOX_ADDITIONAL_WORK:([0-9]+(?:\.[0-9]+)?)\]\]$/;
const ADDITIONAL_WORKS_MEMO_MARKER = /\n?\[\[MOTOBOX_ADDITIONAL_WORKS:([\s\S]+)\]\]$/;

let additionalWorkKeySeed = 0;

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

function getAdditionalWorkMetrics(additionalWorks: AdditionalWorkItemForm[]) {
  return additionalWorks.reduce(
    (totals, item) => {
      const deliveredCount = Number(item.delivered_count || 0);
      const returnedCount = Number(item.returned_count || 0);
      const canceledCount = Number(item.canceled_count || 0);
      const unitPrice = Number(item.unit_price || 0);
      const workCount = deliveredCount + returnedCount;

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

function parseStoredMemo(rawMemo?: string | null) {
  if (!rawMemo) {
    return { memo: "", additionalWorks: [] as AdditionalWorkItemForm[] };
  }

  const worksMatch = rawMemo.match(ADDITIONAL_WORKS_MEMO_MARKER);

  if (worksMatch && typeof worksMatch.index === "number") {
    try {
      const decoded = decodeURIComponent(worksMatch[1] ?? "");
      const parsed = JSON.parse(decoded);

      if (Array.isArray(parsed)) {
        return {
          memo: rawMemo.slice(0, worksMatch.index).trimEnd(),
          additionalWorks: parsed.map((item) =>
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
          ),
        };
      }
    } catch {
      return { memo: rawMemo, additionalWorks: [] as AdditionalWorkItemForm[] };
    }
  }

  const legacyMatch = rawMemo.match(LEGACY_ADDITIONAL_WORK_MEMO_MARKER);

  if (legacyMatch && typeof legacyMatch.index === "number") {
    return {
      memo: rawMemo.slice(0, legacyMatch.index).trimEnd(),
      additionalWorks: [createAdditionalWorkItem({ unit_price: legacyMatch[1] ?? "" })],
    };
  }

  return { memo: rawMemo, additionalWorks: [] as AdditionalWorkItemForm[] };
}

function buildStoredMemo(memo: string, additionalWorks: AdditionalWorkItemForm[]) {
  const trimmedMemo = memo.trimEnd();
  const sanitizedAdditionalWorks = additionalWorks
    .filter(hasAdditionalWorkValues)
    .map(({ unit_price, delivered_count, returned_count, canceled_count }) => ({
      unit_price,
      delivered_count,
      returned_count,
      canceled_count,
    }));

  if (sanitizedAdditionalWorks.length === 0) {
    return trimmedMemo;
  }

  const marker = `[[MOTOBOX_ADDITIONAL_WORKS:${encodeURIComponent(
    JSON.stringify(sanitizedAdditionalWorks)
  )}]]`;

  return trimmedMemo ? `${trimmedMemo}\n${marker}` : marker;
}

function createEmptyReportForm(dateKey: string): ReportForm {
  return {
    report_date: dateKey,
    delivered_count: "",
    returned_count: "",
    canceled_count: "",
    memo: "",
    is_day_off: false,
    unit_price_override: "",
    additional_works: [],
  };
}

function getReportFormForDate(rows: DailyReportRow[], dateKey: string): ReportForm {
  const report = rows.find((item) => item.report_date === dateKey);

  if (!report) {
    return createEmptyReportForm(dateKey);
  }

  const parsedMemo = parseStoredMemo(report.memo);
  const additionalWorkMetrics = getAdditionalWorkMetrics(parsedMemo.additionalWorks);

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
    memo: parsedMemo.memo,
    is_day_off: Boolean(report.is_day_off),
    unit_price_override: report.unit_price_override
      ? String(report.unit_price_override)
      : "",
    additional_works: parsedMemo.additionalWorks,
  };
}

function getBillableQuantity(deliveredCount: number, returnedCount: number) {
  return deliveredCount + (returnedCount > 0 ? 1 : 0);
}

function getDailySales(
  deliveredCount: number,
  returnedCount: number,
  unitPrice: number
) {
  return (deliveredCount + returnedCount) * unitPrice;
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
  const [dashboardSection, setDashboardSection] = useState<DashboardSectionId>("home");
  const [showReportList, setShowReportList] = useState(false);
  const [showStatCards, setShowStatCards] = useState(false);

  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);

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
  const quickEntryCardRef = useRef<HTMLElement | null>(null);
  const statCardsSectionRef = useRef<HTMLElement | null>(null);
  const reportListSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    quickEntryDateRef.current = quickEntryDate;
  }, [quickEntryDate]);

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
      setShowStatCards(false);
      setShowReportList(false);
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
  const showSummaryStrip = isHomeDashboardSection;
  const showQuickEntrySection =
    isHomeDashboardSection || dashboardSection === "today-quick-card";
  const showDashboardActionButtons = isHomeDashboardSection;
  const showStatsSection = dashboardSection === "stats" || (isHomeDashboardSection && showStatCards);
  const showCalendarSection =
    dashboardSection === "work-calendar" || (isHomeDashboardSection && showReportList);

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
    if (!showStatsSection) return;

    const animationFrameId = window.requestAnimationFrame(() => {
      statCardsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [showStatsSection]);

  useEffect(() => {
    if (!showCalendarSection || reportListScrollDate) return;

    const animationFrameId = window.requestAnimationFrame(() => {
      reportListSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [showCalendarSection, reportListScrollDate]);

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
      setHasAdminAccess(isAdminUser(user));

      setUser({
        id: user.id,
        email: user.email,
        driver_name: profileSeed.driverName,
        phone_number: profileSeed.phoneNumber,
      });

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

    setQuickEntryDate(nextQuickEntryDate);
    setSelectedDate(nextQuickEntryDate);
    quickEntryCardRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    const existing = reportsMap.get(nextQuickEntryDate);

    if (existing) {
      const parsedMemo = parseStoredMemo(existing.memo);
      const additionalWorkMetrics = getAdditionalWorkMetrics(parsedMemo.additionalWorks);

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
        memo: parsedMemo.memo,
        is_day_off: Boolean(existing.is_day_off),
        unit_price_override: existing.unit_price_override
          ? String(existing.unit_price_override)
          : "",
        additional_works: parsedMemo.additionalWorks,
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
    const additionalWorkMetrics = form.is_day_off
      ? {
          deliveredCount: 0,
          returnedCount: 0,
          canceledCount: 0,
          sales: 0,
        }
      : getAdditionalWorkMetrics(sanitizedAdditionalWorks);

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
      sanitizedAdditionalWorks.length === 0;

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
      form.is_day_off ? [] : sanitizedAdditionalWorks
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
        : getDailySales(deliveredCount, returnedCount, appliedUnitPrice) +
          additionalWorkMetrics.sales,
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
    setShowStatCards(false);
    setShowReportList(true);
    setReportListScrollDate(savedDateKey);
  };

  const saveModalReport = async () => {
    setSaving(true);
    const ok = await saveReportInternal(reportForm);
    setSaving(false);

    if (!ok) return;

    showToast("success", "저장 완료", `${reportForm.report_date} 내용을 반영했습니다.`);
    setIsReportModalOpen(false);
    await refreshReports(activeQuickEntryDate);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      showToast(
        "error",
        "로그아웃 실패",
        getKoreanErrorMessage(error.message, "로그아웃 중 문제가 발생했습니다.")
      );
      return;
    }

    router.replace("/");
  };

  const toggleStatCards = () => {
    const nextShowStatCards = !showStatCards;

    setShowStatCards(nextShowStatCards);

    if (nextShowStatCards) {
      setShowReportList(false);
    }
  };

  const toggleReportList = () => {
    const nextShowReportList = !showReportList;

    setShowReportList(nextShowReportList);

    if (nextShowReportList) {
      setShowStatCards(false);
    }
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
      return sum + getBillableQuantity(
        item.report.delivered_count || 0,
        item.report.returned_count || 0
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
    };
  }, [periodDates, reportsMap, settings]);

  if (loading) {
    return <PageLoadingShell message="불러오는 중..." />;
  }

  return (
    <PageShell contentClassName="flex w-full max-w-[34rem] flex-col gap-3 sm:gap-4 sm:max-w-2xl lg:max-w-4xl">
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} />
      <div className="flex w-full flex-col gap-3 sm:gap-4">
        {showSummaryStrip ? (
          <WorkSummaryStrip
            adjustedPeriodDays={summary.adjustedPeriodDays}
            totalPeriodDays={summary.totalPeriodDays}
            regularOffDays={summary.regularOffDays}
            workedDays={summary.workedDays}
            additionalOffDays={summary.additionalOffDays}
            remainingWorkDays={summary.remainingWorkDays}
          />
        ) : null}

        {showQuickEntrySection ? (
          <section ref={quickEntryCardRef}>
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
        ) : null}
        {showDashboardActionButtons ? (
          <div className="rounded-[24px] px-3 py-3 sm:rounded-[28px] sm:px-4 sm:py-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
              <button
                onClick={toggleStatCards}
                className="retro-button-solid min-h-[48px] w-full px-4 py-3 text-sm font-semibold"
                style={{ marginTop: "12px", marginBottom: "12px" }}
              >
                {showStatCards ? "통계 닫기" : "통계 보기"}
              </button>

              <button
                onClick={toggleReportList}
                className="retro-button-solid min-h-[48px] w-full px-4 py-3 text-sm font-semibold"
                style={{ marginTop: "12px", marginBottom: "12px" }}
              >
                {showReportList ? "업무 캘린더 닫기" : "업무 캘린더"}
              </button>
            </div>
          </div>
        ) : null}

        <section ref={statCardsSectionRef}>
          {showStatsSection ? (
            <>
              <div className="retro-panel mb-3 rounded-[24px] px-3 py-3 sm:rounded-[28px] sm:px-4 sm:py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <button
                    onClick={() => setPeriodAnchor(shiftSettlementAnchor(periodAnchor, -1))}
                    className="retro-button min-h-[44px] w-full px-4 py-2.5 text-sm font-semibold sm:w-auto"
                  >
                    이전달
                  </button>

                  <p className="retro-title theme-heading text-center text-base leading-relaxed sm:text-lg">
                    {periodMonthLabel} 통계
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
            </>
          ) : null}
        </section>

        <section ref={reportListSectionRef}>
          {showCalendarSection ? (
            <>
              <div className="retro-panel mb-3 rounded-[24px] px-3 py-3 sm:rounded-[28px] sm:px-4 sm:py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <button
                    onClick={() => setPeriodAnchor(shiftSettlementAnchor(periodAnchor, -1))}
                    className="retro-button min-h-[44px] w-full px-4 py-2.5 text-sm font-semibold sm:w-auto"
                  >
                    이전달
                  </button>

                  <p className="retro-title theme-heading text-center text-base leading-relaxed sm:text-lg">
                    {periodMonthLabel} 업무 캘린더
                  </p>

                  <button
                    onClick={() => setPeriodAnchor(shiftSettlementAnchor(periodAnchor, 1))}
                    className="retro-button min-h-[44px] w-full px-4 py-2.5 text-sm font-semibold sm:w-auto"
                  >
                    다음달
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
            </>
          ) : null}
        </section>
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