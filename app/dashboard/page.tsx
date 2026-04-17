"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { formatMoney, toDateString } from "../../lib/format";
import {
  eachDateBetween,
  getSettlementRange,
  shiftSettlementAnchor,
} from "../../lib/settlement";
import { isBiweeklyOffDate } from "../../lib/offday";
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
  const [selectedDate, setSelectedDate] = useState(todayString);
  const [reportForm, setReportForm] = useState<ReportForm>(
    createEmptyReportForm(todayString)
  );
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

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

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      setUser({
        id: user.id,
        email: user.email,
      });

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
          driver_name: data.driver_name ?? "",
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
        setReports(rows);
        setReportForm(getReportFormForDate(rows, todayString));
      };

      void loadReports();
    }
  }, [user, settlementEndKey, settlementStartKey, todayString]);

  const refreshReports = async () => {
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
    setReports(rows);
    setReportForm(getReportFormForDate(rows, todayString));
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

  const openReportModal = (dateKey: string) => {
    setSelectedDate(dateKey);

    const existing = reportsMap.get(dateKey);

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
      setReportForm(createEmptyReportForm(dateKey));
    }

    setIsReportModalOpen(true);
  };

  const closeReportModal = () => {
    setIsReportModalOpen(false);

    setReportForm(getReportFormForDate(reports, todayString));
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

    const payload = {
      user_id: user.id,
      report_date: form.report_date,
      delivered_count: deliveredCount,
      returned_count: form.is_day_off ? 0 : Number(form.returned_count || 0),
      canceled_count: form.is_day_off ? 0 : Number(form.canceled_count || 0),
      memo: form.memo,
      daily_sales: form.is_day_off ? 0 : deliveredCount * appliedUnitPrice,
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

    alert("오늘 리포트 저장 완료");
    await refreshReports();
  };

  const saveModalReport = async () => {
    setSaving(true);
    const ok = await saveReportInternal(reportForm);
    setSaving(false);

    if (!ok) return;

    alert("저장 완료");
    setIsReportModalOpen(false);
    await refreshReports();
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message);
      return;
    }

    router.replace("/");
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
      const isRegularOff = isWeeklyRegularOff || isBiweeklyRegularOff;

      const isWorked = Boolean(
        report &&
          !report.is_day_off &&
          (report.delivered_count > 0 ||
            report.returned_count > 0 ||
            report.canceled_count > 0 ||
            (report.memo && report.memo.trim() !== "") ||
            report.unit_price_override)
      );

      const isAdditionalOff = Boolean(
        report && report.is_day_off && !isRegularOff
      );

      return {
        date,
        report,
        isRegularOff,
        isWorked,
        isAdditionalOff,
      };
    });

    const workedDays = periodData.filter((item) => item.isWorked).length;
    const additionalOffDays = periodData.filter((item) => item.isAdditionalOff).length;

    const totalDelivered = periodData.reduce((sum, item) => {
      if (!item.isWorked || !item.report) return sum;
      return sum + (item.report.delivered_count || 0);
    }, 0);

    const totalSales = periodData.reduce((sum, item) => {
      if (!item.isWorked || !item.report) return sum;
      return sum + (item.report.daily_sales || 0);
    }, 0);

    const avgQty = workedDays > 0 ? Math.round(totalDelivered / workedDays) : 0;
    const avgSales = workedDays > 0 ? Math.round(totalSales / workedDays) : 0;

    const totalPeriodDays = periodDates.length;
    const regularOffDays = periodData.filter((item) => item.isRegularOff).length;
    const adjustedPeriodDays = totalPeriodDays - regularOffDays;
    const remainingWorkDays = Math.max(
      adjustedPeriodDays - workedDays - additionalOffDays,
      0
    );
    const expectedSales = avgSales * remainingWorkDays;

    return {
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

        <div className="retro-panel rounded-[24px] px-3 py-3 sm:rounded-[28px] sm:px-4 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="retro-title theme-heading text-center text-[11px] leading-relaxed sm:flex-1 sm:text-left sm:text-xs">
              {toDateString(settlementRange.start)} ~ {toDateString(settlementRange.end)}
            </h2>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:w-auto sm:gap-3">
              <button
                onClick={() => setPeriodAnchor(shiftSettlementAnchor(periodAnchor, -1))}
                className="retro-button ui-action-fit min-h-[44px] px-4 py-2.5 text-sm font-semibold"
              >
                이전달
              </button>

              <button
                onClick={() => setPeriodAnchor(shiftSettlementAnchor(periodAnchor, 1))}
                className="retro-button ui-action-fit min-h-[44px] px-4 py-2.5 text-sm font-semibold"
              >
                다음달
              </button>
            </div>
          </div>
        </div>

        <TodayQuickCard
          todayString={todayString}
          reportForm={reportForm}
          setReportForm={setReportForm}
          defaultUnitPrice={defaultUnitPrice}
          handleReportChange={handleReportChange}
          onSave={saveTodayQuick}
          saving={saving}
        />
        <div className="retro-panel rounded-[24px] px-3 py-3 sm:rounded-[28px] sm:px-4 sm:py-4">
          <button
            onClick={() => setShowStatCards((prev) => !prev)}
            className="retro-button-solid ui-action-fit px-5 py-3 text-sm font-semibold"
          >
            {showStatCards ? "통계 닫기" : "통계 보기"}
          </button>
        </div>

        {showStatCards ? (
          <StatCards
            avgQty={summary.avgQty}
            avgSales={formatMoney(summary.avgSales)}
            totalSales={formatMoney(summary.totalSales)}
            expectedSales={formatMoney(summary.expectedSales)}
            adjustedPeriodDays={summary.adjustedPeriodDays}
            totalPeriodDays={summary.totalPeriodDays}
            regularOffDays={summary.regularOffDays}
            workedDays={summary.workedDays}
            additionalOffDays={summary.additionalOffDays}
            remainingWorkDays={summary.remainingWorkDays}
          />
        ) : null}

        <div className="retro-panel rounded-[24px] px-3 py-3 sm:rounded-[28px] sm:px-4 sm:py-4">
          <button
            onClick={() => setShowReportList((prev) => !prev)}
            className="retro-button-solid ui-action-fit px-5 py-3 text-sm font-semibold"
          >
            {showReportList ? "리포트 리스트 닫기" : "리포트 리스트 보기"}
          </button>
        </div>

        {showReportList ? (
          reportsLoading ? (
            <div className="retro-panel rounded-[24px] p-8 text-center sm:rounded-[28px] sm:p-10">
              리스트 불러오는 중...
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
          )
        ) : null}
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