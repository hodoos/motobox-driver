"use client";

import { useEffect, useState } from "react";
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
import LoginCard from "../components/auth/LoginCard";
import SignupModal from "../components/auth/SignupModal";
import ToastViewport from "../components/ui/ToastViewport";

export default function Home() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [signupEmail, setSignupEmail] = useState("");
  const [signupDriverName, setSignupDriverName] = useState("");
  const [signupPhoneNumber, setSignupPhoneNumber] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState("");
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
    setSignupDriverName("");
    setSignupEmail("");
    setSignupPhoneNumber("");
    setSignupPassword("");
    setSignupPasswordConfirm("");
    setIsSignupModalOpen(false);
  };

  const showToast = (tone: ToastState["tone"], title: string, message?: string) => {
    setToast(createToastState({ tone, title, message }));
  };

  const signUp = async () => {
    const driverName = signupDriverName.trim();
    const normalizedEmail = signupEmail.trim();
    const phoneNumber = signupPhoneNumber.trim();

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

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: signupPassword,
      options: {
        data: {
          driver_name: driverName,
          phone_number: phoneNumber,
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
      "회원가입 완료",
      data.session ? "대시보드로 이동합니다." : "이메일 인증 후 로그인해주세요."
    );
    resetSignupForm();
  };

  const signIn = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
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
    return (
      <main className="retro-scanlines retro-grid-bg min-h-[100dvh] bg-[var(--bg)] px-3 py-4 text-[var(--text)] sm:px-4 sm:py-6">
        <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-[28rem] items-center justify-center sm:min-h-[calc(100vh-3rem)]">
          <div className="retro-panel w-full rounded-[28px] px-6 py-5 text-center">
            불러오는 중...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="retro-scanlines retro-grid-bg min-h-[100dvh] bg-[var(--bg)] px-3 py-4 text-[var(--text)] sm:px-4 sm:py-6">
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} />
      <div className="relative mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-[28rem] items-center justify-center sm:min-h-[calc(100vh-3rem)]">
        <LoginCard
          email={email}
          password={password}
          setEmail={setEmail}
          setPassword={setPassword}
          onLogin={signIn}
          onOpenSignup={() => setIsSignupModalOpen(true)}
        />

        <SignupModal
          open={isSignupModalOpen}
          driverName={signupDriverName}
          email={signupEmail}
          phoneNumber={signupPhoneNumber}
          password={signupPassword}
          passwordConfirm={signupPasswordConfirm}
          setDriverName={setSignupDriverName}
          setEmail={setSignupEmail}
          setPhoneNumber={setSignupPhoneNumber}
          setPassword={setSignupPassword}
          setPasswordConfirm={setSignupPasswordConfirm}
          onClose={() => setIsSignupModalOpen(false)}
          onSubmit={signUp}
        />
      </div>
    </main>
  );
}