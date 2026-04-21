"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import {
  createToastState,
  getKoreanErrorMessage,
  queuePendingToast,
  ToastState,
} from "../../lib/toast";
import ToastViewport from "../ui/ToastViewport";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_STARTED_AT_KEY = "motobox.session.startedAt";

function readSessionStartedAt() {
  const storedValue = window.localStorage.getItem(SESSION_STARTED_AT_KEY);

  if (!storedValue) {
    return null;
  }

  const parsedValue = Number(storedValue);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function writeSessionStartedAt(timestamp: number) {
  window.localStorage.setItem(SESSION_STARTED_AT_KEY, String(timestamp));
}

function clearSessionStartedAt() {
  window.localStorage.removeItem(SESSION_STARTED_AT_KEY);
}

export default function SessionTimeout() {
  const router = useRouter();
  const timeoutIdRef = useRef<number | null>(null);
  const isAutoSigningOutRef = useRef(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (tone: ToastState["tone"], title: string, message?: string) => {
    setToast(createToastState({ tone, title, message }));
  };

  useEffect(() => {
    const clearLogoutTimer = () => {
      if (timeoutIdRef.current !== null) {
        window.clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };

    const expireSession = async () => {
      if (isAutoSigningOutRef.current) {
        return;
      }

      isAutoSigningOutRef.current = true;
      clearLogoutTimer();
      clearSessionStartedAt();

      const { error } = await supabase.auth.signOut();

      if (error) {
        isAutoSigningOutRef.current = false;
        showToast(
          "error",
          "세션 만료 처리 실패",
          getKoreanErrorMessage(error.message, "세션 종료 처리 중 문제가 발생했습니다.")
        );
        return;
      }

      queuePendingToast({
        tone: "info",
        title: "세션이 만료되었습니다",
        message: "로그인 시간이 지나 자동 로그아웃되었습니다.",
      });
      router.replace("/");
    };

    const scheduleSessionTimeout = (startedAt: number) => {
      clearLogoutTimer();

      const remainingTime = Math.max(SESSION_TIMEOUT_MS - (Date.now() - startedAt), 0);

      if (remainingTime <= 0) {
        void expireSession();
        return;
      }

      timeoutIdRef.current = window.setTimeout(() => {
        void expireSession();
      }, remainingTime);
    };

    const syncSessionTimeout = (
      event: AuthChangeEvent | "initial",
      session: Session | null
    ) => {
      clearLogoutTimer();

      if (!session) {
        clearSessionStartedAt();
        isAutoSigningOutRef.current = false;
        return;
      }

      const storedStartedAt = readSessionStartedAt();
      const nextStartedAt =
        event === "SIGNED_IN" || !storedStartedAt ? Date.now() : storedStartedAt;

      writeSessionStartedAt(nextStartedAt);
      isAutoSigningOutRef.current = false;
      scheduleSessionTimeout(nextStartedAt);
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== SESSION_STARTED_AT_KEY) {
        return;
      }

      const startedAt = readSessionStartedAt();

      if (!startedAt) {
        clearLogoutTimer();
        return;
      }

      scheduleSessionTimeout(startedAt);
    };

    const initializeSessionTimeout = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      syncSessionTimeout("initial", session);
    };

    void initializeSessionTimeout();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      syncSessionTimeout(event, session);
    });

    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearLogoutTimer();
      window.removeEventListener("storage", handleStorageChange);
      subscription.unsubscribe();
    };
  }, [router]);

  return <ToastViewport toast={toast} onDismiss={() => setToast(null)} />;
}