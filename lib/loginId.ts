import type { User } from "@supabase/supabase-js";

export type SignupType = "driver" | "vendor";

export type UserProfileSeed = {
  loginId: string;
  driverName: string;
  phoneNumber: string;
  signupType: SignupType;
  isCoupang: boolean;
};

const LOGIN_ID_REGEX = /^[a-z0-9]{4,20}$/;
const LEGACY_LOGIN_ID_REGEX = /^[a-z0-9][a-z0-9._-]{3,19}$/;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeLoginId(value: unknown) {
  return normalizeText(value).toLowerCase();
}

export function sanitizeLoginIdInput(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20);
}

export function isValidLoginId(loginId: string) {
  return LOGIN_ID_REGEX.test(loginId);
}

export function isSupportedLoginId(loginId: string) {
  return LOGIN_ID_REGEX.test(loginId) || LEGACY_LOGIN_ID_REGEX.test(loginId);
}

export function getLoginIdValidationMessage(loginId: string) {
  if (!loginId) {
    return "ID를 입력해주세요.";
  }

  if (!isValidLoginId(loginId)) {
    return "ID는 영문 소문자와 숫자만 사용해 4~20자로 입력해주세요.";
  }

  return null;
}

export function extractUserProfileSeed(
  user: Pick<User, "user_metadata">
): UserProfileSeed {
  const metadata = user.user_metadata;
  const signupType = metadata?.signup_type === "vendor" ? "vendor" : "driver";

  return {
    loginId:
      typeof metadata?.login_id === "string"
        ? normalizeLoginId(metadata.login_id)
        : "",
    driverName:
      typeof metadata?.driver_name === "string" ? metadata.driver_name : "",
    phoneNumber:
      typeof metadata?.phone_number === "string" ? metadata.phone_number : "",
    signupType,
    isCoupang: metadata?.is_coupang !== false,
  };
}

export function hasLoginId(user: Pick<User, "user_metadata">) {
  return Boolean(extractUserProfileSeed(user).loginId);
}