"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { UserType } from "../types";
import LoginCard from "../components/auth/LoginCard";
import SignupModal from "../components/auth/SignupModal";

export default function Home() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);

  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUser({
          id: user.id,
          email: user.email,
        });
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
      setUser({
        id: data.user.id,
        email: data.user.email,
      });
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
      setUser({
        id: data.user.id,
        email: data.user.email,
      });
      router.replace("/dashboard");
    }

    alert("로그인 성공");
  };

  if (loading) {
    return (
      <main className="retro-scanlines retro-grid-bg min-h-screen bg-[var(--bg)] px-4 py-6 text-[var(--text)]">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center justify-center">
          <div className="retro-panel w-full rounded-[28px] px-6 py-5 text-center">
            불러오는 중...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="retro-scanlines retro-grid-bg min-h-screen bg-[var(--bg)] px-4 py-6 text-[var(--text)]">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center justify-center relative">
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