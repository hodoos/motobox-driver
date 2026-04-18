"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import {
  ensureDriverSettingsRow,
  extractDriverProfileSeed,
} from "../lib/driverSettings";
import LoginCard from "../components/auth/LoginCard";
import SignupModal from "../components/auth/SignupModal";

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

  const resetSignupForm = () => {
    setSignupDriverName("");
    setSignupEmail("");
    setSignupPhoneNumber("");
    setSignupPassword("");
    setSignupPasswordConfirm("");
    setIsSignupModalOpen(false);
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
      alert("이름, 이메일, 비밀번호, 비밀번호 확인, 휴대폰번호를 모두 입력해주세요.");
      return;
    }

    if (signupPassword !== signupPasswordConfirm) {
      alert("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
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
      alert(error.message);
      return;
    }

    if (data.user && data.session) {
      const { error: settingsError } = await ensureDriverSettingsRow(data.user.id, {
        driverName,
        phoneNumber,
      });

      if (settingsError) {
        alert("회원 추가 정보 저장 실패: " + settingsError.message);
      }

      router.replace("/dashboard");
    }

    alert(
      data.session
        ? "회원가입 완료"
        : "회원가입 완료. 이메일 인증 후 로그인해주세요."
    );
    resetSignupForm();
  };

  const signIn = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    if (data.user) {
      const { error: settingsError } = await ensureDriverSettingsRow(
        data.user.id,
        extractDriverProfileSeed(data.user)
      );

      if (settingsError) {
        alert("회원 추가 정보 불러오기 실패: " + settingsError.message);
      }

      router.replace("/dashboard");
    }

    alert("로그인 성공");
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