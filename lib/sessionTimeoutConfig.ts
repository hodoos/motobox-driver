export const DEFAULT_SESSION_TIMEOUT_MINUTES = 6 * 60;
export const MIN_SESSION_TIMEOUT_MINUTES = 30;
export const MAX_SESSION_TIMEOUT_MINUTES = 24 * 60;
export const SESSION_TIMEOUT_CACHE_KEY = "motobox.session.timeoutMinutes";
export const SESSION_TIMEOUT_SETTINGS_EVENT = "motobox:session-timeout-updated";

export function parseSessionTimeoutMinutes(value: unknown) {
  const parsedValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  const normalizedValue = Math.round(parsedValue);

  if (
    normalizedValue < MIN_SESSION_TIMEOUT_MINUTES ||
    normalizedValue > MAX_SESSION_TIMEOUT_MINUTES
  ) {
    return null;
  }

  return normalizedValue;
}

export function getSessionTimeoutValidationMessage(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim())
  ) {
    return "세션 타임아웃 시간을 입력해주세요.";
  }

  if (parseSessionTimeoutMinutes(value) === null) {
    return `세션 타임아웃 시간은 ${MIN_SESSION_TIMEOUT_MINUTES}분부터 ${MAX_SESSION_TIMEOUT_MINUTES}분 사이로 입력해주세요.`;
  }

  return null;
}

export function toSessionTimeoutMilliseconds(timeoutMinutes: number) {
  return timeoutMinutes * 60 * 1000;
}

export function formatSessionTimeoutMinutes(timeoutMinutes: number) {
  const hours = Math.floor(timeoutMinutes / 60);
  const minutes = timeoutMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}시간 ${minutes}분`;
  }

  if (hours > 0) {
    return `${hours}시간`;
  }

  return `${minutes}분`;
}

export function readCachedSessionTimeoutMinutes() {
  if (typeof window === "undefined") {
    return null;
  }

  return parseSessionTimeoutMinutes(
    window.localStorage.getItem(SESSION_TIMEOUT_CACHE_KEY)
  );
}

export function writeCachedSessionTimeoutMinutes(timeoutMinutes: number) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedMinutes = parseSessionTimeoutMinutes(timeoutMinutes);

  if (normalizedMinutes === null) {
    return;
  }

  window.localStorage.setItem(
    SESSION_TIMEOUT_CACHE_KEY,
    String(normalizedMinutes)
  );
  window.dispatchEvent(new Event(SESSION_TIMEOUT_SETTINGS_EVENT));
}