"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { extractDriverProfileSeed } from "../../lib/driverSettings";
import { formatMoney, toDateString } from "../../lib/format";
import { isAdminUser } from "../../lib/admin";
import {
  createToastState,
  getKoreanErrorMessage,
  queuePendingToast,
  ToastState,
} from "../../lib/toast";
import type {
  AdminDriverSettingsRow,
  AdminOverviewResponse,
  DailyReportRow,
  UserType,
} from "../../types";
import ToastViewport from "../../components/ui/ToastViewport";

type AdminDriverSummary = {
  user_id: string;
  driver_name: string;
  phone_number: string;
  unit_price: number | null;
  reportCount: number;
  totalSales: number;
  deliveredCount: number;
  returnedCount: number;
  canceledCount: number;
  lastReportDate: string | null;
};

function createDefaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return toDateString(date);
}

function getDriverDisplayName(
  driver?: Partial<AdminDriverSettingsRow> | null,
  userId?: string
) {
  const driverName = driver?.driver_name?.trim();

  if (driverName) {
    return driverName;
  }

  if (userId) {
    return `기사 ${userId.slice(0, 8)}`;
  }

  return "이름 미등록";
}

function getDriverPhoneNumber(driver?: Partial<AdminDriverSettingsRow> | null) {
  const phoneNumber = driver?.phone_number?.trim();
  return phoneNumber || "연락처 미등록";
}

function getReportStatusLabel(report: DailyReportRow) {
  return report.is_day_off ? "추가휴무" : "근무";
}

type AdminOverviewRequestResult = {
  data: AdminOverviewResponse | null;
  error: string | null;
  status: number;
};

async function loadAdminOverview(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<AdminOverviewRequestResult> {
  try {
    const searchParams = new URLSearchParams({
      startDate,
      endDate,
    });
    const response = await fetch(`/api/admin/overview?${searchParams.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    const payload = (await response
      .json()
      .catch(() => null)) as (AdminOverviewResponse & { error?: string }) | { error?: string } | null;

    if (!response.ok) {
      return {
        data: null,
        error:
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "관리자 데이터를 불러오지 못했습니다.",
        status: response.status,
      };
    }

    return {
      data: payload as AdminOverviewResponse,
      error: null,
      status: response.status,
    };
  } catch (error) {
    return {
      data: null,
      error: getKoreanErrorMessage(
        error instanceof Error ? error.message : undefined,
        "관리자 데이터를 불러오지 못했습니다."
      ),
      status: 0,
    };
  }
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [driverSettingsRows, setDriverSettingsRows] = useState<AdminDriverSettingsRow[]>([]);
  const [reports, setReports] = useState<DailyReportRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [draftStartDate, setDraftStartDate] = useState(createDefaultStartDate());
  const [draftEndDate, setDraftEndDate] = useState(toDateString(new Date()));
  const [appliedStartDate, setAppliedStartDate] = useState(createDefaultStartDate());
  const [appliedEndDate, setAppliedEndDate] = useState(toDateString(new Date()));
  const [refreshKey, setRefreshKey] = useState(0);

  const showToast = (tone: ToastState["tone"], title: string, message?: string) => {
    setToast(createToastState({ tone, title, message }));
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        queuePendingToast({
          tone: "error",
          title: "로그인이 필요합니다",
          message: "관리자 페이지는 로그인한 계정만 접근할 수 있습니다.",
        });
        router.replace("/");
        return;
      }

      if (!isAdminUser(user)) {
        queuePendingToast({
          tone: "error",
          title: "관리자 권한이 없습니다",
          message: "권한이 있는 계정만 관리자 페이지에 접근할 수 있습니다.",
        });
        router.replace("/dashboard");
        return;
      }

      const profileSeed = extractDriverProfileSeed(user);

      setUser({
        id: user.id,
        email: user.email,
        driver_name: profileSeed.driverName,
        phone_number: profileSeed.phoneNumber,
      });
      setLoading(false);
    };

    void init();
  }, [router]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let isDisposed = false;

    const loadAdminData = async () => {
      setDataLoading(true);
      setDataError(null);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (isDisposed) {
        return;
      }

      if (sessionError || !session?.access_token) {
        const fallbackMessage = "관리자 세션을 확인할 수 없습니다. 다시 로그인해주세요.";

        setDataLoading(false);
        setDriverSettingsRows([]);
        setReports([]);
        setDataError(fallbackMessage);
        showToast("error", "관리자 데이터 불러오기 실패", fallbackMessage);
        return;
      }

      const overviewResult = await loadAdminOverview(
        session.access_token,
        appliedStartDate,
        appliedEndDate
      );

      if (isDisposed) {
        return;
      }

      if (overviewResult.status === 401) {
        setDataLoading(false);
        queuePendingToast({
          tone: "error",
          title: "로그인이 필요합니다",
          message: overviewResult.error || "다시 로그인한 뒤 관리자 페이지를 이용해주세요.",
        });
        router.replace("/");
        return;
      }

      if (overviewResult.status === 403) {
        setDataLoading(false);
        queuePendingToast({
          tone: "error",
          title: "관리자 권한이 없습니다",
          message:
            overviewResult.error || "권한이 있는 계정만 관리자 페이지에 접근할 수 있습니다.",
        });
        router.replace("/dashboard");
        return;
      }

      setDataLoading(false);

      if (overviewResult.data) {
        setDriverSettingsRows(overviewResult.data.driverSettingsRows ?? []);
        setReports(overviewResult.data.reports ?? []);
      }

      if (overviewResult.error) {
        setDriverSettingsRows([]);
        setReports([]);
        setDataError(overviewResult.error);
        showToast("error", "관리자 데이터 불러오기 실패", overviewResult.error);
      }
    };

    void loadAdminData();

    return () => {
      isDisposed = true;
    };
  }, [user, appliedStartDate, appliedEndDate, refreshKey, router]);

  const driverMap = useMemo(() => {
    const map = new Map<string, AdminDriverSettingsRow>();

    driverSettingsRows.forEach((row) => {
      map.set(row.user_id, row);
    });

    return map;
  }, [driverSettingsRows]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      if (selectedDriverId && report.user_id !== selectedDriverId) {
        return false;
      }

      if (!normalizedSearchTerm) {
        return true;
      }

      const driver = driverMap.get(report.user_id);

      return [
        getDriverDisplayName(driver, report.user_id),
        getDriverPhoneNumber(driver),
        report.user_id,
        report.report_date,
      ].some((value) => value.toLowerCase().includes(normalizedSearchTerm));
    });
  }, [reports, selectedDriverId, normalizedSearchTerm, driverMap]);

  const driverSummaries = useMemo(() => {
    const summaryMap = new Map<string, AdminDriverSummary>();

    const ensureSummary = (userId: string) => {
      if (!summaryMap.has(userId)) {
        const driver = driverMap.get(userId);

        summaryMap.set(userId, {
          user_id: userId,
          driver_name: getDriverDisplayName(driver, userId),
          phone_number: getDriverPhoneNumber(driver),
          unit_price: driver?.unit_price ?? null,
          reportCount: 0,
          totalSales: 0,
          deliveredCount: 0,
          returnedCount: 0,
          canceledCount: 0,
          lastReportDate: null,
        });
      }

      return summaryMap.get(userId)!;
    };

    driverSettingsRows.forEach((row) => {
      ensureSummary(row.user_id);
    });

    filteredReports.forEach((report) => {
      const summary = ensureSummary(report.user_id);

      summary.reportCount += 1;
      summary.totalSales += report.daily_sales || 0;
      summary.deliveredCount += report.delivered_count || 0;
      summary.returnedCount += report.returned_count || 0;
      summary.canceledCount += report.canceled_count || 0;

      if (!summary.lastReportDate || report.report_date > summary.lastReportDate) {
        summary.lastReportDate = report.report_date;
      }
    });

    return Array.from(summaryMap.values())
      .filter((summary) => {
        if (!normalizedSearchTerm) {
          return true;
        }

        return [summary.driver_name, summary.phone_number, summary.user_id].some((value) =>
          value.toLowerCase().includes(normalizedSearchTerm)
        );
      })
      .sort((left, right) => {
        if (right.totalSales !== left.totalSales) {
          return right.totalSales - left.totalSales;
        }

        return (right.lastReportDate || "").localeCompare(left.lastReportDate || "");
      });
  }, [driverMap, driverSettingsRows, filteredReports, normalizedSearchTerm]);

  const selectedDriverSummary = useMemo(() => {
    if (!selectedDriverId) {
      return null;
    }

    return driverSummaries.find((summary) => summary.user_id === selectedDriverId) ?? null;
  }, [driverSummaries, selectedDriverId]);

  const summary = useMemo(() => {
    const totalSales = filteredReports.reduce((sum, report) => sum + (report.daily_sales || 0), 0);
    const deliveredCount = filteredReports.reduce(
      (sum, report) => sum + (report.delivered_count || 0),
      0
    );
    const additionalOffCount = filteredReports.filter((report) => report.is_day_off).length;

    return {
      driverCount: driverSummaries.length,
      activeDriverCount: driverSummaries.filter((summary) => summary.reportCount > 0).length,
      reportCount: filteredReports.length,
      totalSales,
      deliveredCount,
      additionalOffCount,
    };
  }, [driverSummaries, filteredReports]);

  const visibleReports = useMemo(() => filteredReports.slice(0, 24), [filteredReports]);

  const applyDateRange = () => {
    if (draftStartDate > draftEndDate) {
      showToast(
        "error",
        "조회 기간을 확인해주세요",
        "조회 시작일이 종료일보다 늦을 수 없습니다."
      );
      return;
    }

    setAppliedStartDate(draftStartDate);
    setAppliedEndDate(draftEndDate);
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

    queuePendingToast({
      tone: "info",
      title: "로그아웃 완료",
      message: "관리자 페이지에서 로그아웃했습니다.",
    });
    router.replace("/");
  };

  if (loading) {
    return (
      <main className="retro-scanlines retro-grid-bg min-h-[100dvh] bg-[var(--bg)] px-3 py-4 text-[var(--text)] sm:px-4 sm:py-6">
        <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-[28rem] items-center justify-center sm:min-h-[calc(100vh-3rem)]">
          <div className="retro-panel w-full rounded-[28px] px-6 py-5 text-center">
            관리자 페이지 확인 중...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="retro-scanlines retro-grid-bg min-h-[100dvh] bg-[var(--bg)] px-3 py-4 text-[var(--text)] sm:px-4 sm:py-6">
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} />

      <div className="mx-auto flex w-full max-w-[34rem] flex-col gap-4 sm:max-w-2xl lg:max-w-5xl">
        <section className="retro-panel rounded-[24px] px-4 py-5 sm:rounded-[28px] sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="theme-kicker text-[11px] sm:text-xs">ADMIN ONLY</p>
              <h1 className="retro-title theme-heading mt-2 text-xl sm:text-2xl">
                관리자 페이지
              </h1>
              <p className="theme-copy mt-3 text-sm leading-relaxed">
                기사 현황과 최근 리포트를 조회하고, 운영 상태를 빠르게 확인할 수 있습니다.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="retro-button min-h-[40px] px-4 py-2 text-sm font-semibold"
              >
                대시보드
              </button>
              <button
                type="button"
                onClick={signOut}
                className="retro-button-solid min-h-[40px] px-4 py-2 text-sm font-semibold"
              >
                로그아웃
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto_auto]">
            <div className="space-y-2">
              <label className="theme-label block text-sm font-semibold">조회 시작일</label>
              <input
                type="date"
                value={draftStartDate}
                onChange={(event) => setDraftStartDate(event.target.value)}
                className="px-4 py-3 text-center"
                style={{ width: "100%" }}
              />
            </div>

            <div className="space-y-2">
              <label className="theme-label block text-sm font-semibold">조회 종료일</label>
              <input
                type="date"
                value={draftEndDate}
                onChange={(event) => setDraftEndDate(event.target.value)}
                className="px-4 py-3 text-center"
                style={{ width: "100%" }}
              />
            </div>

            <div className="space-y-2 xl:col-span-1">
              <label className="theme-label block text-sm font-semibold">기사 검색</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="이름, 연락처, 사용자 ID"
                className="px-4 py-3 text-left"
                style={{ width: "100%" }}
              />
            </div>

            <button
              type="button"
              onClick={applyDateRange}
              className="retro-button min-h-[46px] px-4 py-3 text-sm font-semibold xl:self-end"
            >
              기간 적용
            </button>

            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              className="retro-button min-h-[46px] px-4 py-3 text-sm font-semibold xl:self-end"
            >
              새로고침
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="theme-chip-subtle px-3 py-1.5">
              조회 기간: {appliedStartDate} ~ {appliedEndDate}
            </span>
            <span className="theme-chip-subtle px-3 py-1.5">
              접속 관리자: {user?.driver_name || user?.email || "관리자"}
            </span>
            {selectedDriverSummary ? (
              <button
                type="button"
                onClick={() => setSelectedDriverId(null)}
                className="retro-button min-h-[34px] px-3 py-1.5 text-xs font-semibold"
              >
                선택 기사 해제
              </button>
            ) : null}
          </div>

          {dataError ? (
            <div className="theme-note-box mt-4 rounded-[20px] px-4 py-3 text-sm leading-relaxed">
              {dataError}
            </div>
          ) : null}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="retro-card rounded-[22px] px-4 py-4 sm:px-5 sm:py-5">
            <p className="theme-kicker text-[11px] sm:text-xs">기사 수</p>
            <p className="retro-title theme-heading mt-2 text-2xl">{summary.driverCount}명</p>
            <p className="theme-copy mt-3 text-sm leading-relaxed">
              조회 조건에 포함된 기사 수입니다.
            </p>
          </article>

          <article className="retro-card rounded-[22px] px-4 py-4 sm:px-5 sm:py-5">
            <p className="theme-kicker text-[11px] sm:text-xs">활성 기사</p>
            <p className="retro-title theme-heading mt-2 text-2xl">
              {summary.activeDriverCount}명
            </p>
            <p className="theme-copy mt-3 text-sm leading-relaxed">
              선택 기간 내 리포트가 있는 기사 수입니다.
            </p>
          </article>

          <article className="retro-card rounded-[22px] px-4 py-4 sm:px-5 sm:py-5">
            <p className="theme-kicker text-[11px] sm:text-xs">리포트 / 추가휴무</p>
            <p className="retro-title theme-heading mt-2 text-2xl">
              {summary.reportCount} / {summary.additionalOffCount}
            </p>
            <p className="theme-copy mt-3 text-sm leading-relaxed">
              저장된 리포트 수와 추가휴무 처리 건수입니다.
            </p>
          </article>

          <article className="retro-card rounded-[22px] px-4 py-4 sm:px-5 sm:py-5">
            <p className="theme-kicker text-[11px] sm:text-xs">배송 / 매출</p>
            <p className="retro-title theme-heading mt-2 text-2xl">
              {summary.deliveredCount.toLocaleString()}건
            </p>
            <p className="theme-copy mt-3 text-sm leading-relaxed">
              누적 매출 {formatMoney(summary.totalSales)}
            </p>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="retro-panel rounded-[24px] px-4 py-5 sm:rounded-[28px] sm:px-6 sm:py-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="theme-kicker text-[11px] sm:text-xs">기사 목록</p>
                <h2 className="retro-title theme-heading mt-2 text-lg sm:text-xl">
                  기사별 운영 현황
                </h2>
              </div>
              <span className="theme-chip-subtle px-3 py-1.5 text-xs sm:text-sm">
                {driverSummaries.length}명
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {dataLoading ? (
                <div className="theme-note-box rounded-[20px] px-4 py-4 text-sm text-center">
                  관리자 데이터를 불러오는 중...
                </div>
              ) : driverSummaries.length === 0 ? (
                <div className="theme-note-box rounded-[20px] px-4 py-4 text-sm text-center">
                  조회된 기사 정보가 없습니다.
                </div>
              ) : (
                driverSummaries.map((summaryItem) => {
                  const isSelected = selectedDriverId === summaryItem.user_id;

                  return (
                    <button
                      key={summaryItem.user_id}
                      type="button"
                      onClick={() =>
                        setSelectedDriverId((current) =>
                          current === summaryItem.user_id ? null : summaryItem.user_id
                        )
                      }
                      className="retro-card block w-full rounded-[22px] px-4 py-4 text-left transition"
                      style={{
                        borderColor: isSelected
                          ? "rgba(255,255,255,0.28)"
                          : "rgba(255,255,255,0.12)",
                        background: isSelected
                          ? "linear-gradient(180deg, rgba(40, 40, 46, 0.98), rgba(18, 18, 21, 0.98))"
                          : undefined,
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="retro-title theme-heading text-base sm:text-lg">
                            {summaryItem.driver_name}
                          </p>
                          <p className="theme-copy mt-2 text-sm leading-relaxed">
                            {summaryItem.phone_number}
                          </p>
                          <p className="theme-copy mt-1 text-xs leading-relaxed">
                            사용자 ID: {summaryItem.user_id}
                          </p>
                        </div>

                        <span className="theme-chip-subtle px-3 py-1.5 text-xs sm:text-sm">
                          {summaryItem.reportCount}건
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        <div className="theme-note-box rounded-[16px] px-3 py-2 text-center">
                          배송 {summaryItem.deliveredCount.toLocaleString()}
                        </div>
                        <div className="theme-note-box rounded-[16px] px-3 py-2 text-center">
                          반품 {summaryItem.returnedCount.toLocaleString()}
                        </div>
                        <div className="theme-note-box rounded-[16px] px-3 py-2 text-center">
                          취소 {summaryItem.canceledCount.toLocaleString()}
                        </div>
                        <div className="theme-note-box rounded-[16px] px-3 py-2 text-center">
                          단가 {summaryItem.unit_price ? formatMoney(summaryItem.unit_price) : "미설정"}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="theme-copy">
                          최근 리포트: {summaryItem.lastReportDate || "없음"}
                        </span>
                        <span className="theme-heading font-semibold">
                          {formatMoney(summaryItem.totalSales)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="retro-panel rounded-[24px] px-4 py-5 sm:rounded-[28px] sm:px-6 sm:py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="theme-kicker text-[11px] sm:text-xs">최근 리포트</p>
                <h2 className="retro-title theme-heading mt-2 text-lg sm:text-xl">
                  {selectedDriverSummary
                    ? `${selectedDriverSummary.driver_name} 기사 리포트`
                    : "전체 기사 리포트"}
                </h2>
              </div>

              <span className="theme-chip-subtle px-3 py-1.5 text-xs sm:text-sm">
                최대 24건 표시
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {dataLoading ? (
                <div className="theme-note-box rounded-[20px] px-4 py-4 text-sm text-center">
                  리포트를 불러오는 중...
                </div>
              ) : visibleReports.length === 0 ? (
                <div className="theme-note-box rounded-[20px] px-4 py-4 text-sm text-center">
                  조회 조건에 맞는 리포트가 없습니다.
                </div>
              ) : (
                visibleReports.map((report) => {
                  const driver = driverMap.get(report.user_id);

                  return (
                    <article
                      key={`${report.user_id}-${report.report_date}`}
                      className="retro-card rounded-[22px] px-4 py-4 sm:px-5 sm:py-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="retro-title theme-heading text-base sm:text-lg">
                            {getDriverDisplayName(driver, report.user_id)}
                          </p>
                          <p className="theme-copy mt-2 text-sm leading-relaxed">
                            {report.report_date}
                          </p>
                        </div>

                        <span className="theme-chip-strong px-3 py-1.5 text-xs sm:text-sm">
                          {getReportStatusLabel(report)}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        <div className="theme-note-box rounded-[16px] px-3 py-2 text-center">
                          배송 {report.delivered_count.toLocaleString()}
                        </div>
                        <div className="theme-note-box rounded-[16px] px-3 py-2 text-center">
                          반품 {report.returned_count.toLocaleString()}
                        </div>
                        <div className="theme-note-box rounded-[16px] px-3 py-2 text-center">
                          취소 {report.canceled_count.toLocaleString()}
                        </div>
                        <div className="theme-note-box rounded-[16px] px-3 py-2 text-center">
                          매출 {formatMoney(report.daily_sales || 0)}
                        </div>
                      </div>

                      {report.memo?.trim() ? (
                        <p className="theme-copy mt-4 text-sm leading-relaxed">
                          특이사항: {report.memo.trim()}
                        </p>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}