"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { extractDriverProfileSeed } from "../../lib/driverSettings";
import { formatMoney, toDateString } from "../../lib/format";
import {
  eachDateBetween,
  getSettlementRange,
  shiftSettlementAnchor,
} from "../../lib/settlement";
import { isBiweeklyOffDate } from "../../lib/offday";
import { getReportDayStatus, isRegularOffStatus } from "../../lib/reportStatus";
import {
  DailyReportRow,
  DriverSettings,
  ReportForm,
  UserType,
} from "../../types";
import DashboardHeader from "../../components/dashboard/DashboardHeader";
import StatCards from "../../components/dashboard/StatCards";
import ReportModal from "../../components/dashboard/ReportModal";
import ReportList from "../../components/dashboard/ReportList";
import TodayQuickCard from "../../components/dashboard/TodayQuickCard";

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
  const cardSpacing = { marginRight: "24px" } as const;

  const values = {
    adjustedPeriodDays: `${props.adjustedPeriodDays}일`,
    workedDays: `${props.workedDays}일`,
    additionalOffDays: `${props.additionalOffDays}일`,
    remainingWorkDays: `${props.remainingWorkDays}일`,
  } as const;

  return (
    <section className="mx-auto w-fit max-w-full rounded-[24px] px-3 py-3 sm:rounded-[28px] sm:px-4 sm:py-4">
      <div className="flex flex-wrap items-start justify-center gap-3">
        {WORK_SUMMARY_ITEMS.map((item, index) => (
          <div
            key={item.label}
            className="retro-card w-fit shrink-0 rounded-[20px] p-4 text-center sm:rounded-[24px] sm:p-5"
            style={index < WORK_SUMMARY_ITEMS.length - 1 ? cardSpacing : undefined}
          >
            <p className={`retro-title text-sm leading-relaxed ${item.labelClassName}`}>
              {item.label}
            </p>
            <p className={`mt-3 text-2xl font-bold tracking-tight sm:text-[2rem] ${item.valueClassName}`}>
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

function createEmptyReportForm(dateKey: string): ReportForm {
  return {
    report_date: dateKey,
    delivered_count: "",
    returned_count: "",
    canceled_count: "",
    memo: "",
    is_day_off: false,
    unit_price_override: "",
  };
}

function getReportFormForDate(rows: DailyReportRow[], dateKey: string): ReportForm {
  const report = rows.find((item) => item.report_date === dateKey);

  if (!report) {
    return createEmptyReportForm(dateKey);
  }

  return {
    report_date: report.report_date,
    delivered_count: String(report.delivered_count ?? ""),
    returned_count: String(report.returned_count ?? ""),
    canceled_count: String(report.canceled_count ?? ""),
    memo: report.memo ?? "",
    is_day_off: Boolean(report.is_day_off),
    unit_price_override: report.unit_price_override
      ? String(report.unit_price_override)
      : "",
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
  return supabase.from("driver_settings").select("*").eq("user_id", userId).single();
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
  const [showReportList, setShowReportList] = useState(false);
  const [showStatCards, setShowStatCards] = useState(false);

  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
    if (!showStatCards) return;

    const animationFrameId = window.requestAnimationFrame(() => {
      statCardsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [showStatCards]);

  useEffect(() => {
    if (!showReportList || reportListScrollDate) return;

    const animationFrameId = window.requestAnimationFrame(() => {
      reportListSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [showReportList, reportListScrollDate]);

  useEffect(() => {
    if (!showReportList || !reportListScrollDate || reportsLoading) return;

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
  }, [showReportList, reportListScrollDate, reportsLoading, reports]);

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
          if (error.code !== "PGRST116") {
            alert("기본설정 불러오기 실패: " + error.message);
          }
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
          alert("리포트 불러오기 실패: " + error.message);
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
      alert("리포트 불러오기 실패: " + error.message);
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
      setReportForm({
        report_date: existing.report_date,
        delivered_count: String(existing.delivered_count ?? ""),
        returned_count: String(existing.returned_count ?? ""),
        canceled_count: String(existing.canceled_count ?? ""),
        memo: existing.memo ?? "",
        is_day_off: Boolean(existing.is_day_off),
        unit_price_override: existing.unit_price_override
          ? String(existing.unit_price_override)
          : "",
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

    if (!settings.unit_price) {
      alert("먼저 기본설정에서 배송 단가를 입력해주세요.");
      return false;
    }

    const isEmptyReport =
      !form.is_day_off &&
      form.delivered_count === "" &&
      form.returned_count === "" &&
      form.canceled_count === "" &&
      form.memo.trim() === "" &&
      form.unit_price_override === "";

    if (isEmptyReport) {
      const { error } = await supabase
        .from("daily_reports")
        .delete()
        .eq("user_id", user.id)
        .eq("report_date", form.report_date);

      if (error) {
        alert("미입력 처리 실패: " + error.message);
        return false;
      }

      return true;
    }

    const appliedUnitPrice = form.unit_price_override
      ? Number(form.unit_price_override)
      : defaultUnitPrice;

    const deliveredCount = form.is_day_off ? 0 : Number(form.delivered_count || 0);
    const returnedCount = form.is_day_off ? 0 : Number(form.returned_count || 0);
    const payload = {
      user_id: user.id,
      report_date: form.report_date,
      delivered_count: deliveredCount,
      returned_count: returnedCount,
      canceled_count: form.is_day_off ? 0 : Number(form.canceled_count || 0),
      memo: form.memo,
      daily_sales: form.is_day_off
        ? 0
        : getDailySales(deliveredCount, returnedCount, appliedUnitPrice),
      is_day_off: form.is_day_off,
      unit_price_override: form.unit_price_override
        ? Number(form.unit_price_override)
        : null,
    };

    const { error } = await supabase
      .from("daily_reports")
      .upsert(payload, { onConflict: "user_id,report_date" });

    if (error) {
      alert("저장 실패: " + error.message);
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

    alert("리포트 저장 완료");
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

    alert("저장 완료");
    setIsReportModalOpen(false);
    await refreshReports(activeQuickEntryDate);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message);
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
    return (
      <main className="retro-scanlines retro-grid-bg min-h-[100dvh] bg-[var(--bg)] px-3 py-4 text-[var(--text)] sm:px-4 sm:py-6">
        <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-[28rem] items-center justify-center sm:min-h-[calc(100vh-3rem)]">
          <div className="retro-panel w-full rounded-[28px] px-6 py-5 text-center">
            불러오는 중...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="retro-scanlines retro-grid-bg min-h-[100dvh] bg-[var(--bg)] px-3 py-4 text-[var(--text)] sm:px-4 sm:py-6">
      <div className="mx-auto flex w-full max-w-[34rem] flex-col gap-3 sm:gap-4 sm:max-w-2xl lg:max-w-4xl">
        <DashboardHeader
          driverName={settings.driver_name}
          email={user?.email}
          periodLabel={`${toDateString(settlementRange.start)} ~ ${toDateString(
            settlementRange.end
          )}`}
          onOpenSettings={() => router.push("/settings")}
          onLogout={signOut}
        />

        <WorkSummaryStrip
          adjustedPeriodDays={summary.adjustedPeriodDays}
          totalPeriodDays={summary.totalPeriodDays}
          regularOffDays={summary.regularOffDays}
          workedDays={summary.workedDays}
          additionalOffDays={summary.additionalOffDays}
          remainingWorkDays={summary.remainingWorkDays}
        />

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
        <div className="rounded-[24px] px-3 py-3 sm:rounded-[28px] sm:px-4 sm:py-4">
          <div className="grid grid-cols-2 gap-3">
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

        <section ref={statCardsSectionRef}>
          {showStatCards ? (
            <>
              <div className="retro-panel mb-3 rounded-[24px] px-3 py-3 sm:rounded-[28px] sm:px-4 sm:py-4">
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:flex sm:items-center sm:justify-between sm:gap-3">
                  <button
                    onClick={() => setPeriodAnchor(shiftSettlementAnchor(periodAnchor, -1))}
                    className="retro-button min-h-[44px] px-4 py-2.5 text-sm font-semibold"
                  >
                    이전달
                  </button>

                  <p className="retro-title theme-heading text-center text-base leading-relaxed sm:text-lg">
                    {periodMonthLabel} 통계
                  </p>

                  <button
                    onClick={() => setPeriodAnchor(shiftSettlementAnchor(periodAnchor, 1))}
                    className="retro-button min-h-[44px] px-4 py-2.5 text-sm font-semibold"
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
          {showReportList ? (
            <>
              <div className="retro-panel mb-3 rounded-[24px] px-3 py-3 sm:rounded-[28px] sm:px-4 sm:py-4">
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:flex sm:items-center sm:justify-between sm:gap-3">
                  <button
                    onClick={() => setPeriodAnchor(shiftSettlementAnchor(periodAnchor, -1))}
                    className="retro-button min-h-[44px] px-4 py-2.5 text-sm font-semibold"
                  >
                    이전달
                  </button>

                  <p className="retro-title theme-heading text-center text-[11px] leading-relaxed sm:text-sm">
                    {periodMonthLabel} 업무 캘린더
                  </p>

                  <button
                    onClick={() => setPeriodAnchor(shiftSettlementAnchor(periodAnchor, 1))}
                    className="retro-button min-h-[44px] px-4 py-2.5 text-sm font-semibold"
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
    </main>
  );
}