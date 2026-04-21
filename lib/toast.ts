export type ToastTone = "success" | "error" | "info";

export type ToastPayload = {
  tone: ToastTone;
  title: string;
  message?: string;
};

export type ToastState = ToastPayload & {
  id: number;
};

const PENDING_TOAST_STORAGE_KEY = "motobox:pending-toast";

export function createToastState(payload: ToastPayload): ToastState {
  return {
    id: Date.now() + Math.random(),
    ...payload,
  };
}

export function getKoreanErrorMessage(message?: string, fallback?: string) {
  const normalizedMessage = message?.trim();

  if (!normalizedMessage) {
    return fallback ?? "문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }

  if (/invalid login credentials/i.test(normalizedMessage)) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }

  if (/email not confirmed/i.test(normalizedMessage)) {
    return "이메일 인증을 완료한 뒤 다시 로그인해주세요.";
  }

  if (/user already registered/i.test(normalizedMessage)) {
    return "이미 가입된 이메일입니다.";
  }

  if (/password should be at least/i.test(normalizedMessage)) {
    return "비밀번호는 더 길게 입력해주세요.";
  }

  if (/unable to validate email address/i.test(normalizedMessage)) {
    return "이메일 형식을 다시 확인해주세요.";
  }

  if (/signup is disabled/i.test(normalizedMessage)) {
    return "현재 회원가입이 비활성화되어 있습니다.";
  }

  if (/network request failed|failed to fetch|networkerror/i.test(normalizedMessage)) {
    return "네트워크 연결을 확인한 뒤 다시 시도해주세요.";
  }

  if (/jwt expired|token has expired/i.test(normalizedMessage)) {
    return "인증 시간이 만료되었습니다. 다시 로그인해주세요.";
  }

  if (/row-level security|permission denied/i.test(normalizedMessage)) {
    return "권한이 없어 요청을 처리할 수 없습니다.";
  }

  return fallback ?? "문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
}

export function queuePendingToast(payload: ToastPayload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(PENDING_TOAST_STORAGE_KEY, JSON.stringify(payload));
}

export function consumePendingToast(): ToastPayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawToast = window.sessionStorage.getItem(PENDING_TOAST_STORAGE_KEY);

  if (!rawToast) {
    return null;
  }

  window.sessionStorage.removeItem(PENDING_TOAST_STORAGE_KEY);

  try {
    const parsed = JSON.parse(rawToast);

    if (
      !parsed ||
      (parsed.tone !== "success" && parsed.tone !== "error" && parsed.tone !== "info") ||
      typeof parsed.title !== "string"
    ) {
      return null;
    }

    return {
      tone: parsed.tone,
      title: parsed.title,
      message: typeof parsed.message === "string" ? parsed.message : undefined,
    };
  } catch {
    return null;
  }
}