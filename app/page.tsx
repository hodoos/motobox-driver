"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import LoginCard from "../components/auth/LoginCard";
import SignupModal from "../components/auth/SignupModal";

export default function Home() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
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

  const signUp = async () => {
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
    });

    if (error) {
      alert(error.message);
      return;
    }

    if (data.user && data.session) {
      router.replace("/dashboard");
    }

    alert("회원가입 완료");
    setSignupEmail("");
    setSignupPassword("");
    setIsSignupModalOpen(false);
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
          email={signupEmail}
          password={signupPassword}
          setEmail={setSignupEmail}
          setPassword={setSignupPassword}
          onClose={() => setIsSignupModalOpen(false)}
          onSubmit={signUp}
        />
      </div>
    </main>
  );
}