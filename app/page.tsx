"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import {
  consumePendingToast,
  createToastState,
  getKoreanErrorMessage,
  queuePendingToast,
  ToastState,
} from "../lib/toast";
import {
  ensureDriverSettingsRow,
  extractDriverProfileSeed,
} from "../lib/driverSettings";
import {
  getLoginIdValidationMessage,
  normalizeLoginId,
  type SignupType,
} from "../lib/loginId";
import { DEFAULT_USER_LEVEL } from "../lib/userLevel";
import LoginCard from "../components/auth/LoginCard";
import PageShell, { PageLoadingShell } from "../components/layout/PageShell";
import SignupModal from "../components/auth/SignupModal";
import ToastViewport from "../components/ui/ToastViewport";

const SAVED_LOGIN_STORAGE_KEY = "driver-platform.saved-login";
const SAVED_LOGIN_STORAGE_EVENT = "driver-platform:saved-login";

function parseSavedLogin(raw: string | null) {
  try {
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as {
      identifier?: unknown;
      password?: unknown;
    };

    if (
      typeof parsed.identifier !== "string" ||
      typeof parsed.password !== "string" ||
      !parsed.identifier.trim() ||
      !parsed.password
    ) {
      return null;
    }

    return {
      identifier: parsed.identifier,
      password: parsed.password,
    };
  } catch {
    return null;
  }
}

function readSavedLoginSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(SAVED_LOGIN_STORAGE_KEY);
}

function writeSavedLogin(identifier: string, password: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    SAVED_LOGIN_STORAGE_KEY,
    JSON.stringify({ identifier, password })
  );
  window.dispatchEvent(new Event(SAVED_LOGIN_STORAGE_EVENT));
}

function clearSavedLogin() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SAVED_LOGIN_STORAGE_KEY);
  window.dispatchEvent(new Event(SAVED_LOGIN_STORAGE_EVENT));
}

function subscribeSavedLogin(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleSavedLoginChange = () => {
    onStoreChange();
  };

  window.addEventListener("storage", handleSavedLoginChange);
  window.addEventListener(SAVED_LOGIN_STORAGE_EVENT, handleSavedLoginChange);

  return () => {
    window.removeEventListener("storage", handleSavedLoginChange);
    window.removeEventListener(SAVED_LOGIN_STORAGE_EVENT, handleSavedLoginChange);
  };
}

function getSignupEmailRedirectUrl() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.location.origin}/auth/confirm`;
}

export default function Home() {
  const router = useRouter();
  const savedLoginSnapshot = useSyncExternalStore(
    subscribeSavedLogin,
    readSavedLoginSnapshot,
    () => null
  );
  const savedLogin = parseSavedLogin(savedLoginSnapshot);

  const [identifierDraft, setIdentifierDraft] = useState<string | null>(null);
  const [passwordDraft, setPasswordDraft] = useState<string | null>(null);
  const [rememberCredentialsDraft, setRememberCredentialsDraft] = useState<boolean | null>(null);

  const identifier = identifierDraft ?? savedLogin?.identifier ?? "";
  const password = passwordDraft ?? savedLogin?.password ?? "";
  const rememberCredentials = rememberCredentialsDraft ?? Boolean(savedLogin);

  const [signupLoginId, setSignupLoginId] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupDriverName, setSignupDriverName] = useState("");
  const [signupPhoneNumber, setSignupPhoneNumber] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState("");
  const [signupType, setSignupType] = useState<SignupType>("driver");
  const [signupIsCoupang, setSignupIsCoupang] = useState(true);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        router.replace("/dashboard");
      }

      setLoading(false);
    };

    getUser();
  }, [router]);

  useEffect(() => {
    const pendingToast = consumePendingToast();

    if (!pendingToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(createToastState(pendingToast));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const resetSignupForm = () => {
    setSignupLoginId("");
    setSignupDriverName("");
    setSignupEmail("");
    setSignupPhoneNumber("");
    setSignupPassword("");
    setSignupPasswordConfirm("");
    setSignupType("driver");
    setSignupIsCoupang(true);
    setIsSignupModalOpen(false);
  };

  const showToast = (tone: ToastState["tone"], title: string, message?: string) => {
    setToast(createToastState({ tone, title, message }));
  };

  const readApiErrorMessage = async (response: Response, fallback: string) => {
    const body = await response.json().catch(() => null);

    if (body && typeof body.error === "string") {
      return body.error;
    }

    return fallback;
  };

  const openSignupModal = () => {
    setSignupType("driver");
    setSignupIsCoupang(true);
    setIsSignupModalOpen(true);
  };

  const handleSignupTypeChange = (nextType: SignupType) => {
    setSignupType(nextType);

    if (nextType === "vendor") {
      showToast(
        "info",
        "벤더 회원 안내",
        "벤더 회원은 문의하기 버튼을 눌러 문의주세요"
      );
    }
  };

  const handleSignupCoupangCheckedChange = (nextChecked: boolean) => {
    if (!nextChecked) {
      showToast(
        "info",
        "소속 선택 필요",
        "소속은 최소 1개 이상 선택해야 합니다."
      );
      return;
    }

    setSignupIsCoupang(true);
  };

  const handleRememberCredentialsChange = (nextChecked: boolean) => {
    setRememberCredentialsDraft(nextChecked);

    if (!nextChecked) {
      clearSavedLogin();
    }
  };

  const signUp = async () => {
    const normalizedLoginId = normalizeLoginId(signupLoginId);
    const driverName = signupDriverName.trim();
    const normalizedEmail = signupEmail.trim();
    const phoneNumber = signupPhoneNumber.trim();

    const loginIdValidationMessage = getLoginIdValidationMessage(normalizedLoginId);

    if (loginIdValidationMessage) {
      showToast("error", "ID를 확인해주세요", loginIdValidationMessage);
      return;
    }

    if (
      !driverName ||
      !normalizedEmail ||
      !signupPassword ||
      !signupPasswordConfirm ||
      !phoneNumber
    ) {
      showToast(
        "error",
        "회원가입 정보를 확인해주세요",
        "이름, 이메일, 비밀번호, 비밀번호 확인, 휴대폰번호를 모두 입력해주세요."
      );
      return;
    }

    if (signupPassword !== signupPasswordConfirm) {
      showToast(
        "error",
        "비밀번호가 일치하지 않습니다",
        "비밀번호와 비밀번호 확인을 다시 입력해주세요."
      );
      return;
    }

    if (!signupIsCoupang) {
      showToast(
        "error",
        "소속을 확인해주세요",
        "소속은 최소 1개 이상 선택해야 합니다."
      );
      return;
    }

    const availabilityResponse = await fetch(
      `/api/auth/login-id?value=${encodeURIComponent(normalizedLoginId)}`
    );

    if (!availabilityResponse.ok) {
      showToast(
        "error",
        "ID 확인 실패",
        await readApiErrorMessage(availabilityResponse, "ID 중복 여부를 확인하지 못했습니다.")
      );
      return;
    }

    const availabilityData = (await availabilityResponse.json()) as {
      available?: boolean;
    };

    if (!availabilityData.available) {
      showToast("error", "이미 사용 중인 ID입니다.", "다른 ID를 입력해주세요.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: signupPassword,
      options: {
        emailRedirectTo: getSignupEmailRedirectUrl(),
        data: {
          login_id: normalizedLoginId,
          driver_name: driverName,
          phone_number: phoneNumber,
          user_level: DEFAULT_USER_LEVEL,
          signup_type: signupType,
          is_coupang: signupIsCoupang,
        },
      },
    });

    if (error) {
      showToast(
        "error",
        "회원가입 실패",
        getKoreanErrorMessage(error.message, "회원가입 중 문제가 발생했습니다.")
      );
      return;
    }

    if (data.user && data.session) {
      const { error: settingsError } = await ensureDriverSettingsRow(data.user.id, {
        driverName,
        phoneNumber,
      });

      if (settingsError) {
        queuePendingToast({
          tone: "error",
          title: "회원가입은 완료됐지만 추가 정보를 저장하지 못했습니다",
          message: getKoreanErrorMessage(
            settingsError.message,
            "추가 정보를 저장하지 못했습니다. 설정 화면에서 다시 확인해주세요."
          ),
        });
      } else {
        queuePendingToast({
          tone: "success",
          title: "회원가입 완료",
          message: "대시보드로 이동합니다.",
        });
      }

      resetSignupForm();
      router.replace("/dashboard");
      return;
    }

    showToast(
      "success",
      data.session ? "회원가입 완료" : "인증 메일을 보냈습니다",
      data.session
        ? "대시보드로 이동합니다."
        : "이메일의 인증 링크를 누르면 대시보드로 이동합니다."
    );
    resetSignupForm();
  };

  const signIn = async () => {
    const normalizedIdentifier = identifier.trim();

    if (!normalizedIdentifier || !password) {
      showToast("error", "로그인 실패", "ID와 비밀번호를 입력해주세요.");
      return;
    }

    const resolveResponse = await fetch("/api/auth/login-id", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ identifier: normalizedIdentifier }),
    });

    if (!resolveResponse.ok) {
      showToast(
        "error",
        "로그인 실패",
        await readApiErrorMessage(resolveResponse, "로그인 정보를 다시 확인해주세요.")
      );
      return;
    }

    const resolvedLogin = (await resolveResponse.json()) as { email: string };
    const { data, error } = await supabase.auth.signInWithPassword({
      email: resolvedLogin.email,
      password,
    });

    if (error) {
      showToast(
        "error",
        "로그인 실패",
        getKoreanErrorMessage(error.message, "로그인 정보를 다시 확인해주세요.")
      );
      return;
    }

    if (data.user) {
      if (rememberCredentials) {
        writeSavedLogin(normalizedIdentifier, password);
      } else {
        clearSavedLogin();
      }

      const { error: settingsError } = await ensureDriverSettingsRow(
        data.user.id,
        extractDriverProfileSeed(data.user)
      );

      if (settingsError) {
        queuePendingToast({
          tone: "error",
          title: "로그인은 완료됐지만 사용자 정보를 불러오지 못했습니다",
          message: getKoreanErrorMessage(
            settingsError.message,
            "사용자 추가 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
          ),
        });
      } else {
        queuePendingToast({
          tone: "success",
          title: "로그인 성공",
          message: "대시보드로 이동합니다.",
        });
      }

      router.replace("/dashboard");
      return;
    }

    showToast("success", "로그인 성공", "대시보드로 이동합니다.");
  };

  if (loading) {
    return <PageLoadingShell message="불러오는 중..." />;
  }

  return (
    <PageShell contentClassName="relative flex flex-1 w-full max-w-[23.5rem] items-center justify-center px-2 sm:max-w-[24.5rem]">
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} />
      <div className="relative flex w-full items-center justify-center">
        <LoginCard
          identifier={identifier}
          password={password}
          rememberCredentials={rememberCredentials}
          setIdentifier={setIdentifierDraft}
          setPassword={setPasswordDraft}
          onRememberCredentialsChange={handleRememberCredentialsChange}
          onLogin={signIn}
          onOpenSignup={openSignupModal}
        />

        <SignupModal
          open={isSignupModalOpen}
          loginId={signupLoginId}
          driverName={signupDriverName}
          email={signupEmail}
          phoneNumber={signupPhoneNumber}
          password={signupPassword}
          passwordConfirm={signupPasswordConfirm}
          signupType={signupType}
          isCoupangChecked={signupIsCoupang}
          setLoginId={setSignupLoginId}
          setDriverName={setSignupDriverName}
          setEmail={setSignupEmail}
          setPhoneNumber={setSignupPhoneNumber}
          setPassword={setSignupPassword}
          setPasswordConfirm={setSignupPasswordConfirm}
          setSignupType={handleSignupTypeChange}
          setIsCoupangChecked={handleSignupCoupangCheckedChange}
          onClose={() => setIsSignupModalOpen(false)}
          onSubmit={signUp}
        />
      </div>
    </PageShell>
  );
}