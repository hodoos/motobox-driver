"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { recordOperatorAuditLog } from "../../lib/operatorAuditLogClient";
import {
  applyMenuVisibilitySettingsPatch,
  getDefaultMenuVisibilitySettings,
  MENU_VISIBILITY_DEFINITIONS,
  MENU_VISIBILITY_ITEM_DEFINITIONS,
  MENU_VISIBILITY_UPDATED_EVENT,
} from "../../lib/menuVisibility";
import { supabase } from "../../lib/supabase";
import {
  canManageUserLevelChange,
  isAdminUser,
  isOperatorUser,
} from "../../lib/admin";
import {
  DEFAULT_SESSION_TIMEOUT_MINUTES,
  formatSessionTimeoutMinutes,
  getSessionTimeoutValidationMessage,
  MAX_SESSION_TIMEOUT_MINUTES,
  MIN_SESSION_TIMEOUT_MINUTES,
  parseSessionTimeoutMinutes,
  writeCachedSessionTimeoutMinutes,
} from "../../lib/sessionTimeoutConfig";
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
  MenuVisibilityItemKey,
  MenuVisibilityKey,
  MenuVisibilitySettings,
  MenuVisibilitySettingsPatch,
  MenuVisibilitySettingsResponse,
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

type SessionTimeoutSettingsResponse = {
  timeout_minutes: number;
  updated_at: string | null;
};

type SessionTimeoutSettingsRequestResult = {
  data: SessionTimeoutSettingsResponse | null;
  error: string | null;
  status: number;
};

type MenuVisibilitySettingsRequestResult = {
  data: MenuVisibilitySettingsResponse | null;
  error: string | null;
  status: number;
};

type MenuVisibilitySavingStateKey =
  | `category:${MenuVisibilityKey}`
  | `item:${MenuVisibilityItemKey}`;

type UserListSortKey =
  | "driver_name"
  | "email"
  | "phone_number"
  | "last_sign_in_at"
  | "last_web_activity_at"
  | "current_user_level";

type UserListSortDirection = "asc" | "desc";

type UserListSortState = {
  key: UserListSortKey;
  direction: UserListSortDirection;
};

type UserListSortColumn = {
  key: UserListSortKey;
  label: string;
  className?: string;
};

type AdminFolderSectionProps = {
  title: string;
  description: string;
  children: ReactNode;
  meta?: ReactNode;
  defaultOpen?: boolean;
};

const USER_LEVEL_SORT_ORDER = USER_LEVEL_OPTIONS.reduce<Record<UserLevel, number>>(
  (order, level, index) => {
    order[level] = index;
    return order;
  },
  {} as Record<UserLevel, number>
);

const USER_LIST_SORT_COLUMNS: readonly UserListSortColumn[] = [
  { key: "driver_name", label: "이름" },
  { key: "email", label: "이메일" },
  { key: "phone_number", label: "연락처" },
  { key: "last_sign_in_at", label: "마지막 로그인" },
  { key: "last_web_activity_at", label: "마지막 웹 활동" },
  {
    key: "current_user_level",
    label: "변경 등급",
    className: "w-[1%] whitespace-nowrap",
  },
];

function getDefaultUserListSortDirection(key: UserListSortKey): UserListSortDirection {
  if (key === "last_sign_in_at" || key === "last_web_activity_at") {
    return "desc";
  }

  return "asc";
}

function SortIndicator({
  isActive,
  direction,
}: {
  isActive: boolean;
  direction: UserListSortDirection;
}) {
  return (
    <span
      className={`theme-kicker text-[9px] tracking-[0.12em] ${
        isActive ? "text-[var(--text-strong)]" : "opacity-50"
      }`}
    >
      {isActive ? (direction === "asc" ? "ASC" : "DESC") : "SORT"}
    </span>
  );
}

function FolderIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.5 7.5C3.5 6.39543 4.39543 5.5 5.5 5.5H9.2C9.75411 5.5 10.2791 5.74405 10.6382 6.16606L11.6 7.3C11.9591 7.72201 12.4841 7.96606 13.0382 7.96606H18.5C19.6046 7.96606 20.5 8.86149 20.5 9.96606V17.5C20.5 18.6046 19.6046 19.5 18.5 19.5H5.5C4.39543 19.5 3.5 18.6046 3.5 17.5V7.5Z"
        fill={isOpen ? "rgba(244,176,75,0.3)" : "rgba(244,176,75,0.18)"}
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M4.3 10.2H19.7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-90" : "rotate-0"}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9 6L15 12L9 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AdminFolderSection({
  title,
  description,
  children,
  meta,
  defaultOpen = false,
}: AdminFolderSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="retro-panel rounded-[24px] px-4 py-4 sm:rounded-[28px] sm:px-6 sm:py-5">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="theme-note-box flex w-full items-start justify-between gap-3 rounded-[20px] px-4 py-3 text-left transition hover:bg-[rgba(255,255,255,0.05)]"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="pt-0.5 text-[var(--text-strong)]">
            <FolderIcon isOpen={isOpen} />
          </div>
          <div className="min-w-0">
            <p className="retro-title theme-heading text-base leading-none sm:text-lg">
              {title}
            </p>
            <p className="theme-copy mt-2 text-sm leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 pl-2 pt-0.5">
          {meta}
          <span className="theme-copy hidden text-xs font-semibold sm:block">
            {isOpen ? "펼침" : "접힘"}
          </span>
          <ChevronIcon isOpen={isOpen} />
        </div>
      </button>

      {isOpen ? <div className="mt-1">{children}</div> : null}
    </section>
  );
}

function getCategorySavingStateKey(key: MenuVisibilityKey): MenuVisibilitySavingStateKey {
  return `category:${key}`;
}

function getItemSavingStateKey(key: MenuVisibilityItemKey): MenuVisibilitySavingStateKey {
  return `item:${key}`;
}

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

function getManagedUserNameSortValue(row: AdminManagedUserRow) {
  return row.driver_name?.trim() || row.email?.trim() || row.user_id;
}

function getManagedUserSortValue(
  row: AdminManagedUserRow,
  key: UserListSortKey
): string | number | null {
  switch (key) {
    case "driver_name":
      return getManagedUserNameSortValue(row);
    case "email":
      return row.email?.trim() || null;
    case "phone_number":
      return row.phone_number?.trim() || null;
    case "last_sign_in_at":
      return row.last_sign_in_at ? new Date(row.last_sign_in_at).getTime() : null;
    case "last_web_activity_at":
      return row.last_web_activity_at ? new Date(row.last_web_activity_at).getTime() : null;
    case "current_user_level":
      return USER_LEVEL_SORT_ORDER[row.current_user_level] ?? null;
    default:
      return null;
  }
}

function compareNullableValues(
  leftValue: string | number | null,
  rightValue: string | number | null,
  direction: UserListSortDirection
) {
  if (leftValue === null && rightValue === null) {
    return 0;
  }

  if (leftValue === null) {
    return 1;
  }

  if (rightValue === null) {
    return -1;
  }

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
  }

  const comparison = String(leftValue).localeCompare(String(rightValue), "ko");
  return direction === "asc" ? comparison : -comparison;
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

async function loadSessionTimeoutSettings(
  accessToken: string
): Promise<SessionTimeoutSettingsRequestResult> {
  try {
    const response = await fetch("/api/session-timeout", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | (SessionTimeoutSettingsResponse & { error?: string })
      | { error?: string }
      | null;

    if (!response.ok) {
      return {
        data: null,
        error:
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "세션 타임아웃 설정을 불러오지 못했습니다.",
        status: response.status,
      };
    }

    return {
      data: payload as SessionTimeoutSettingsResponse,
      error: null,
      status: response.status,
    };
  } catch (error) {
    return {
      data: null,
      error: getKoreanErrorMessage(
        error instanceof Error ? error.message : undefined,
        "세션 타임아웃 설정을 불러오지 못했습니다."
      ),
      status: 0,
    };
  }
}

async function updateSessionTimeoutSettings(
  accessToken: string,
  timeoutMinutes: number
): Promise<SessionTimeoutSettingsRequestResult> {
  try {
    const response = await fetch("/api/session-timeout", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ timeoutMinutes }),
    });
    const payload = (await response.json().catch(() => null)) as
      | (SessionTimeoutSettingsResponse & { error?: string })
      | { error?: string }
      | null;

    if (!response.ok) {
      return {
        data: null,
        error:
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "세션 타임아웃 설정을 저장하지 못했습니다.",
        status: response.status,
      };
    }

    return {
      data: payload as SessionTimeoutSettingsResponse,
      error: null,
      status: response.status,
    };
  } catch (error) {
    return {
      data: null,
      error: getKoreanErrorMessage(
        error instanceof Error ? error.message : undefined,
        "세션 타임아웃 설정을 저장하지 못했습니다."
      ),
      status: 0,
    };
  }
}

async function loadMenuVisibilitySettings(
  accessToken?: string
): Promise<MenuVisibilitySettingsRequestResult> {
  try {
    const response = await fetch("/api/menu-visibility", {
      method: "GET",
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined,
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | (MenuVisibilitySettingsResponse & { error?: string })
      | { error?: string }
      | null;

    if (!response.ok) {
      return {
        data: null,
        error:
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "메뉴 표시 설정을 불러오지 못했습니다.",
        status: response.status,
      };
    }

    return {
      data: payload as MenuVisibilitySettingsResponse,
      error: null,
      status: response.status,
    };
  } catch (error) {
    return {
      data: null,
      error: getKoreanErrorMessage(
        error instanceof Error ? error.message : undefined,
        "메뉴 표시 설정을 불러오지 못했습니다."
      ),
      status: 0,
    };
  }
}

async function updateMenuVisibilitySettings(
  accessToken: string,
  settings: MenuVisibilitySettingsPatch
): Promise<MenuVisibilitySettingsRequestResult> {
  try {
    const response = await fetch("/api/menu-visibility", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ settings }),
    });
    const payload = (await response.json().catch(() => null)) as
      | (MenuVisibilitySettingsResponse & { error?: string })
      | { error?: string }
      | null;

    if (!response.ok) {
      return {
        data: null,
        error:
          payload && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "메뉴 표시 설정을 저장하지 못했습니다.",
        status: response.status,
      };
    }

    return {
      data: payload as MenuVisibilitySettingsResponse,
      error: null,
      status: response.status,
    };
  } catch (error) {
    return {
      data: null,
      error: getKoreanErrorMessage(
        error instanceof Error ? error.message : undefined,
        "메뉴 표시 설정을 저장하지 못했습니다."
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
  const [sessionTimeoutLoading, setSessionTimeoutLoading] = useState(false);
  const [sessionTimeoutSaving, setSessionTimeoutSaving] = useState(false);
  const [menuVisibilityLoading, setMenuVisibilityLoading] = useState(false);
  const [menuVisibilitySavingKey, setMenuVisibilitySavingKey] =
    useState<MenuVisibilitySavingStateKey | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [managedUsersError, setManagedUsersError] = useState<string | null>(null);
  const [auditLogsError, setAuditLogsError] = useState<string | null>(null);
  const [sessionTimeoutError, setSessionTimeoutError] = useState<string | null>(null);
  const [menuVisibilityError, setMenuVisibilityError] = useState<string | null>(null);
  const [managedUsers, setManagedUsers] = useState<AdminManagedUserRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<StaffAuditLogRow[]>([]);
  const [menuVisibilitySettings, setMenuVisibilitySettings] =
    useState<MenuVisibilitySettings>(() => getDefaultMenuVisibilitySettings());
  const [currentSessionTimeoutMinutes, setCurrentSessionTimeoutMinutes] = useState(
    DEFAULT_SESSION_TIMEOUT_MINUTES
  );
  const [sessionTimeoutMinutesInput, setSessionTimeoutMinutesInput] = useState(
    String(DEFAULT_SESSION_TIMEOUT_MINUTES)
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [userLevelDrafts, setUserLevelDrafts] = useState<Record<string, UserLevel>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [userListSort, setUserListSort] = useState<UserListSortState>({
    key: "driver_name",
    direction: "asc",
  });

  const isOperatorView = isOperatorUser(authUser);
  const menuVisibilityItems =
    menuVisibilitySettings.items ?? getDefaultMenuVisibilitySettings().items;
  const sortedManagedUsers = useMemo(
    () =>
      [...managedUsers].sort((left, right) => {
        const valueComparison = compareNullableValues(
          getManagedUserSortValue(left, userListSort.key),
          getManagedUserSortValue(right, userListSort.key),
          userListSort.direction
        );

        if (valueComparison !== 0) {
          return valueComparison;
        }

        const nameComparison = getManagedUserNameSortValue(left).localeCompare(
          getManagedUserNameSortValue(right),
          "ko"
        );

        if (nameComparison !== 0) {
          return nameComparison;
        }

        return left.user_id.localeCompare(right.user_id);
      }),
    [managedUsers, userListSort]
  );

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
      setSessionTimeoutLoading(true);
      setSessionTimeoutError(null);
      setMenuVisibilityLoading(true);
      setMenuVisibilityError(null);

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
        setSessionTimeoutLoading(false);
        setSessionTimeoutError(fallbackMessage);
        setMenuVisibilityLoading(false);
        setMenuVisibilityError(fallbackMessage);
        showToast("error", "관리자 데이터 불러오기 실패", fallbackMessage);
        return;
      }

      const [usersResult, logsResult, sessionTimeoutResult, menuVisibilityResult] = await Promise.all([
        loadAdminUsers(accessToken),
        isOperatorView
          ? loadAuditLogs(accessToken)
          : Promise.resolve<AuditLogsRequestResult>({
              data: null,
              error: null,
              status: 200,
            }),
        loadSessionTimeoutSettings(accessToken),
        loadMenuVisibilitySettings(accessToken),
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
      setSessionTimeoutLoading(false);
      setMenuVisibilityLoading(false);

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

      if (sessionTimeoutResult.data) {
        setCurrentSessionTimeoutMinutes(sessionTimeoutResult.data.timeout_minutes);
        setSessionTimeoutMinutesInput(
          String(sessionTimeoutResult.data.timeout_minutes)
        );
      }

      if (sessionTimeoutResult.error) {
        setSessionTimeoutError(sessionTimeoutResult.error);
        showToast("error", "세션 타임아웃 설정 불러오기 실패", sessionTimeoutResult.error);
      }

      if (menuVisibilityResult.data?.settings) {
        setMenuVisibilitySettings(menuVisibilityResult.data.settings);
      }

      if (menuVisibilityResult.error) {
        setMenuVisibilityError(menuVisibilityResult.error);
        showToast("error", "메뉴 표시 설정 불러오기 실패", menuVisibilityResult.error);
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

  const handleSessionTimeoutSave = async () => {
    const validationMessage = getSessionTimeoutValidationMessage(
      sessionTimeoutMinutesInput
    );

    if (validationMessage) {
      showToast("error", "세션 타임아웃 시간을 확인해주세요", validationMessage);
      return;
    }

    const timeoutMinutes = parseSessionTimeoutMinutes(sessionTimeoutMinutesInput);

    if (timeoutMinutes === null) {
      showToast(
        "error",
        "세션 타임아웃 시간을 확인해주세요",
        "세션 타임아웃 시간이 올바르지 않습니다."
      );
      return;
    }

    const accessToken = await getSupabaseAccessToken();

    if (!accessToken) {
      queuePendingToast({
        tone: "error",
        title: "로그인이 필요합니다",
        message: "다시 로그인한 뒤 세션 타임아웃 시간을 저장해주세요.",
      });
      router.replace("/");
      return;
    }

    setSessionTimeoutSaving(true);
    const updateResult = await updateSessionTimeoutSettings(accessToken, timeoutMinutes);
    setSessionTimeoutSaving(false);

    if (updateResult.status === 401) {
      queuePendingToast({
        tone: "error",
        title: "로그인이 필요합니다",
        message: updateResult.error || "다시 로그인한 뒤 관리자 페이지를 이용해주세요.",
      });
      router.replace("/");
      return;
    }

    if (updateResult.status === 403) {
      showToast(
        "error",
        "세션 타임아웃 설정 권한이 없습니다",
        updateResult.error || undefined
      );
      return;
    }

    if (!updateResult.data) {
      showToast(
        "error",
        "세션 타임아웃 설정 저장 실패",
        updateResult.error || "세션 타임아웃 시간을 저장하지 못했습니다."
      );
      return;
    }

    setSessionTimeoutError(null);
    setCurrentSessionTimeoutMinutes(updateResult.data.timeout_minutes);
    setSessionTimeoutMinutesInput(String(updateResult.data.timeout_minutes));
    writeCachedSessionTimeoutMinutes(updateResult.data.timeout_minutes);

    await recordOperatorAuditLog({
      action: "session_timeout_updated",
      targetType: "system",
      targetId: "session-timeout",
      source: "/admin",
      summary: "관리 권한 계정이 세션 타임아웃 시간을 변경했습니다.",
      details: {
        timeout_minutes: updateResult.data.timeout_minutes,
      },
    });

    showToast(
      "success",
      "세션 타임아웃 시간을 저장했습니다",
      `현재 자동 로그아웃 기준은 ${formatSessionTimeoutMinutes(
        updateResult.data.timeout_minutes
      )}입니다.`
    );
  };

  const handleMenuVisibilityToggle = async (
    key: MenuVisibilityKey,
    nextVisible: boolean
  ) => {
    const definition = MENU_VISIBILITY_DEFINITIONS.find((item) => item.key === key);
    const patch = { [key]: nextVisible } as MenuVisibilitySettingsPatch;
    const previousSettings = menuVisibilitySettings;
    const accessToken = await getSupabaseAccessToken();

    if (!accessToken) {
      queuePendingToast({
        tone: "error",
        title: "로그인이 필요합니다",
        message: "다시 로그인한 뒤 메뉴 표시 설정을 변경해주세요.",
      });
      router.replace("/");
      return;
    }

    setMenuVisibilitySettings((current) => applyMenuVisibilitySettingsPatch(current, patch));
    setMenuVisibilitySavingKey(getCategorySavingStateKey(key));

    const updateResult = await updateMenuVisibilitySettings(accessToken, patch);

    setMenuVisibilitySavingKey(null);

    if (updateResult.status === 401) {
      setMenuVisibilitySettings(previousSettings);
      queuePendingToast({
        tone: "error",
        title: "로그인이 필요합니다",
        message: updateResult.error || "다시 로그인한 뒤 관리자 페이지를 이용해주세요.",
      });
      router.replace("/");
      return;
    }

    if (updateResult.status === 403) {
      setMenuVisibilitySettings(previousSettings);
      showToast(
        "error",
        "메뉴 표시 설정 권한이 없습니다",
        updateResult.error || undefined
      );
      return;
    }

    if (!updateResult.data?.settings) {
      setMenuVisibilitySettings(previousSettings);
      showToast(
        "error",
        "메뉴 표시 설정 저장 실패",
        updateResult.error || "메뉴 표시 설정을 저장하지 못했습니다."
      );
      return;
    }

    setMenuVisibilityError(null);
    setMenuVisibilitySettings(updateResult.data.settings);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(MENU_VISIBILITY_UPDATED_EVENT));
    }

    await recordOperatorAuditLog({
      action: "menu_visibility_updated",
      targetType: "system",
      targetId: `menu-visibility:${key}`,
      source: "/admin",
      summary: "관리 권한 계정이 메뉴 표시 설정을 변경했습니다.",
      details: {
        key,
        visible: nextVisible,
      },
    });

    showToast(
      "success",
      "메뉴 표시 설정을 저장했습니다",
      `${definition?.label ?? key} 항목을 ${nextVisible ? "보이기" : "숨기기"}로 변경했습니다.`
    );
  };

  const handleMenuVisibilityItemToggle = async (
    key: MenuVisibilityItemKey,
    nextVisible: boolean
  ) => {
    const definition = MENU_VISIBILITY_ITEM_DEFINITIONS.find((item) => item.key === key);
    const patch = {
      items: {
        [key]: nextVisible,
      },
    } as MenuVisibilitySettingsPatch;
    const previousSettings = menuVisibilitySettings;
    const accessToken = await getSupabaseAccessToken();

    if (!accessToken) {
      queuePendingToast({
        tone: "error",
        title: "로그인이 필요합니다",
        message: "다시 로그인한 뒤 메뉴 표시 설정을 변경해주세요.",
      });
      router.replace("/");
      return;
    }

    setMenuVisibilitySettings((current) => applyMenuVisibilitySettingsPatch(current, patch));
    setMenuVisibilitySavingKey(getItemSavingStateKey(key));

    const updateResult = await updateMenuVisibilitySettings(accessToken, patch);

    setMenuVisibilitySavingKey(null);

    if (updateResult.status === 401) {
      setMenuVisibilitySettings(previousSettings);
      queuePendingToast({
        tone: "error",
        title: "로그인이 필요합니다",
        message: updateResult.error || "다시 로그인한 뒤 관리자 페이지를 이용해주세요.",
      });
      router.replace("/");
      return;
    }

    if (updateResult.status === 403) {
      setMenuVisibilitySettings(previousSettings);
      showToast(
        "error",
        "메뉴 표시 설정 권한이 없습니다",
        updateResult.error || undefined
      );
      return;
    }

    if (!updateResult.data?.settings) {
      setMenuVisibilitySettings(previousSettings);
      showToast(
        "error",
        "메뉴 표시 설정 저장 실패",
        updateResult.error || "메뉴 표시 설정을 저장하지 못했습니다."
      );
      return;
    }

    setMenuVisibilityError(null);
    setMenuVisibilitySettings(updateResult.data.settings);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(MENU_VISIBILITY_UPDATED_EVENT));
    }

    await recordOperatorAuditLog({
      action: "menu_visibility_updated",
      targetType: "system",
      targetId: `menu-visibility:item:${key}`,
      source: "/admin",
      summary: "관리 권한 계정이 하위 메뉴 표시 설정을 변경했습니다.",
      details: {
        key,
        visible: nextVisible,
      },
    });

    showToast(
      "success",
      "메뉴 표시 설정을 저장했습니다",
      `${definition?.label ?? key} 하위 메뉴를 ${nextVisible ? "보이기" : "숨기기"}로 변경했습니다.`
    );
  };

  const handleUserListSortChange = (key: UserListSortKey) => {
    setUserListSort((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: getDefaultUserListSortDirection(key),
      };
    });
  };

  if (loading) {
    return <PageLoadingShell message="관리자 페이지 확인 중..." />;
  }

  return (
    <PageShell contentClassName="flex w-full max-w-[34rem] flex-col gap-4 sm:max-w-2xl lg:max-w-5xl">
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex w-full flex-col gap-4">
        <AdminFolderSection
          title="SESSION TIMEOUT"
          description="모든 로그인 세션의 자동 로그아웃 기준 시간을 관리자 페이지에서 조정합니다."
        >

          {sessionTimeoutError ? (
            <div className="theme-note-box mt-4 rounded-[20px] px-4 py-3 text-sm leading-relaxed">
              {sessionTimeoutError}
            </div>
          ) : null}

          {sessionTimeoutLoading ? (
            <div className="theme-note-box mt-4 rounded-[20px] px-4 py-4 text-sm text-center">
              세션 타임아웃 설정을 불러오는 중...
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1">
                  <span className="theme-heading mb-2 block text-sm font-semibold">
                    세션 타임아웃 시간 (분)
                  </span>
                  <input
                    type="number"
                    min={MIN_SESSION_TIMEOUT_MINUTES}
                    max={MAX_SESSION_TIMEOUT_MINUTES}
                    step={1}
                    inputMode="numeric"
                    value={sessionTimeoutMinutesInput}
                    onChange={(event) =>
                      setSessionTimeoutMinutesInput(event.target.value)
                    }
                    disabled={sessionTimeoutSaving}
                    className="w-full px-4 py-3 text-center sm:text-left"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void handleSessionTimeoutSave()}
                  disabled={sessionTimeoutSaving}
                  className="retro-button-solid min-h-[48px] px-5 py-3 text-sm font-semibold disabled:opacity-60 sm:min-w-[9rem]"
                >
                  {sessionTimeoutSaving ? "저장 중..." : "저장"}
                </button>
              </div>

              <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="theme-copy">
                  현재 적용값: {formatSessionTimeoutMinutes(currentSessionTimeoutMinutes)} ({currentSessionTimeoutMinutes}분)
                </p>
                <p className="theme-copy text-xs">
                  입력 범위: {MIN_SESSION_TIMEOUT_MINUTES}분 ~ {MAX_SESSION_TIMEOUT_MINUTES}분
                </p>
              </div>
            </div>
          )}
        </AdminFolderSection>

        <AdminFolderSection
          title="MENU MANAGEMENT"
          description="상단 메뉴에서 카테고리와 하위 메뉴를 관리자 페이지에서 직접 숨기거나 다시 보이게 할 수 있습니다."
        >

          {menuVisibilityError ? (
            <div className="theme-note-box mt-4 rounded-[20px] px-4 py-3 text-sm leading-relaxed">
              {menuVisibilityError}
            </div>
          ) : null}

          {menuVisibilityLoading ? (
            <div className="theme-note-box mt-4 rounded-[20px] px-4 py-4 text-sm text-center">
              메뉴 표시 설정을 불러오는 중...
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {MENU_VISIBILITY_DEFINITIONS.map((item) => {
                const isVisible = menuVisibilitySettings[item.key];
                const isSaving =
                  menuVisibilitySavingKey === getCategorySavingStateKey(item.key);

                return (
                  <div
                    key={item.key}
                    className="theme-note-box rounded-[20px] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="theme-heading text-sm font-semibold leading-relaxed">
                          {item.label}
                        </p>
                        <p className="theme-copy mt-1 text-xs leading-relaxed sm:text-sm">
                          {item.description}
                        </p>
                      </div>

                      <label className="flex shrink-0 cursor-pointer items-center gap-2 pt-0.5">
                        {isSaving ? (
                          <span className="theme-copy text-xs leading-none">저장 중</span>
                        ) : null}
                        <span className="theme-copy text-xs font-semibold leading-none">
                          {isVisible ? "보임" : "숨김"}
                        </span>
                        <input
                          type="checkbox"
                          checked={isVisible}
                          disabled={menuVisibilitySavingKey !== null}
                          onChange={(event) =>
                            void handleMenuVisibilityToggle(item.key, event.target.checked)
                          }
                          className="h-4 w-4 shrink-0 cursor-pointer accent-[rgb(244,176,75)]"
                        />
                      </label>
                    </div>

                    {item.items?.length ? (
                      <div className="mt-3 space-y-2 border-t border-[var(--border)]/70 pt-3">
                        {item.items.map((childItem) => {
                          const isChildVisible = menuVisibilityItems[childItem.key];
                          const isChildSaving =
                            menuVisibilitySavingKey === getItemSavingStateKey(childItem.key);

                          return (
                            <label
                              key={childItem.key}
                              className="flex cursor-pointer items-start justify-between gap-3 rounded-[16px] bg-[rgba(255,255,255,0.03)] px-3 py-2.5"
                            >
                              <div className="min-w-0">
                                <p className="theme-heading text-sm font-semibold leading-relaxed">
                                  {childItem.label}
                                </p>
                                <p className="theme-copy mt-1 text-[11px] leading-relaxed sm:text-xs">
                                  {childItem.description}
                                </p>
                              </div>

                              <div className="flex shrink-0 items-center gap-2 pt-0.5">
                                {isChildSaving ? (
                                  <span className="theme-copy text-xs leading-none">저장 중</span>
                                ) : null}
                                <span className="theme-copy text-xs font-semibold leading-none">
                                  {isChildVisible ? "보임" : "숨김"}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={isChildVisible}
                                  disabled={menuVisibilitySavingKey !== null}
                                  onChange={(event) =>
                                    void handleMenuVisibilityItemToggle(
                                      childItem.key,
                                      event.target.checked
                                    )
                                  }
                                  className="h-4 w-4 shrink-0 cursor-pointer accent-[rgb(244,176,75)]"
                                />
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </AdminFolderSection>

        <AdminFolderSection
          title="USER LIST"
          description="관리자 페이지에서 사용자 목록을 확인하고 권한 등급을 변경할 수 있습니다."
          meta={
            <span className="theme-chip-subtle px-3 py-1 text-xs sm:text-sm">
              {managedUsers.length}명
            </span>
          }
        >

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
                      {USER_LIST_SORT_COLUMNS.map((column) => {
                        const isActive = userListSort.key === column.key;
                        const ariaSort = isActive
                          ? userListSort.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none";

                        return (
                          <th
                            key={column.key}
                            aria-sort={ariaSort}
                            className={column.className}
                          >
                            <button
                              type="button"
                              onClick={() => handleUserListSortChange(column.key)}
                              className="flex w-full items-center gap-2 text-left transition hover:text-[var(--text-strong)]"
                            >
                              <span>{column.label}</span>
                              <SortIndicator
                                isActive={isActive}
                                direction={userListSort.direction}
                              />
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedManagedUsers.map((managedUser) => {
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
        </AdminFolderSection>

        {isOperatorView ? (
          <AdminFolderSection
            title="LOG HISTORY"
            description="운영자 권한 계정이 관리자 작업 이력을 접었다 펼치며 확인할 수 있습니다."
            meta={
              <span className="theme-chip-subtle px-3 py-1.5 text-xs sm:text-sm">
                {auditLogs.length}건
              </span>
            }
          >

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
          </AdminFolderSection>
        ) : null}
      </div>
    </PageShell>
  );
}