"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

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
        alert("세션 만료 처리 실패: " + error.message);
        return;
      }

      alert("로그인 세션이 만료되어 자동 로그아웃되었습니다.");
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

  return null;
}