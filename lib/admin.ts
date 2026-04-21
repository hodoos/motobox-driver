import type { User } from "@supabase/supabase-js";
import { hasMinimumUserLevel, type UserLevel } from "./userLevel";

const ADMIN_ROLE_VALUES = new Set(["admin", "owner", "super_admin", "super-admin"]);

function normalizeRoleValue(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isLegacyAdminUser(
  user?: Pick<User, "app_metadata"> | null
) {
  if (!user) {
    return false;
  }

  const metadata = user.app_metadata ?? {};

  if (metadata.is_admin === true || metadata.admin === true) {
    return true;
  }

  const role = normalizeRoleValue(metadata.role);

  if (role && ADMIN_ROLE_VALUES.has(role)) {
    return true;
  }

  if (Array.isArray(metadata.roles)) {
    return metadata.roles.some((value) => ADMIN_ROLE_VALUES.has(normalizeRoleValue(value)));
  }

  return false;
}

export function isAdminUser(
  user?: Pick<User, "app_metadata" | "user_metadata"> | null
) {
  if (!user) {
    return false;
  }

  return isLegacyAdminUser(user) || hasMinimumUserLevel(user, "관리자Lv");
}

export function isVendorUser(
  user?: Pick<User, "app_metadata" | "user_metadata"> | null
) {
  if (!user) {
    return false;
  }

  return isLegacyAdminUser(user) || hasMinimumUserLevel(user, "벤더Lv");
}

export function isAffiliateUser(
  user?: Pick<User, "app_metadata" | "user_metadata"> | null
) {
  if (!user) {
    return false;
  }

  return isLegacyAdminUser(user) || hasMinimumUserLevel(user, "Lv3-제휴");
}

export function isOperatorUser(
  user?: Pick<User, "user_metadata"> | null
) {
  if (!user) {
    return false;
  }

  return hasMinimumUserLevel(user, "운영자Lv");
}

export function getAdminDisplayLevel(
  user?: Pick<User, "app_metadata" | "user_metadata"> | null
) {
  return isOperatorUser(user) ? "운영자Lv" : "관리자Lv";
}

export function canManageUserLevelChange(
  actor: Pick<User, "app_metadata" | "user_metadata"> | null | undefined,
  currentTargetLevel: UserLevel,
  nextTargetLevel: UserLevel
) {
  if (!isAdminUser(actor)) {
    return false;
  }

  if (isOperatorUser(actor)) {
    return true;
  }

  return currentTargetLevel !== "운영자Lv" && nextTargetLevel !== "운영자Lv";
}