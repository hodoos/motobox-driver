"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import {
  canManageUserLevelChange,
  isAdminUser,
  isOperatorUser,
} from "../../lib/admin";
import {
  createToastState,
  getKoreanErrorMessage,
  queuePendingToast,
  ToastState,
} from "../../lib/toast";
import { USER_LEVEL_OPTIONS, type UserLevel } from "../../lib/userLevel";
import type {
  AdminManagedUserRow,
  AdminUserLevelUpdateResponse,
  AdminUsersResponse,
  StaffAuditLogResponse,
  StaffAuditLogRow,
} from "../../types";
import PageShell, { PageLoadingShell } from "../../components/layout/PageShell";
import ToastViewport from "../../components/ui/ToastViewport";

type AdminUsersRequestResult = {
  data: AdminUsersResponse | null;
  error: string | null;
  status: number;
};

type AdminUserLevelMutationRequestResult = {
  data: AdminUserLevelUpdateResponse | null;
  error: string | null;
  status: number;
};

type AuditLogsRequestResult = {
  data: StaffAuditLogResponse | null;
  error: string | null;
  status: number;
};

function getDriverDisplayName(driver?: Partial<AdminManagedUserRow> | null) {
  const driverName = driver?.driver_name?.trim();

  if (driverName) {
    return driverName;
  }

  return "이름 미등록";
}

function getDriverPhoneNumber(driver?: Partial<AdminManagedUserRow> | null) {
  const phoneNumber = driver?.phone_number?.trim();
  return phoneNumber || "연락처 미등록";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getAuditPersonDisplayName(name?: string | null, email?: string | null, userId?: string | null) {
  const trimmedName = name?.trim();

  if (trimmedName) {
    return trimmedName;
  }

  const trimmedEmail = email?.trim();

  if (trimmedEmail) {
    return trimmedEmail.split("@")[0] || trimmedEmail;
  }

  return userId?.trim() || "이름 없음";
}

function sortManagedUsers(rows: AdminManagedUserRow[]) {
  return [...rows].sort((left, right) => {
    const leftName = left.driver_name || left.email || left.user_id;
    const rightName = right.driver_name || right.email || right.user_id;
    const nameComparison = leftName.localeCompare(rightName, "ko");

    if (nameComparison !== 0) {
      return nameComparison;
    }

    return left.user_id.localeCompare(right.user_id);
  });
}

function buildUserLevelDrafts(rows: AdminManagedUserRow[]) {
  return rows.reduce<Record<string, UserLevel>>((drafts, row) => {
    drafts[row.user_id] = row.current_user_level;
    return drafts;
  }, {});
}

function getAvailableUserLevels(actor: User | null, row: AdminManagedUserRow) {
  const availableLevels = USER_LEVEL_OPTIONS.filter((level) =>
    canManageUserLevelChange(actor, row.current_user_level, level)
  );

  if (availableLevels.includes(row.current_user_level)) {
    return availableLevels;
  }

  return [
    row.current_user_level,
    ...availableLevels.filter((level) => level !== row.current_user_level),
  ];
}

function getUserLevelAccentClass(level: UserLevel) {
  switch (level) {
    case "운영자Lv":
      return "admin-sheet-select--operator";
    case "관리자Lv":
      return "admin-sheet-select--admin";
    case "Lv3-제휴":
      return "admin-sheet-select--affiliate";
    case "벤더Lv":
      return "admin-sheet-select--vendor";
    default:
      return "";
  }
}

function getUserLevelRowClass(level: UserLevel) {
  switch (level) {
    case "운영자Lv":
      return "admin-sheet-row--operator";
    case "관리자Lv":
      return "admin-sheet-row--admin";
    case "Lv3-제휴":
      return "admin-sheet-row--affiliate";
    case "벤더Lv":
      return "admin-sheet-row--vendor";
    default:
      return "";
  }
}

async function getSupabaseAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

async function loadAdminUsers(accessToken: string): Promise<AdminUsersRequestResult> {
  try {
    const response = await fetch("/api/admin/users", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | (AdminUsersResponse & { error?: string })
      | { error?: string }
      | null;

    if (!response.ok) {
      return {
        data: null,
        error:
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "관리자 사용자 목록을 불러오지 못했습니다.",
        status: response.status,
      };
    }

    return {
      data: payload as AdminUsersResponse,
      error: null,
      status: response.status,
    };
  } catch (error) {
    return {
      data: null,
      error: getKoreanErrorMessage(
        error instanceof Error ? error.message : undefined,
        "관리자 사용자 목록을 불러오지 못했습니다."
      ),
      status: 0,
    };
  }
}

async function updateAdminUserLevel(
  accessToken: string,
  targetUserId: string,
  nextUserLevel: UserLevel
): Promise<AdminUserLevelMutationRequestResult> {
  try {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetUserId,
        nextUserLevel,
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | (AdminUserLevelUpdateResponse & { error?: string })
      | { error?: string }
      | null;

    if (!response.ok) {
      return {
        data: null,
        error:
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "사용자 등급을 변경하지 못했습니다.",
        status: response.status,
      };
    }

    return {
      data: payload as AdminUserLevelUpdateResponse,
      error: null,
      status: response.status,
    };
  } catch (error) {
    return {
      data: null,
      error: getKoreanErrorMessage(
        error instanceof Error ? error.message : undefined,
        "사용자 등급을 변경하지 못했습니다."
      ),
      status: 0,
    };
  }
}

async function loadAuditLogs(accessToken: string): Promise<AuditLogsRequestResult> {
  try {
    const response = await fetch("/api/operator-audit-logs", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | (StaffAuditLogResponse & { error?: string })
      | { error?: string }
      | null;

    if (!response.ok) {
      return {
        data: null,
        error:
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "수정 기록 로그를 불러오지 못했습니다.",
        status: response.status,
      };
    }

    return {
      data: payload as StaffAuditLogResponse,
      error: null,
      status: response.status,
    };
  } catch (error) {
    return {
      data: null,
      error: getKoreanErrorMessage(
        error instanceof Error ? error.message : undefined,
        "수정 기록 로그를 불러오지 못했습니다."
      ),
      status: 0,
    };
  }
}

export default function AdminPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [managedUsersLoading, setManagedUsersLoading] = useState(false);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [managedUsersError, setManagedUsersError] = useState<string | null>(null);
  const [auditLogsError, setAuditLogsError] = useState<string | null>(null);
  const [managedUsers, setManagedUsers] = useState<AdminManagedUserRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<StaffAuditLogRow[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [userLevelDrafts, setUserLevelDrafts] = useState<Record<string, UserLevel>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const isOperatorView = isOperatorUser(authUser);

  const showToast = (tone: ToastState["tone"], title: string, message?: string) => {
    setToast(createToastState({ tone, title, message }));
  };

  const resetManagedUserDraft = (managedUser: AdminManagedUserRow) => {
    setUserLevelDrafts((prev) => ({
      ...prev,
      [managedUser.user_id]: managedUser.current_user_level,
    }));
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

      setAuthUser(user);
      setLoading(false);
    };

    void init();
  }, [router]);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    let isDisposed = false;

    const loadAdminSupportData = async () => {
      setManagedUsersLoading(true);
      setManagedUsersError(null);
      setAuditLogsError(null);

      if (isOperatorView) {
        setAuditLogsLoading(true);
      } else {
        setAuditLogs([]);
        setAuditLogsLoading(false);
      }

      const accessToken = await getSupabaseAccessToken();

      if (isDisposed) {
        return;
      }

      if (!accessToken) {
        const fallbackMessage = "관리자 세션을 확인할 수 없습니다. 다시 로그인해주세요.";

        setManagedUsersLoading(false);
        setManagedUsers([]);
        setManagedUsersError(fallbackMessage);
        setAuditLogsLoading(false);
        setAuditLogs([]);
        showToast("error", "관리자 데이터 불러오기 실패", fallbackMessage);
        return;
      }

      const [usersResult, logsResult] = await Promise.all([
        loadAdminUsers(accessToken),
        isOperatorView
          ? loadAuditLogs(accessToken)
          : Promise.resolve<AuditLogsRequestResult>({
              data: null,
              error: null,
              status: 200,
            }),
      ]);

      if (isDisposed) {
        return;
      }

      if (usersResult.status === 401) {
        setManagedUsersLoading(false);
        queuePendingToast({
          tone: "error",
          title: "로그인이 필요합니다",
          message: usersResult.error || "다시 로그인한 뒤 관리자 페이지를 이용해주세요.",
        });
        router.replace("/");
        return;
      }

      if (usersResult.status === 403) {
        setManagedUsersLoading(false);
        queuePendingToast({
          tone: "error",
          title: "관리자 권한이 없습니다",
          message:
            usersResult.error || "권한이 있는 계정만 관리자 페이지에 접근할 수 있습니다.",
        });
        router.replace("/dashboard");
        return;
      }

      setManagedUsersLoading(false);

      if (usersResult.data) {
        const nextUsers = sortManagedUsers(usersResult.data.users ?? []);
        setManagedUsers(nextUsers);
        setUserLevelDrafts(buildUserLevelDrafts(nextUsers));
      }

      if (usersResult.error) {
        setManagedUsers([]);
        setManagedUsersError(usersResult.error);
        showToast("error", "사용자 목록 불러오기 실패", usersResult.error);
      }

      if (isOperatorView) {
        setAuditLogsLoading(false);

        if (logsResult.data) {
          setAuditLogs(logsResult.data.logs ?? []);
        }

        if (logsResult.error) {
          setAuditLogs([]);
          setAuditLogsError(logsResult.error);
          showToast("error", "수정 로그 불러오기 실패", logsResult.error);
        }
      }
    };

    void loadAdminSupportData();

    return () => {
      isDisposed = true;
    };
  }, [authUser, isOperatorView, refreshKey, router]);

  const handleManagedUserDraftChange = (targetUserId: string, nextLevel: string) => {
    if (!USER_LEVEL_OPTIONS.some((level) => level === nextLevel)) {
      return;
    }

    setUserLevelDrafts((prev) => ({
      ...prev,
      [targetUserId]: nextLevel as UserLevel,
    }));
  };

  const saveManagedUserLevel = async (
    managedUser: AdminManagedUserRow,
    nextUserLevelOverride?: UserLevel
  ) => {
    const nextUserLevel =
      nextUserLevelOverride ??
      userLevelDrafts[managedUser.user_id] ??
      managedUser.current_user_level;

    if (nextUserLevel === managedUser.current_user_level) {
      return;
    }

    if (!canManageUserLevelChange(authUser, managedUser.current_user_level, nextUserLevel)) {
      resetManagedUserDraft(managedUser);
      showToast(
        "error",
        "등급 변경 권한이 없습니다",
        "현재 계정은 이 사용자 등급을 변경할 수 없습니다."
      );
      return;
    }

    const accessToken = await getSupabaseAccessToken();

    if (!accessToken) {
      resetManagedUserDraft(managedUser);
      queuePendingToast({
        tone: "error",
        title: "로그인이 필요합니다",
        message: "다시 로그인한 뒤 사용자 등급을 변경해주세요.",
      });
      router.replace("/");
      return;
    }

    setSavingUserId(managedUser.user_id);
    const updateResult = await updateAdminUserLevel(
      accessToken,
      managedUser.user_id,
      nextUserLevel
    );
    setSavingUserId(null);

    if (updateResult.status === 401) {
      resetManagedUserDraft(managedUser);
      queuePendingToast({
        tone: "error",
        title: "로그인이 필요합니다",
        message: updateResult.error || "다시 로그인한 뒤 관리자 페이지를 이용해주세요.",
      });
      router.replace("/");
      return;
    }

    if (updateResult.status === 403) {
      resetManagedUserDraft(managedUser);
      showToast("error", "등급 변경 권한이 없습니다", updateResult.error || undefined);
      return;
    }

    if (!updateResult.data?.user) {
      resetManagedUserDraft(managedUser);
      showToast(
        "error",
        "사용자 등급 변경 실패",
        updateResult.error || "사용자 등급을 변경하지 못했습니다."
      );
      return;
    }

    const updatedUser = updateResult.data.user;

    setManagedUsers((prev) =>
      sortManagedUsers(
        prev.map((row) => (row.user_id === updatedUser.user_id ? updatedUser : row))
      )
    );
    setUserLevelDrafts((prev) => ({
      ...prev,
      [updatedUser.user_id]: updatedUser.current_user_level,
    }));
    setRefreshKey((value) => value + 1);
    showToast(
      "success",
      "사용자 등급을 변경했습니다",
      `${getDriverDisplayName(updatedUser)} 계정이 ${updatedUser.current_user_level}로 변경됐습니다.`
    );
  };

  const handleManagedUserLevelSelection = async (
    managedUser: AdminManagedUserRow,
    nextLevel: string
  ) => {
    if (!USER_LEVEL_OPTIONS.some((level) => level === nextLevel)) {
      return;
    }

    handleManagedUserDraftChange(managedUser.user_id, nextLevel);
    await saveManagedUserLevel(managedUser, nextLevel as UserLevel);
  };

  if (loading) {
    return <PageLoadingShell message="관리자 페이지 확인 중..." />;
  }

  return (
    <PageShell contentClassName="flex w-full max-w-[34rem] flex-col gap-4 sm:max-w-2xl lg:max-w-5xl">
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex w-full flex-col gap-4">
        <section className="retro-panel rounded-[24px] px-4 py-5 sm:rounded-[28px] sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-center justify-center gap-3 text-center">
            <span
              className="retro-title theme-heading px-1 py-1 tracking-[0.18em]"
              style={{ fontSize: "clamp(1.5rem, 2.8vw, 1.75rem)" }}
            >
              USER LIST
            </span>
          </div>

          {managedUsersError ? (
            <div className="theme-note-box mt-4 rounded-[20px] px-4 py-3 text-sm leading-relaxed">
              {managedUsersError}
            </div>
          ) : null}

          {managedUsersLoading ? (
            <div className="theme-note-box mt-4 rounded-[20px] px-4 py-4 text-sm text-center">
              관리자 사용자 목록을 불러오는 중...
            </div>
          ) : managedUsers.length === 0 ? (
            <div className="theme-note-box mt-4 rounded-[20px] px-4 py-4 text-sm text-center">
              표시할 사용자가 없습니다.
            </div>
          ) : (
            <>
              <div className="admin-sheet-wrap admin-driver-table mt-4">
                <table className="admin-sheet-table admin-sheet-table--linear min-w-full w-max text-sm">
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>이메일</th>
                      <th>연락처</th>
                      <th>마지막 로그인</th>
                      <th>마지막 웹 활동</th>
                      <th className="w-[1%] whitespace-nowrap">변경 등급</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managedUsers.map((managedUser) => {
                      const draftLevel =
                        userLevelDrafts[managedUser.user_id] ?? managedUser.current_user_level;
                      const availableLevels = managedUser.is_legacy_admin
                        ? [managedUser.current_user_level]
                        : getAvailableUserLevels(authUser, managedUser);
                      const canEditAnyLevel =
                        !managedUser.is_legacy_admin &&
                        USER_LEVEL_OPTIONS.some((level) =>
                          canManageUserLevelChange(authUser, managedUser.current_user_level, level)
                        );
                      const lastSignInLabel = managedUser.last_sign_in_at
                        ? formatDateTime(managedUser.last_sign_in_at)
                        : "기록 없음";
                      const lastWebActivityLabel =
                        managedUser.last_web_activity_at
                          ? formatDateTime(managedUser.last_web_activity_at)
                          : "기록 없음";

                      return (
                        <tr
                          key={managedUser.user_id}
                          className={`align-top ${getUserLevelRowClass(
                            managedUser.current_user_level
                          )}`}
                        >
                          <td>
                            <p className="theme-heading font-semibold">
                              {getDriverDisplayName(managedUser)}
                            </p>
                          </td>
                          <td>
                            {managedUser.email || "이메일 미등록"}
                          </td>
                          <td>
                            {getDriverPhoneNumber(managedUser)}
                          </td>
                          <td className="whitespace-nowrap">
                            {lastSignInLabel}
                          </td>
                          <td className="whitespace-nowrap">
                            {lastWebActivityLabel}
                          </td>
                          <td className="w-[1%] whitespace-nowrap">
                            <select
                              value={draftLevel}
                              disabled={!canEditAnyLevel || savingUserId === managedUser.user_id}
                              onChange={(event) =>
                                void handleManagedUserLevelSelection(
                                  managedUser,
                                  event.target.value
                                )
                              }
                              className={`admin-sheet-select text-left ${getUserLevelAccentClass(
                                managedUser.current_user_level
                              )}`}
                            >
                              {availableLevels.map((level) => (
                                <option
                                  key={`${managedUser.user_id}-desktop-${level}`}
                                  value={level}
                                >
                                  {level}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {isOperatorView ? (
          <section className="retro-panel rounded-[24px] px-4 py-5 sm:rounded-[28px] sm:px-6 sm:py-6">
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <h2 className="retro-title text-lg sm:text-xl" style={{ color: "inherit" }}>
                LOG HISTORY
              </h2>
              <span className="theme-chip-subtle px-3 py-1.5 text-xs sm:text-sm">
                {auditLogs.length}건
              </span>
            </div>

            {auditLogsError ? (
              <div className="theme-note-box mt-4 rounded-[20px] px-4 py-3 text-sm leading-relaxed">
                {auditLogsError}
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              {auditLogsLoading ? (
                <div className="theme-note-box rounded-[20px] px-4 py-4 text-sm text-center">
                  수정 기록 로그를 불러오는 중...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="theme-note-box rounded-[20px] px-4 py-4 text-sm text-center">
                  표시할 수정 기록 로그가 없습니다.
                </div>
              ) : (
                <>
                <div className="admin-sheet-wrap admin-audit-table">
                  <table className="admin-sheet-table admin-sheet-table--linear min-w-full w-max text-sm">
                    <thead>
                      <tr>
                        <th>날짜</th>
                        <th>작업자</th>
                        <th>대상자</th>
                        <th>수정내용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => {
                        const actorDisplayName = getAuditPersonDisplayName(
                          log.actor_name,
                          log.actor_email,
                          log.actor_user_id
                        );
                        const targetDisplayName = getAuditPersonDisplayName(
                          log.target_name,
                          null,
                          log.target_id
                        );

                        return (
                          <tr
                            key={log.id}
                            className="align-top"
                          >
                            <td className="whitespace-nowrap">
                              {formatDateTime(log.created_at)}
                            </td>
                            <td className="whitespace-nowrap">
                              {actorDisplayName}
                            </td>
                            <td className="whitespace-nowrap">
                              {targetDisplayName}
                            </td>
                            <td>
                              {log.summary_short || log.summary || log.action}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}