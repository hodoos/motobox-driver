import type { User } from "@supabase/supabase-js";

export const USER_LEVEL_OPTIONS = [
  "기사Lv",
  "벤더Lv",
  "Lv3-제휴",
  "관리자Lv",
  "운영자Lv",
] as const;

export type UserLevel = (typeof USER_LEVEL_OPTIONS)[number];

export const DEFAULT_USER_LEVEL: UserLevel = "기사Lv";

const USER_LEVEL_RANK: Record<UserLevel, number> = {
  기사Lv: 0,
  벤더Lv: 1,
  "Lv3-제휴": 2,
  관리자Lv: 3,
  운영자Lv: 4,
};

export function isUserLevel(value: unknown): value is UserLevel {
  return (
    typeof value === "string" &&
    USER_LEVEL_OPTIONS.some((option) => option === value.trim())
  );
}

export function getUserLevel(
  user?: Pick<User, "user_metadata"> | null
): UserLevel {
  const rawLevel = user?.user_metadata?.user_level;

  if (isUserLevel(rawLevel)) {
    return rawLevel;
  }

  return DEFAULT_USER_LEVEL;
}

export function hasMinimumUserLevel(
  user: Pick<User, "user_metadata"> | null | undefined,
  minimumLevel: UserLevel
) {
  return USER_LEVEL_RANK[getUserLevel(user)] >= USER_LEVEL_RANK[minimumLevel];
}