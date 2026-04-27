"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { recordOperatorAuditLog } from "../../lib/operatorAuditLogClient";
import {
  applyMenuVisibilitySettingsPatch,
  createCustomMenuVisibilityItemKey,
  getDefaultMenuVisibilitySettings,
  getDefaultMenuVisibilityCategoryHref,
  getMenuAccessLevelLabel,
  getMenuVisibilityItemKeys,
  getMenuVisibilityItemParentKey,
  getMenuVisibilityItemsForCategory,
  getMenuVisibilityResolvedItem,
  getMenuWriteAccessLevelLabel,
  hasWritableMenuChildren,
  isCustomMenuVisibilityItemKey,
  MENU_ACCESS_LEVEL_OPTIONS,
  MENU_VISIBILITY_DEFINITIONS,
  MENU_VISIBILITY_ITEM_DEFINITIONS,
  MENU_WRITE_ACCESS_LEVEL_OPTIONS,
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
  MenuWriteAccessLevel,
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

const MENU_ACCESS_LEVEL_SELECT_OPTIONS = MENU_ACCESS_LEVEL_OPTIONS.map((option) => ({
  value: option,
  label: getMenuAccessLevelLabel(option),
}));

const MENU_WRITE_ACCESS_LEVEL_SELECT_OPTIONS = MENU_WRITE_ACCESS_LEVEL_OPTIONS.map(
  (option) => ({
    value: option,
    label: getMenuWriteAccessLevelLabel(option),
  })
);

const MENU_VISIBLE_SELECT_OPTIONS = [
  { value: "true", label: "표시" },
  { value: "false", label: "미표시" },
] as const;

const MENU_ENABLED_SELECT_OPTIONS = [
  { value: "true", label: "사용 중" },
  { value: "false", label: "미사용" },
] as const;

function normalizeMenuItemHrefDraft(value: string) {
  return value.trim().slice(0, 240);
}

function isValidMenuItemHref(value: string) {
  const normalizedValue = normalizeMenuItemHrefDraft(value);
  return normalizedValue.startsWith("/") || /^https?:\/\//i.test(normalizedValue);
}

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
      className={`h-4 w-4 shrink-0 ${isOpen ? "rotate-90" : "rotate-0"}`}
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
        className="theme-note-box flex w-full items-start justify-between gap-3 rounded-[20px] px-4 py-3 text-left"
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

type MenuSelectOption<T extends string> = {
  value: T;
  label: string;
};

function MenuSelectField<T extends string>({
  label,
  value,
  onChange,
  disabled,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (nextValue: T) => void;
  disabled: boolean;
  options: readonly MenuSelectOption<T>[];
  className?: string;
}) {
  return (
    <label
      className={`flex flex-col gap-2 rounded-2xl border border-(--border)/70 bg-[rgba(255,255,255,0.05)] px-3 py-3 ${
        className ?? ""
      }`}
    >
      <span className="theme-heading text-xs font-semibold">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full px-3 py-2.5 text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MenuOrderMoveField({
  position,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  disabled,
}: {
  position: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-(--border)/70 bg-[rgba(255,255,255,0.05)] px-3 py-3">
      <span className="theme-heading text-xs font-semibold">정렬 순서</span>
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="theme-copy text-xs">현재 {position + 1}번째</span>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <button
            type="button"
            disabled={disabled || !canMoveUp}
            onClick={onMoveUp}
            className="retro-button min-h-9 rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            위로
          </button>
          <button
            type="button"
            disabled={disabled || !canMoveDown}
            onClick={onMoveDown}
            className="retro-button min-h-9 rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            아래로
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuMiniButton({
  label,
  onClick,
  disabled = false,
  tone = "default",
  className,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "solid";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${tone === "solid" ? "retro-button-solid" : "retro-button"} inline-flex min-h-8 items-center justify-center rounded-lg px-2.5 py-1.5 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${className ?? ""}`}
    >
      {label}
    </button>
  );
}

function MenuToggleField({
  label,
  value,
  disabled,
  trueLabel,
  falseLabel,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  trueLabel: string;
  falseLabel: string;
  onChange: (nextValue: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-(--border)/70 bg-[rgba(255,255,255,0.05)] px-3 py-3">
      <span className="theme-heading text-xs font-semibold">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(true)}
          className={`${value ? "retro-button-solid" : "retro-button"} min-h-9 rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {trueLabel}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(false)}
          className={`${!value ? "retro-button-solid" : "retro-button"} min-h-9 rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {falseLabel}
        </button>
      </div>
    </div>
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
  const [editingMenuCategoryKeys, setEditingMenuCategoryKeys] = useState<
    MenuVisibilityKey[]
  >([]);
  const [menuCategoryLabelDrafts, setMenuCategoryLabelDrafts] = useState<
    Partial<Record<MenuVisibilityKey, string>>
  >({});
  const [activeMenuItemEditorKey, setActiveMenuItemEditorKey] =
    useState<MenuVisibilityItemKey | null>(null);
  const [menuItemLabelDrafts, setMenuItemLabelDrafts] = useState<
    Partial<Record<MenuVisibilityItemKey, string>>
  >({});
  const [menuItemHrefDrafts, setMenuItemHrefDrafts] = useState<
    Partial<Record<MenuVisibilityItemKey, string>>
  >({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const [managedUsersError, setManagedUsersError] = useState<string | null>(null);
  const [auditLogsError, setAuditLogsError] = useState<string | null>(null);
  const [sessionTimeoutError, setSessionTimeoutError] = useState<string | null>(null);
  const [menuVisibilityError, setMenuVisibilityError] = useState<string | null>(null);
  const [managedUsers, setManagedUsers] = useState<AdminManagedUserRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<StaffAuditLogRow[]>([]);
  const [menuVisibilitySettings, setMenuVisibilitySettings] =
    useState<MenuVisibilitySettings>(() => getDefaultMenuVisibilitySettings());
  const [savedMenuVisibilitySettings, setSavedMenuVisibilitySettings] =
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
  const menuVisibilityItems = menuVisibilitySettings.items;
  const sortedMenuDefinitions = useMemo(
    () =>
      [...MENU_VISIBILITY_DEFINITIONS].sort(
        (left, right) =>
          menuVisibilitySettings.categories[left.key].order -
          menuVisibilitySettings.categories[right.key].order
      ),
    [menuVisibilitySettings]
  );
  const menuCategorySelectOptions: MenuSelectOption<MenuVisibilityKey>[] =
    sortedMenuDefinitions.map((definition) => ({
      value: definition.key,
      label: menuVisibilitySettings.categories[definition.key].label,
    }));
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
        setSavedMenuVisibilitySettings(menuVisibilityResult.data.settings);
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

  const updateMenuCategoryDraft = (
    key: MenuVisibilityKey,
    patch: NonNullable<MenuVisibilitySettingsPatch["categories"]>[MenuVisibilityKey]
  ) => {
    setMenuVisibilitySettings((current) =>
      applyMenuVisibilitySettingsPatch(current, {
        categories: {
          [key]: patch,
        },
      })
    );
  };

  const restoreMenuCategoryDraft = (key: MenuVisibilityKey) => {
    const savedValue = savedMenuVisibilitySettings.categories[key];

    setMenuVisibilitySettings((current) =>
      applyMenuVisibilitySettingsPatch(current, {
        categories: {
          [key]: savedValue,
        },
      })
    );
  };

  const updateMenuCategoryLabelDraft = (key: MenuVisibilityKey, value: string) => {
    setMenuCategoryLabelDrafts((current) => ({
      ...current,
      [key]: value.slice(0, 40),
    }));
  };

  const clearMenuCategoryLabelDraft = (key: MenuVisibilityKey) => {
    setMenuCategoryLabelDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const moveMenuCategoryDraft = (
    key: MenuVisibilityKey,
    direction: "up" | "down"
  ) => {
    setMenuVisibilitySettings((current) => {
      const sortedCategoryKeys = [...MENU_VISIBILITY_DEFINITIONS]
        .sort(
          (left, right) =>
            current.categories[left.key].order - current.categories[right.key].order
        )
        .map((definition) => definition.key);
      const currentIndex = sortedCategoryKeys.indexOf(key);

      if (currentIndex < 0) {
        return current;
      }

      const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (swapIndex < 0 || swapIndex >= sortedCategoryKeys.length) {
        return current;
      }

      const swapKey = sortedCategoryKeys[swapIndex];

      return applyMenuVisibilitySettingsPatch(current, {
        categories: {
          [key]: {
            order: current.categories[swapKey].order,
          },
          [swapKey]: {
            order: current.categories[key].order,
          },
        },
      });
    });
  };

  const updateMenuItemDraft = (
    key: MenuVisibilityItemKey,
    patch: NonNullable<MenuVisibilitySettingsPatch["items"]>[MenuVisibilityItemKey]
  ) => {
    setMenuVisibilitySettings((current) =>
      applyMenuVisibilitySettingsPatch(current, {
        items: {
          [key]: patch,
        },
      })
    );
  };

  const moveMenuItemDraft = (
    key: MenuVisibilityItemKey,
    direction: "up" | "down"
  ) => {
    setMenuVisibilitySettings((current) => {
      const parentKey = getMenuVisibilityItemParentKey(key, current);

      if (!parentKey) {
        return current;
      }

      const siblingKeys = getMenuVisibilityItemsForCategory(current, parentKey)
        .sort((left, right) => current.items[left.key].order - current.items[right.key].order)
        .map((item) => item.key);
      const currentIndex = siblingKeys.indexOf(key);

      if (currentIndex < 0) {
        return current;
      }

      const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (swapIndex < 0 || swapIndex >= siblingKeys.length) {
        return current;
      }

      const swapKey = siblingKeys[swapIndex];

      return applyMenuVisibilitySettingsPatch(current, {
        items: {
          [key]: {
            order: current.items[swapKey].order,
          },
          [swapKey]: {
            order: current.items[key].order,
          },
        },
      });
    });
  };

  const moveMenuItemToCategoryDraft = (
    key: MenuVisibilityItemKey,
    nextParentKey: MenuVisibilityKey
  ) => {
    const currentParentKey = getMenuVisibilityItemParentKey(key, menuVisibilitySettings);

    if (!currentParentKey || currentParentKey === nextParentKey) {
      return;
    }

    const nextSiblingDefinitions = getMenuVisibilityItemsForCategory(
      menuVisibilitySettings,
      nextParentKey
    ).filter((item) => item.key !== key);
    const nextOrder =
      nextSiblingDefinitions.length > 0
        ? Math.max(
            ...nextSiblingDefinitions.map((item) => menuVisibilitySettings.items[item.key].order)
          ) + 1
        : 0;
    const currentHrefValue = normalizeMenuItemHrefDraft(
      menuItemHrefDrafts[key] ?? menuVisibilitySettings.items[key]?.href ?? ""
    );
    const currentDefaultHref = getDefaultMenuVisibilityCategoryHref(currentParentKey) ?? "";
    const nextDefaultHref = getDefaultMenuVisibilityCategoryHref(nextParentKey) ?? "";
    const shouldSyncHref =
      isCustomMenuVisibilityItemKey(key) &&
      (currentHrefValue.length === 0 || currentHrefValue === currentDefaultHref);
    const nextSettings = applyMenuVisibilitySettingsPatch(menuVisibilitySettings, {
      items: {
        [key]: {
          parent_key: nextParentKey,
          order: nextOrder,
          ...(shouldSyncHref ? { href: nextDefaultHref || null } : {}),
        },
      },
    });

    setMenuVisibilitySettings(nextSettings);

    if (shouldSyncHref && menuItemHrefDrafts[key] !== undefined) {
      updateMenuItemHrefDraft(key, nextDefaultHref);
    }
  };

  const restoreMenuItemDrafts = (
    items: Partial<Record<MenuVisibilityItemKey, MenuVisibilitySettings["items"][MenuVisibilityItemKey]>>
  ) => {
    setMenuVisibilitySettings((current) =>
      applyMenuVisibilitySettingsPatch(current, {
        items,
      })
    );
  };

  const removeMenuItemDraft = (key: MenuVisibilityItemKey) => {
    setMenuVisibilitySettings((current) => {
      if (!Object.prototype.hasOwnProperty.call(current.items, key)) {
        return current;
      }

      const nextItems = { ...current.items };
      delete nextItems[key];

      return {
        ...current,
        items: nextItems,
      };
    });
  };

  const updateMenuItemLabelDraft = (key: MenuVisibilityItemKey, value: string) => {
    setMenuItemLabelDrafts((current) => ({
      ...current,
      [key]: value.slice(0, 40),
    }));
  };

  const updateMenuItemHrefDraft = (key: MenuVisibilityItemKey, value: string) => {
    setMenuItemHrefDrafts((current) => ({
      ...current,
      [key]: value.slice(0, 240),
    }));
  };

  const clearMenuItemLabelDraft = (key: MenuVisibilityItemKey) => {
    setMenuItemLabelDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const clearMenuItemHrefDraft = (key: MenuVisibilityItemKey) => {
    setMenuItemHrefDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const clearMenuItemDrafts = (key: MenuVisibilityItemKey) => {
    clearMenuItemLabelDraft(key);
    clearMenuItemHrefDraft(key);
  };

  const isSavedMenuItemKey = (key: MenuVisibilityItemKey) =>
    Object.prototype.hasOwnProperty.call(savedMenuVisibilitySettings.items, key);

  const hasMenuCategoryChanges = (key: MenuVisibilityKey) => {
    const currentValue = menuVisibilitySettings.categories[key];
    const savedValue = savedMenuVisibilitySettings.categories[key];

    return JSON.stringify(currentValue) !== JSON.stringify(savedValue);
  };

  const hasMenuItemChanges = (key: MenuVisibilityItemKey) => {
    const currentValue = menuVisibilitySettings.items[key];
    const savedValue = savedMenuVisibilitySettings.items[key];

    return JSON.stringify(currentValue) !== JSON.stringify(savedValue);
  };

  const getDirtyMenuCategoryKeys = () =>
    MENU_VISIBILITY_DEFINITIONS.map((definition) => definition.key).filter((categoryKey) =>
      hasMenuCategoryChanges(categoryKey)
    );

  const getDirtyMenuItemKeys = () =>
    Array.from(
      new Set([
        ...getMenuVisibilityItemKeys(menuVisibilitySettings),
        ...getMenuVisibilityItemKeys(savedMenuVisibilitySettings),
      ])
    ).filter((itemKey) => hasMenuItemChanges(itemKey));

  const openNewMenuItemEditor = (initialParentKey?: MenuVisibilityKey) => {
    const nextParentKey = initialParentKey ?? sortedMenuDefinitions[0]?.key ?? "basic";
    const nextKey = createCustomMenuVisibilityItemKey();
    const siblingItems = getMenuVisibilityItemsForCategory(menuVisibilitySettings, nextParentKey);
    const nextHref = getDefaultMenuVisibilityCategoryHref(nextParentKey);
    const nextOrder =
      siblingItems.length > 0
        ? Math.max(...siblingItems.map((item) => menuVisibilitySettings.items[item.key].order)) + 1
        : 0;

    setMenuVisibilitySettings((current) =>
      applyMenuVisibilitySettingsPatch(current, {
        items: {
          [nextKey]: {
            parent_key: nextParentKey,
            label: "새 메뉴",
            order: nextOrder,
            access_level: current.categories[nextParentKey].access_level,
            visible: true,
            enabled: true,
            href: nextHref,
            archived: false,
          },
        },
      })
    );
    setMenuItemLabelDrafts((current) => ({
      ...current,
      [nextKey]: "새 메뉴",
    }));
    setActiveMenuItemEditorKey(nextKey);
  };

  const handleMenuCategorySave = async (
    key: MenuVisibilityKey,
    labelOverride?: string
  ) => {
    const definition = MENU_VISIBILITY_DEFINITIONS.find((item) => item.key === key);
    const dirtyCategoryKeys = getDirtyMenuCategoryKeys();
    const categoryKeysToSave = dirtyCategoryKeys.length > 0 ? dirtyCategoryKeys : [key];
    const hasEmptyCategoryLabel = categoryKeysToSave.some((categoryKey) => {
      const nextLabel =
        categoryKey === key && typeof labelOverride === "string"
          ? labelOverride
          : menuVisibilitySettings.categories[categoryKey].label;

      return nextLabel.trim().length === 0;
    });

    if (hasEmptyCategoryLabel) {
      showToast(
        "error",
        "카테고리 이름을 확인해주세요",
        "카테고리 이름은 비워둘 수 없습니다."
      );
      return false;
    }

    const patch: MenuVisibilitySettingsPatch = {
      categories: categoryKeysToSave.reduce<
        NonNullable<MenuVisibilitySettingsPatch["categories"]>
      >((categories, categoryKey) => {
        categories[categoryKey] =
          categoryKey === key && typeof labelOverride === "string"
            ? {
                ...menuVisibilitySettings.categories[categoryKey],
                label: labelOverride,
              }
            : menuVisibilitySettings.categories[categoryKey];
        return categories;
      }, {}),
    };
    const accessToken = await getSupabaseAccessToken();

    if (!accessToken) {
      queuePendingToast({
        tone: "error",
        title: "로그인이 필요합니다",
        message: "다시 로그인한 뒤 메뉴 설정을 저장해주세요.",
      });
      router.replace("/");
      return false;
    }

    setMenuVisibilitySavingKey(getCategorySavingStateKey(key));

    const updateResult = await updateMenuVisibilitySettings(accessToken, patch);

    setMenuVisibilitySavingKey(null);

    if (updateResult.status === 401) {
      queuePendingToast({
        tone: "error",
        title: "로그인이 필요합니다",
        message: updateResult.error || "다시 로그인한 뒤 관리자 페이지를 이용해주세요.",
      });
      router.replace("/");
      return false;
    }

    if (updateResult.status === 403) {
      showToast("error", "메뉴 설정 권한이 없습니다", updateResult.error || undefined);
      return false;
    }

    if (!updateResult.data?.settings) {
      showToast(
        "error",
        "메뉴 설정 저장 실패",
        updateResult.error || "카테고리 메뉴 설정을 저장하지 못했습니다."
      );
      return false;
    }

    const nextMenuVisibilitySettings = updateResult.data.settings;

    setMenuVisibilityError(null);
    setMenuVisibilitySettings(nextMenuVisibilitySettings);
    setSavedMenuVisibilitySettings(nextMenuVisibilitySettings);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(MENU_VISIBILITY_UPDATED_EVENT));
    }

    await recordOperatorAuditLog({
      action: "menu_visibility_updated",
      targetType: "system",
      targetId:
        categoryKeysToSave.length > 1
          ? "menu-visibility:categories"
          : `menu-visibility:category:${key}`,
      source: "/admin",
      summary: "관리 권한 계정이 카테고리 메뉴 설정을 변경했습니다.",
      details: {
        keys: categoryKeysToSave,
        settings: categoryKeysToSave.reduce<Record<string, MenuVisibilitySettings["categories"][MenuVisibilityKey]>>(
          (settings, categoryKey) => {
            settings[categoryKey] = nextMenuVisibilitySettings.categories[categoryKey];
            return settings;
          },
          {}
        ),
      },
    });

    showToast(
      "success",
      "카테고리 메뉴 설정을 저장했습니다",
      categoryKeysToSave.length > 1
        ? `카테고리 ${categoryKeysToSave.length}개의 정렬 및 설정이 반영되었습니다.`
        : `${definition?.label ?? key} 카테고리 설정이 반영되었습니다.`
    );

    return true;
  };

  const handleMenuItemSave = async (
    key: MenuVisibilityItemKey,
    labelOverride?: string,
    hrefOverride?: string
  ) => {
    const definition = MENU_VISIBILITY_ITEM_DEFINITIONS.find((item) => item.key === key);
    const dirtyItemKeys = getDirtyMenuItemKeys();
    const parentKey = getMenuVisibilityItemParentKey(key, menuVisibilitySettings);
    const autoHref = parentKey ? getDefaultMenuVisibilityCategoryHref(parentKey) ?? "" : "";
    const siblingItemKeys = parentKey
      ? getMenuVisibilityItemsForCategory(menuVisibilitySettings, parentKey).map((item) => item.key)
      : [key];
    const itemKeysToSave = siblingItemKeys.filter((itemKey) => dirtyItemKeys.includes(itemKey));
    const resolvedItemKeysToSave = itemKeysToSave.length > 0 ? itemKeysToSave : [key];
    const hasEmptyItemLabel = resolvedItemKeysToSave.some((itemKey) => {
      const nextLabel =
        itemKey === key && typeof labelOverride === "string"
          ? labelOverride
          : menuVisibilitySettings.items[itemKey].label;

      return nextLabel.trim().length === 0;
    });
    const nextHrefValue =
      typeof hrefOverride === "string"
        ? normalizeMenuItemHrefDraft(hrefOverride)
        : normalizeMenuItemHrefDraft(menuVisibilitySettings.items[key]?.href ?? autoHref);
    const hasInvalidCustomHref =
      isCustomMenuVisibilityItemKey(key) &&
      !menuVisibilitySettings.items[key]?.archived &&
      !isValidMenuItemHref(nextHrefValue);

    if (hasEmptyItemLabel) {
      showToast(
        "error",
        "메뉴 이름을 확인해주세요",
        "메뉴 이름은 비워둘 수 없습니다."
      );
      return false;
    }

    if (hasInvalidCustomHref) {
      showToast(
        "error",
        "연결 경로를 확인해주세요",
        "새 메뉴는 /로 시작하는 내부 경로 또는 http/https 주소가 필요합니다."
      );
      return false;
    }

    const previousSavedItems = resolvedItemKeysToSave.reduce<
      Partial<Record<MenuVisibilityItemKey, MenuVisibilitySettings["items"][MenuVisibilityItemKey]>>
    >((items, itemKey) => {
      items[itemKey] = savedMenuVisibilitySettings.items[itemKey];
      return items;
    }, {});
    const patch: MenuVisibilitySettingsPatch = {
      items: resolvedItemKeysToSave.reduce<NonNullable<MenuVisibilitySettingsPatch["items"]>>(
        (items, itemKey) => {
          if (itemKey === key) {
            items[itemKey] = {
              ...menuVisibilitySettings.items[itemKey],
              ...(typeof labelOverride === "string" ? { label: labelOverride } : {}),
              ...(isCustomMenuVisibilityItemKey(itemKey) ? { href: nextHrefValue || null } : {}),
            };

            return items;
          }

          items[itemKey] = menuVisibilitySettings.items[itemKey];
          return items;
        },
        {}
      ),
    };
    const accessToken = await getSupabaseAccessToken();

    if (!accessToken) {
      queuePendingToast({
        tone: "error",
        title: "로그인이 필요합니다",
        message: "다시 로그인한 뒤 메뉴 설정을 저장해주세요.",
      });
      router.replace("/");
      return false;
    }

    setMenuVisibilitySavingKey(getItemSavingStateKey(key));

    const updateResult = await updateMenuVisibilitySettings(accessToken, patch);

    setMenuVisibilitySavingKey(null);

    if (updateResult.status === 401) {
      restoreMenuItemDrafts(previousSavedItems);
      queuePendingToast({
        tone: "error",
        title: "로그인이 필요합니다",
        message: updateResult.error || "다시 로그인한 뒤 관리자 페이지를 이용해주세요.",
      });
      router.replace("/");
      return false;
    }

    if (updateResult.status === 403) {
      restoreMenuItemDrafts(previousSavedItems);
      showToast("error", "메뉴 설정 권한이 없습니다", updateResult.error || undefined);
      return false;
    }

    if (!updateResult.data?.settings) {
      restoreMenuItemDrafts(previousSavedItems);
      showToast(
        "error",
        "메뉴 설정 저장 실패",
        updateResult.error || "하위 메뉴 설정을 저장하지 못했습니다."
      );
      return false;
    }

    const nextMenuVisibilitySettings = updateResult.data.settings;

    setMenuVisibilityError(null);
    setMenuVisibilitySettings(nextMenuVisibilitySettings);
    setSavedMenuVisibilitySettings(nextMenuVisibilitySettings);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(MENU_VISIBILITY_UPDATED_EVENT));
    }

    await recordOperatorAuditLog({
      action: "menu_visibility_updated",
      targetType: "system",
      targetId:
        resolvedItemKeysToSave.length > 1
          ? `menu-visibility:items:${parentKey ?? definition?.parentKey ?? "group"}`
          : `menu-visibility:item:${key}`,
      source: "/admin",
      summary: "관리 권한 계정이 하위 메뉴 설정을 변경했습니다.",
      details: {
        keys: resolvedItemKeysToSave,
        settings: resolvedItemKeysToSave.reduce<Record<string, MenuVisibilitySettings["items"][MenuVisibilityItemKey]>>(
          (items, itemKey) => {
            items[itemKey] = nextMenuVisibilitySettings.items[itemKey];
            return items;
          },
          {}
        ),
      },
    });

    showToast(
      "success",
      "하위 메뉴 설정을 저장했습니다",
      resolvedItemKeysToSave.length > 1
        ? `하위 메뉴 ${resolvedItemKeysToSave.length}개의 정렬 및 설정이 반영되었습니다.`
        : `${menuVisibilitySettings.items[key]?.label ?? definition?.label ?? key} 메뉴 설정이 반영되었습니다.`
    );

    return true;
  };

  const openMenuCategoryEditor = (key: MenuVisibilityKey) => {
    setEditingMenuCategoryKeys((current) =>
      current.includes(key) ? current : [...current, key]
    );
  };

  const closeMenuCategoryEditor = (key: MenuVisibilityKey) => {
    setEditingMenuCategoryKeys((current) => current.filter((itemKey) => itemKey !== key));
  };

  const cancelMenuCategoryEdit = (key: MenuVisibilityKey) => {
    restoreMenuCategoryDraft(key);
    clearMenuCategoryLabelDraft(key);
    closeMenuCategoryEditor(key);
  };

  const saveMenuCategoryEdit = async (key: MenuVisibilityKey) => {
    const didSave = await handleMenuCategorySave(key, menuCategoryLabelDrafts[key]);

    if (didSave) {
      clearMenuCategoryLabelDraft(key);
      closeMenuCategoryEditor(key);
    }
  };

  const openMenuItemEditor = (key: MenuVisibilityItemKey) => {
    setActiveMenuItemEditorKey(key);
  };

  const closeMenuItemEditor = () => {
    setActiveMenuItemEditorKey(null);
  };

  const cancelMenuItemEdit = (key: MenuVisibilityItemKey) => {
    if (isCustomMenuVisibilityItemKey(key) && !isSavedMenuItemKey(key)) {
      removeMenuItemDraft(key);
      clearMenuItemDrafts(key);
      closeMenuItemEditor();
      return;
    }

    const currentParentKey = getMenuVisibilityItemParentKey(key, menuVisibilitySettings);
    const savedParentKey = getMenuVisibilityItemParentKey(key, savedMenuVisibilitySettings);
    const relevantParentKeys = [currentParentKey, savedParentKey].filter(
      (parentKey): parentKey is MenuVisibilityKey => parentKey !== null
    );
    const siblingItems = Array.from(
      new Set([
        ...getMenuVisibilityItemKeys(menuVisibilitySettings),
        ...getMenuVisibilityItemKeys(savedMenuVisibilitySettings),
      ])
    ).filter((itemKey) => {
      const currentItemParentKey = getMenuVisibilityItemParentKey(itemKey, menuVisibilitySettings);
      const savedItemParentKey = getMenuVisibilityItemParentKey(itemKey, savedMenuVisibilitySettings);

      return (
        (currentItemParentKey !== null && relevantParentKeys.includes(currentItemParentKey)) ||
        (savedItemParentKey !== null && relevantParentKeys.includes(savedItemParentKey))
      );
    }).reduce<
      Partial<Record<MenuVisibilityItemKey, MenuVisibilitySettings["items"][MenuVisibilityItemKey]>>
    >((items, itemKey) => {
      items[itemKey] = savedMenuVisibilitySettings.items[itemKey];
      return items;
    }, {});

    restoreMenuItemDrafts(
      Object.keys(siblingItems).length > 0
        ? siblingItems
        : {
            [key]: savedMenuVisibilitySettings.items[key],
          }
    );
    clearMenuItemDrafts(key);
    closeMenuItemEditor();
  };

  const saveMenuItemEdit = async (key: MenuVisibilityItemKey) => {
    const didSave = await handleMenuItemSave(
      key,
      menuItemLabelDrafts[key],
      menuItemHrefDrafts[key]
    );

    if (didSave) {
      clearMenuItemDrafts(key);
      closeMenuItemEditor();
    }
  };

  const deleteMenuItem = async (key: MenuVisibilityItemKey) => {
    if (isCustomMenuVisibilityItemKey(key) && !isSavedMenuItemKey(key)) {
      removeMenuItemDraft(key);
      clearMenuItemDrafts(key);
      closeMenuItemEditor();
      return;
    }

    updateMenuItemDraft(key, {
      visible: false,
      enabled: false,
      ...(isCustomMenuVisibilityItemKey(key) ? { archived: true } : {}),
    });

    const didSave = await handleMenuItemSave(key);

    if (didSave) {
      clearMenuItemDrafts(key);
      closeMenuItemEditor();
    }
  };

  const activeMenuItemResolved = activeMenuItemEditorKey
    ? getMenuVisibilityResolvedItem(activeMenuItemEditorKey, menuVisibilitySettings)
    : null;
  const activeMenuItemSettings = activeMenuItemEditorKey
    ? menuVisibilityItems[activeMenuItemEditorKey]
    : null;
  const isActiveCustomMenuItem = activeMenuItemEditorKey
    ? isCustomMenuVisibilityItemKey(activeMenuItemEditorKey)
    : false;
  const isActiveNewCustomMenuItem = activeMenuItemEditorKey
    ? isActiveCustomMenuItem && !isSavedMenuItemKey(activeMenuItemEditorKey)
    : false;
  const activeMenuItemParentKey = activeMenuItemEditorKey
    ? getMenuVisibilityItemParentKey(activeMenuItemEditorKey, menuVisibilitySettings)
    : null;
  const activeMenuItemSiblingDefinitions = activeMenuItemParentKey
    ? getMenuVisibilityItemsForCategory(menuVisibilitySettings, activeMenuItemParentKey).sort(
        (left, right) =>
          menuVisibilityItems[left.key].order - menuVisibilityItems[right.key].order
      )
    : [];
  const activeMenuItemIndex = activeMenuItemEditorKey
    ? activeMenuItemSiblingDefinitions.findIndex(
        (item) => item.key === activeMenuItemEditorKey
      )
    : -1;
  const activeMenuItemParentLabel = activeMenuItemParentKey
    ? menuVisibilitySettings.categories[activeMenuItemParentKey].label
    : "";
  const activeMenuItemLabelValue =
    activeMenuItemEditorKey && menuItemLabelDrafts[activeMenuItemEditorKey] !== undefined
      ? menuItemLabelDrafts[activeMenuItemEditorKey] ?? ""
      : activeMenuItemSettings?.label ?? "";
  const activeMenuItemHrefValue =
    activeMenuItemEditorKey && menuItemHrefDrafts[activeMenuItemEditorKey] !== undefined
      ? menuItemHrefDrafts[activeMenuItemEditorKey] ?? ""
      : activeMenuItemSettings?.href ?? "";
  const isActiveMenuItemSaving = activeMenuItemEditorKey
    ? menuVisibilitySavingKey === getItemSavingStateKey(activeMenuItemEditorKey)
    : false;
  const isActiveMenuItemDirty = activeMenuItemEditorKey
    ? hasMenuItemChanges(activeMenuItemEditorKey) ||
      activeMenuItemLabelValue !== (activeMenuItemSettings?.label ?? "") ||
      activeMenuItemHrefValue !== (activeMenuItemSettings?.href ?? "")
    : false;
  const isActiveMenuItemNameEmpty = activeMenuItemLabelValue
    ? activeMenuItemLabelValue.trim().length === 0
    : true;
  const isActiveMenuItemHrefInvalid =
    isActiveCustomMenuItem &&
    activeMenuItemSettings !== null &&
    !activeMenuItemSettings.archived &&
    !isValidMenuItemHref(activeMenuItemHrefValue);

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
    <PageShell contentClassName="flex w-full min-w-0 max-w-[34rem] flex-col gap-4 sm:max-w-2xl lg:max-w-5xl">
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
          description="카테고리와 하위 메뉴의 노출 여부, 진입 권한, 글 작성 권한, 이름, 순서를 사용자 Lv 기준으로 직접 편집합니다."
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
            <div className="mt-4 space-y-3">
              {sortedMenuDefinitions.map((item, itemIndex) => {
                const categorySettings = menuVisibilitySettings.categories[item.key];
                const categoryLabelValue =
                  menuCategoryLabelDrafts[item.key] !== undefined
                    ? menuCategoryLabelDrafts[item.key] ?? ""
                    : categorySettings.label;
                const isSaving =
                  menuVisibilitySavingKey === getCategorySavingStateKey(item.key);
                const isEditingCategory = editingMenuCategoryKeys.includes(item.key);
                const isDirty =
                  hasMenuCategoryChanges(item.key) || categoryLabelValue !== categorySettings.label;
                const isCategoryNameEmpty = categoryLabelValue.trim().length === 0;
                const showCategoryWriteAccess = hasWritableMenuChildren(
                  item.key,
                  menuVisibilitySettings
                );
                const sortedChildItems = getMenuVisibilityItemsForCategory(
                  menuVisibilitySettings,
                  item.key
                ).sort(
                  (left, right) =>
                    menuVisibilityItems[left.key].order - menuVisibilityItems[right.key].order
                );

                return (
                  <div key={item.key} className="space-y-3">
                    <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="theme-kicker text-[11px] tracking-[0.18em]">카테고리</p>
                        {isEditingCategory ? (
                          <label className="mt-2 block max-w-md">
                            <input
                              type="text"
                              maxLength={40}
                              value={categoryLabelValue}
                              disabled={isSaving}
                              onChange={(event) =>
                                updateMenuCategoryLabelDraft(item.key, event.target.value)
                              }
                              className="w-full px-3 py-2 text-sm"
                            />
                          </label>
                        ) : (
                          <p className="theme-heading mt-2 text-sm font-semibold leading-relaxed sm:text-base">
                            {categorySettings.label}
                          </p>
                        )}
                      </div>

                      <div className="flex w-full flex-wrap items-center gap-2 self-start sm:w-auto sm:justify-end">
                        {isEditingCategory ? (
                          <>
                            <MenuMiniButton
                              label="취소"
                              onClick={() => cancelMenuCategoryEdit(item.key)}
                              disabled={isSaving}
                              className="w-full sm:w-auto"
                            />
                            <MenuMiniButton
                              label={isSaving ? "저장 중" : "저장"}
                              onClick={() => {
                                void saveMenuCategoryEdit(item.key);
                              }}
                              disabled={isSaving || isCategoryNameEmpty || !isDirty}
                              tone="solid"
                              className="w-full sm:w-auto"
                            />
                          </>
                        ) : (
                          <>
                            <MenuMiniButton
                              label="메뉴 추가"
                              onClick={() => openNewMenuItemEditor(item.key)}
                              tone="solid"
                              className="w-full sm:w-auto"
                            />
                            <MenuMiniButton
                              label="수정"
                              onClick={() => openMenuCategoryEditor(item.key)}
                              className="w-full sm:w-auto"
                            />
                          </>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-(--border)/70 bg-[rgba(255,255,255,0.04)] px-4 py-4 sm:px-5">
                      <p className="theme-kicker text-[11px] tracking-[0.18em]">하위 메뉴</p>
                      {sortedChildItems.length ? (
                        <div className="mt-3 space-y-2 border-l border-(--accent)/40 pl-4">
                          {sortedChildItems.map((childItem) => {
                            const childSettings = menuVisibilityItems[childItem.key];

                            return (
                              <div
                                key={childItem.key}
                                className="rounded-xl border border-(--border)/60 bg-[rgba(255,255,255,0.03)] px-3 py-3"
                              >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="min-w-0 flex-1">
                                    <p className="theme-heading text-sm font-medium leading-relaxed">
                                      {childSettings.label}
                                    </p>
                                  </div>

                                  <div className="flex w-full flex-wrap items-center gap-2 self-start sm:w-auto sm:self-center sm:justify-end">
                                    <MenuMiniButton
                                      label="수정"
                                      onClick={() => openMenuItemEditor(childItem.key)}
                                      className="w-full sm:w-auto"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="theme-copy mt-3 text-sm leading-relaxed">
                          등록된 하위 메뉴가 없습니다.
                        </p>
                      )}
                    </div>

                    <div className="hidden">
                      <div className="flex items-center gap-2 self-start">
                        {isDirty ? (
                          <span className="theme-copy rounded-full border border-[rgba(244,176,75,0.34)] bg-[rgba(244,176,75,0.12)] px-2.5 py-1 text-[11px] font-semibold">
                            저장 필요
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleMenuCategorySave(item.key)}
                          disabled={menuVisibilitySavingKey !== null || !isDirty}
                          className="retro-button-solid min-h-10 px-4 py-2 text-xs font-semibold disabled:opacity-50"
                        >
                          {isSaving ? "저장 중..." : "카테고리 저장"}
                        </button>
                      </div>

                      <div>
                        <div className="hidden">
                          <span className="theme-chip-subtle px-3 py-1.5 text-[11px] sm:text-xs">
                            {categorySettings.visible ? "표시" : "숨김"}
                          </span>
                          <span className="theme-chip-subtle px-3 py-1.5 text-[11px] sm:text-xs">
                            {categorySettings.enabled ? "사용 중" : "사용 중지"}
                          </span>
                          <span className="theme-chip-subtle px-3 py-1.5 text-[11px] sm:text-xs">
                            진입: {getMenuAccessLevelLabel(categorySettings.access_level)}
                          </span>
                          {showCategoryWriteAccess ? (
                            <span className="theme-chip-subtle px-3 py-1.5 text-[11px] sm:text-xs">
                              작성: {getMenuWriteAccessLevelLabel(categorySettings.write_access_level)}
                            </span>
                          ) : null}
                          <span className="theme-chip-subtle px-3 py-1.5 text-[11px] sm:text-xs">
                            하위 메뉴 {sortedChildItems.length}개
                          </span>
                        </div>

                        <div className="hidden">
                          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            <label className="flex flex-col gap-2">
                              <span className="theme-heading text-xs font-semibold">카테고리 이름</span>
                              <input
                                type="text"
                                maxLength={40}
                                value={categorySettings.label}
                                disabled={menuVisibilitySavingKey !== null}
                                onChange={(event) =>
                                  updateMenuCategoryDraft(item.key, { label: event.target.value })
                                }
                                className="w-full px-3 py-2.5 text-sm"
                              />
                            </label>

                            <MenuOrderMoveField
                              position={itemIndex}
                              canMoveUp={itemIndex > 0}
                              canMoveDown={itemIndex < sortedMenuDefinitions.length - 1}
                              disabled={menuVisibilitySavingKey !== null}
                              onMoveUp={() => moveMenuCategoryDraft(item.key, "up")}
                              onMoveDown={() => moveMenuCategoryDraft(item.key, "down")}
                            />

                            <MenuSelectField
                              label="진입 권한"
                              value={categorySettings.access_level}
                              disabled={menuVisibilitySavingKey !== null}
                              options={MENU_ACCESS_LEVEL_SELECT_OPTIONS}
                              className="sm:col-span-2 xl:col-span-3"
                              onChange={(nextValue) =>
                                updateMenuCategoryDraft(item.key, {
                                  access_level: nextValue,
                                })
                              }
                            />

                            {showCategoryWriteAccess ? (
                              <MenuSelectField
                                label="글 작성 권한"
                                value={categorySettings.write_access_level}
                                disabled={menuVisibilitySavingKey !== null}
                                options={MENU_WRITE_ACCESS_LEVEL_SELECT_OPTIONS}
                                onChange={(nextValue) =>
                                  updateMenuCategoryDraft(item.key, {
                                    write_access_level: nextValue as MenuWriteAccessLevel,
                                  })
                                }
                              />
                            ) : null}

                            <MenuSelectField
                              label="표시"
                              value={String(categorySettings.visible) as "true" | "false"}
                              disabled={menuVisibilitySavingKey !== null}
                              options={MENU_VISIBLE_SELECT_OPTIONS}
                              onChange={(nextValue) =>
                                updateMenuCategoryDraft(item.key, {
                                  visible: nextValue === "true",
                                })
                              }
                            />

                            <MenuSelectField
                              label="사용"
                              value={String(categorySettings.enabled) as "true" | "false"}
                              disabled={menuVisibilitySavingKey !== null}
                              options={MENU_ENABLED_SELECT_OPTIONS}
                              onChange={(nextValue) =>
                                updateMenuCategoryDraft(item.key, {
                                  enabled: nextValue === "true",
                                })
                              }
                            />
                          </div>

                          {sortedChildItems.length ? (
                            <div className="mt-4 space-y-3 border-t border-(--border)/70 pt-4">
                              {sortedChildItems.map((childItem, childIndex) => {
                                const childSettings = menuVisibilityItems[childItem.key];
                                const isChildSaving =
                                  menuVisibilitySavingKey === getItemSavingStateKey(childItem.key);
                                const isChildDirty = hasMenuItemChanges(childItem.key);

                                return (
                                  <div
                                    key={childItem.key}
                                    className="rounded-2xl border border-(--border)/70 bg-[rgba(255,255,255,0.04)] px-3 py-3.5"
                                  >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                      <div className="min-w-0 space-y-1">
                                        <p className="theme-heading text-sm font-semibold leading-relaxed">
                                          {childSettings.label}
                                        </p>
                                        <p className="theme-copy text-[11px] leading-relaxed sm:text-xs">
                                          {childItem.description}
                                        </p>
                                        <p className="theme-copy text-[11px] uppercase tracking-[0.18em]">
                                          key: {childItem.key}
                                        </p>
                                      </div>

                                      <div className="flex items-center gap-2 self-start">
                                        {isChildDirty ? (
                                          <span className="theme-copy rounded-full border border-[rgba(244,176,75,0.34)] bg-[rgba(244,176,75,0.12)] px-2.5 py-1 text-[11px] font-semibold">
                                            저장 필요
                                          </span>
                                        ) : null}
                                        <button
                                          type="button"
                                          onClick={() => void handleMenuItemSave(childItem.key)}
                                          disabled={menuVisibilitySavingKey !== null || !isChildDirty}
                                          className="retro-button min-h-10 px-4 py-2 text-xs font-semibold disabled:opacity-50"
                                        >
                                          {isChildSaving ? "저장 중..." : "하위 메뉴 저장"}
                                        </button>
                                      </div>
                                    </div>

                                    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                      <label className="flex flex-col gap-2">
                                        <span className="theme-heading text-xs font-semibold">메뉴 이름</span>
                                        <input
                                          type="text"
                                          maxLength={40}
                                          value={childSettings.label}
                                          disabled={menuVisibilitySavingKey !== null}
                                          onChange={(event) =>
                                            updateMenuItemDraft(childItem.key, {
                                              label: event.target.value,
                                            })
                                          }
                                          className="w-full px-3 py-2.5 text-sm"
                                        />
                                      </label>

                                      <MenuOrderMoveField
                                        position={childIndex}
                                        canMoveUp={childIndex > 0}
                                        canMoveDown={childIndex < sortedChildItems.length - 1}
                                        disabled={menuVisibilitySavingKey !== null}
                                        onMoveUp={() => moveMenuItemDraft(childItem.key, "up")}
                                        onMoveDown={() => moveMenuItemDraft(childItem.key, "down")}
                                      />

                                      <MenuSelectField
                                        label="진입 권한"
                                        value={childSettings.access_level}
                                        disabled={menuVisibilitySavingKey !== null}
                                        options={MENU_ACCESS_LEVEL_SELECT_OPTIONS}
                                        className="sm:col-span-2 xl:col-span-3"
                                        onChange={(nextValue) =>
                                          updateMenuItemDraft(childItem.key, {
                                            access_level: nextValue,
                                          })
                                        }
                                      />

                                      {childItem.supportsWriteAccess ? (
                                        <MenuSelectField
                                          label="글 작성 권한"
                                          value={childSettings.write_access_level}
                                          disabled={menuVisibilitySavingKey !== null}
                                          options={MENU_WRITE_ACCESS_LEVEL_SELECT_OPTIONS}
                                          onChange={(nextValue) =>
                                            updateMenuItemDraft(childItem.key, {
                                              write_access_level: nextValue as MenuWriteAccessLevel,
                                            })
                                          }
                                        />
                                      ) : null}

                                      <MenuSelectField
                                        label="표시"
                                        value={String(childSettings.visible) as "true" | "false"}
                                        disabled={menuVisibilitySavingKey !== null}
                                        options={MENU_VISIBLE_SELECT_OPTIONS}
                                        onChange={(nextValue) =>
                                          updateMenuItemDraft(childItem.key, {
                                            visible: nextValue === "true",
                                          })
                                        }
                                      />

                                      <MenuSelectField
                                        label="사용"
                                        value={String(childSettings.enabled) as "true" | "false"}
                                        disabled={menuVisibilitySavingKey !== null}
                                        options={MENU_ENABLED_SELECT_OPTIONS}
                                        onChange={(nextValue) =>
                                          updateMenuItemDraft(childItem.key, {
                                            enabled: nextValue === "true",
                                          })
                                        }
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
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
                              className="flex w-full items-center gap-2 text-left"
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

      {activeMenuItemEditorKey && activeMenuItemSettings && activeMenuItemResolved ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-4 sm:items-center sm:px-6 sm:py-6">
          <button
            type="button"
            aria-label="하위 메뉴 수정 팝업 닫기"
            onClick={() => cancelMenuItemEdit(activeMenuItemEditorKey)}
            className="absolute inset-0 bg-[rgba(7,10,18,0.7)] backdrop-blur-sm"
          />

          <div className="retro-panel relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col gap-4 overflow-hidden rounded-[28px] px-4 py-4 sm:max-h-[calc(100dvh-3rem)] sm:px-6 sm:py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="theme-kicker text-[11px] tracking-[0.18em]">
                  {isActiveNewCustomMenuItem ? "메뉴 추가" : "하위 메뉴 수정"}
                </p>
                <p className="theme-heading mt-2 text-base font-semibold leading-relaxed sm:text-lg">
                  {activeMenuItemLabelValue || activeMenuItemResolved.label}
                </p>
                <p className="theme-copy mt-2 text-sm leading-relaxed">
                  상위 카테고리: {activeMenuItemParentLabel}
                </p>
                {isActiveCustomMenuItem ? (
                  <p className="theme-copy mt-2 text-xs leading-relaxed">
                    새 메뉴는 메뉴 이름, 연결 경로, 진입 권한, 표시 상태를 초기값부터 바로 설정할 수 있습니다.
                  </p>
                ) : null}
              </div>

              <MenuMiniButton
                label="닫기"
                onClick={() => cancelMenuItemEdit(activeMenuItemEditorKey)}
                disabled={isActiveMenuItemSaving}
                className="w-full sm:w-auto"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2 rounded-2xl border border-(--border)/70 bg-[rgba(255,255,255,0.05)] px-3 py-3 sm:col-span-2">
                  <span className="theme-heading text-xs font-semibold">메뉴 이름 수정</span>
                  <input
                    type="text"
                    maxLength={40}
                    value={activeMenuItemLabelValue}
                    disabled={isActiveMenuItemSaving}
                    onChange={(event) =>
                      updateMenuItemLabelDraft(activeMenuItemEditorKey, event.target.value)
                    }
                    className="w-full px-3 py-2.5 text-sm"
                  />
                </label>

                {isActiveCustomMenuItem ? (
                  <label className="flex flex-col gap-2 rounded-2xl border border-(--border)/70 bg-[rgba(255,255,255,0.05)] px-3 py-3 sm:col-span-2">
                    <span className="theme-heading text-xs font-semibold">연결 경로</span>
                    <input
                      type="text"
                      maxLength={240}
                      value={activeMenuItemHrefValue}
                      disabled={isActiveMenuItemSaving}
                      onChange={(event) =>
                        updateMenuItemHrefDraft(activeMenuItemEditorKey, event.target.value)
                      }
                      placeholder="/dashboard 또는 https://example.com"
                      className="w-full px-3 py-2.5 text-sm"
                    />
                    <p className="theme-copy text-xs leading-relaxed">
                      내부 페이지는 /로 시작하고, 외부 링크는 http 또는 https 주소를 입력해주세요.
                    </p>
                    {isActiveMenuItemHrefInvalid ? (
                      <p className="text-xs font-semibold text-[rgba(255,120,120,0.95)]">
                        저장하려면 연결 경로를 올바르게 입력해야 합니다.
                      </p>
                    ) : null}
                  </label>
                ) : null}

                  <div className="sm:col-span-2">
                    <MenuSelectField
                      label="카테고리 이동"
                      value={activeMenuItemSettings.parent_key}
                      disabled={isActiveMenuItemSaving}
                      options={menuCategorySelectOptions}
                      onChange={(nextValue) =>
                        moveMenuItemToCategoryDraft(activeMenuItemEditorKey, nextValue as MenuVisibilityKey)
                      }
                    />
                  </div>

                <div className="sm:col-span-2">
                  <MenuSelectField
                    label="메뉴 진입 권한"
                    value={activeMenuItemSettings.access_level}
                    disabled={isActiveMenuItemSaving}
                    options={MENU_ACCESS_LEVEL_SELECT_OPTIONS}
                    onChange={(nextValue) =>
                      updateMenuItemDraft(activeMenuItemEditorKey, {
                        access_level: nextValue,
                      })
                    }
                  />
                  <p className="theme-copy mt-2 px-1 text-xs leading-relaxed">
                    현재 구조에서는 메뉴를 볼 수 있는 권한도 이 진입 권한과 동일하게 적용됩니다.
                  </p>
                </div>

                <MenuToggleField
                  label="메뉴 보이기 / 숨기기"
                  value={activeMenuItemSettings.visible}
                  disabled={isActiveMenuItemSaving}
                  trueLabel="보이기"
                  falseLabel="숨기기"
                  onChange={(nextValue) =>
                    updateMenuItemDraft(activeMenuItemEditorKey, {
                      visible: nextValue,
                    })
                  }
                />

                <MenuToggleField
                  label="메뉴 사용 상태"
                  value={activeMenuItemSettings.enabled}
                  disabled={isActiveMenuItemSaving}
                  trueLabel="사용"
                  falseLabel="중지"
                  onChange={(nextValue) =>
                    updateMenuItemDraft(activeMenuItemEditorKey, {
                      enabled: nextValue,
                    })
                  }
                />

                <div className="sm:col-span-2">
                  <MenuOrderMoveField
                    position={Math.max(activeMenuItemIndex, 0)}
                    canMoveUp={activeMenuItemIndex > 0}
                    canMoveDown={activeMenuItemIndex < activeMenuItemSiblingDefinitions.length - 1}
                    disabled={isActiveMenuItemSaving}
                    onMoveUp={() => moveMenuItemDraft(activeMenuItemEditorKey, "up")}
                    onMoveDown={() => moveMenuItemDraft(activeMenuItemEditorKey, "down")}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-(--border)/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    void deleteMenuItem(activeMenuItemEditorKey);
                  }}
                  disabled={isActiveMenuItemSaving}
                  className="min-h-9 w-full rounded-xl border border-[rgba(255,97,97,0.45)] bg-[rgba(255,97,97,0.12)] px-3 py-2 text-xs font-semibold text-(--text-strong) disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
                >
                  메뉴 삭제
                </button>
                <p className="theme-copy mt-2 text-xs leading-relaxed">
                  {isActiveCustomMenuItem
                    ? "직접 추가한 메뉴는 목록에서 제거되고, 기존 메뉴는 숨김 + 사용 중지 상태로 저장됩니다."
                    : "삭제를 누르면 이 메뉴는 숨김 + 사용 중지 상태로 저장됩니다."}
                </p>
              </div>

              <div className="flex w-full flex-col gap-2 self-end sm:w-auto sm:flex-row sm:self-auto">
                <MenuMiniButton
                  label="취소"
                  onClick={() => cancelMenuItemEdit(activeMenuItemEditorKey)}
                  disabled={isActiveMenuItemSaving}
                  className="w-full sm:w-auto"
                />
                <MenuMiniButton
                  label={isActiveMenuItemSaving ? "저장 중" : "저장"}
                  onClick={() => {
                    void saveMenuItemEdit(activeMenuItemEditorKey);
                  }}
                  disabled={
                    isActiveMenuItemSaving ||
                    isActiveMenuItemNameEmpty ||
                    isActiveMenuItemHrefInvalid ||
                    !isActiveMenuItemDirty
                  }
                  tone="solid"
                  className="w-full sm:w-auto"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}