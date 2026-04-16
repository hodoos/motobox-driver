"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { UserType } from "@/types";
import { useRouter } from "next/navigation";
import LoginCard from "@/components/auth/LoginCard";
import SignupModal from "@/components/auth/SignupModal";

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
      <main className="min-h-screen bg-[#f6f7fb] p-4 flex items-center justify-center text-black">
        <div className="rounded-[28px] border border-black/8 bg-white px-6 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
          불러오는 중...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#eef2ff_38%,_#f6f7fb_70%)] px-4 py-6 text-black md:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center">
        <LoginCard
          email={email}
          password={password}
          setEmail={setEmail}
          setPassword={setPassword}
          onLogin={signIn}
          onOpenSignup={() => setIsSignupModalOpen(true)}
        />
      </div>

      <SignupModal
        open={isSignupModalOpen}
        email={signupEmail}
        password={signupPassword}
        setEmail={setSignupEmail}
        setPassword={setSignupPassword}
        onClose={() => setIsSignupModalOpen(false)}
        onSubmit={signUp}
      />
    </main>
  );
}