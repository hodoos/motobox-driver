"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DailyReportRow, DriverSettings, ReportForm, UserType } from "@/types";
import { useRouter } from "next/navigation";
import { formatMoney, getKoreanDayLabel, toDateString } from "@/lib/format";
import {
  eachDateBetween,
  getSettlementRange,
  shiftSettlementAnchor,
} from "@/lib/settlement";
import { isBiweeklyOffDate } from "@/lib/offday";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import StatCards from "@/components/dashboard/StatCards";
import ReportModal from "@/components/dashboard/ReportModal";
import ReportList from "@/components/dashboard/ReportList";
import TodayQuickCard from "@/components/dashboard/TodayQuickCard";

export default function DashboardPage() {
  const router = useRouter();
  const now = new Date();
  const todayString = toDateString(now);

  const emptyReportForm = (dateKey: string): ReportForm => ({
    report_date: dateKey,
    delivered_count: "",
    returned_count: "",
    canceled_count: "",
    memo: "",
    is_day_off: false,
    unit_price_override: "",
  });

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
    emptyReportForm(todayString)
  );
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isBiweeklyPickMode, setIsBiweeklyPickMode] = useState(false);

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
    if (user) fetchSettings();
  }, [user]);

  useEffect(() => {
    if (user) fetchReports();
  }, [user, settlementRange.start.getTime(), settlementRange.end.getTime()]);

  const fetchSettings = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("driver_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

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

    const storedPickMode = localStorage.getItem("biweeklyPickMode");
    if (storedPickMode) {
      setIsBiweeklyPickMode(JSON.parse(storedPickMode));
      localStorage.removeItem("biweeklyPickMode");
    }
  };

  const fetchReports = async () => {
    if (!user) return;

    setReportsLoading(true);

    const { data, error } = await supabase
      .from("daily_reports")
      .select("*")
      .eq("user_id", user.id)
      .gte("report_date", toDateString(settlementRange.start))
      .lte("report_date", toDateString(settlementRange.end))
      .order("report_date", { ascending: true });

    setReportsLoading(false);

    if (error) {
      alert("리포트 불러오기 실패: " + error.message);
      return;
    }

    setReports((data as DailyReportRow[]) ?? []);

    const todayReport = (data as DailyReportRow[]).find(
      (item) => item.report_date === todayString
    );

    if (todayReport) {
      setReportForm({
        report_date: todayReport.report_date,
        delivered_count: String(todayReport.delivered_count ?? ""),
        returned_count: String(todayReport.returned_count ?? ""),
        canceled_count: String(todayReport.canceled_count ?? ""),
        memo: todayReport.memo ?? "",
        is_day_off: Boolean(todayReport.is_day_off),
        unit_price_override: todayReport.unit_price_override
          ? String(todayReport.unit_price_override)
          : "",
      });
    } else {
      setReportForm(emptyReportForm(todayString));
    }
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
    if (isBiweeklyPickMode) {
      const pickedDate = new Date(dateKey);
      const pickedDay = pickedDate.getDay();

      setSettings((prev) => ({
        ...prev,
        biweekly_anchor_date: dateKey,
        biweekly_off_days: [pickedDay],
      }));

      setIsBiweeklyPickMode(false);

      supabase
        .from("driver_settings")
        .upsert(
          {
            user_id: user?.id,
            driver_name: settings.driver_name,
            unit_price: settings.unit_price ? Number(settings.unit_price) : null,
            settlement_start_day: Number(settings.settlement_start_day || 1),
            settlement_start_month_offset: Number(
              settings.settlement_start_month_offset || 0
            ),
            settlement_end_day: Number(settings.settlement_end_day || 31),
            settlement_end_month_offset: Number(
              settings.settlement_end_month_offset || 0
            ),
            off_days: settings.off_days,
            biweekly_off_days: [pickedDay],
            biweekly_anchor_date: dateKey,
          },
          { onConflict: "user_id" }
        )
        .then(() => {
          alert(
            `격주휴무 기준일이 ${dateKey} (${getKoreanDayLabel(
              pickedDay
            )}요일)로 설정되었습니다.`
          );
        });

      return;
    }

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
      setReportForm(emptyReportForm(dateKey));
    }

    setIsReportModalOpen(true);
  };

  const closeReportModal = () => {
    setIsReportModalOpen(false);
    setReportForm(reportsMap.get(todayString)
      ? {
          report_date: reportsMap.get(todayString)!.report_date,
          delivered_count: String(reportsMap.get(todayString)!.delivered_count ?? ""),
          returned_count: String(reportsMap.get(todayString)!.returned_count ?? ""),
          canceled_count: String(reportsMap.get(todayString)!.canceled_count ?? ""),
          memo: reportsMap.get(todayString)!.memo ?? "",
          is_day_off: Boolean(reportsMap.get(todayString)!.is_day_off),
          unit_price_override: reportsMap.get(todayString)!.unit_price_override
            ? String(reportsMap.get(todayString)!.unit_price_override)
            : "",
        }
      : emptyReportForm(todayString)
    );
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
    await fetchReports();
  };

  const saveModalReport = async () => {
    setSaving(true);
    const ok = await saveReportInternal(reportForm);
    setSaving(false);

    if (!ok) return;

    alert("저장 완료");
    setIsReportModalOpen(false);
    await fetchReports();
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
      <main className="min-h-screen bg-[#f6f7fb] p-4 flex items-center justify-center text-black">
        <div className="rounded-[28px] border border-black/8 bg-white px-6 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
          불러오는 중...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] p-4 text-black md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <DashboardHeader
          driverName={settings.driver_name}
          email={user?.email}
          periodLabel={`${toDateString(settlementRange.start)} ~ ${toDateString(
            settlementRange.end
          )}`}
          onOpenSettings={() => router.push("/settings")}
          onLogout={signOut}
        />

        <div className="mb-4 flex items-center justify-between gap-3 rounded-[32px] border border-black/8 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)] md:p-5">
          <button
            onClick={() => setPeriodAnchor(shiftSettlementAnchor(periodAnchor, -1))}
            className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:border-black/20 hover:bg-black hover:text-white"
          >
            이전달
          </button>

          <h2 className="text-center text-lg font-bold tracking-tight md:text-2xl">
            {toDateString(settlementRange.start)} ~ {toDateString(settlementRange.end)}
          </h2>

          <button
            onClick={() => setPeriodAnchor(shiftSettlementAnchor(periodAnchor, 1))}
            className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:border-black/20 hover:bg-black hover:text-white"
          >
            다음달
          </button>
        </div>

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

        <TodayQuickCard
          todayString={todayString}
          reportForm={reportForm}
          setReportForm={setReportForm}
          defaultUnitPrice={defaultUnitPrice}
          handleReportChange={handleReportChange}
          onSave={saveTodayQuick}
          saving={saving}
        />

        {reportsLoading ? (
          <div className="rounded-[32px] border border-black/8 bg-white p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
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
            biweeklyPickMode={isBiweeklyPickMode}
          />
        )}
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