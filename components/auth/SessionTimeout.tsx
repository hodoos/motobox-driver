"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_STARTED_AT_KEY = "motobox.session.startedAt";
const COUNTDOWN_TICK_MS = 1000;

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

function formatRemainingTime(remainingMs: number) {
  const totalSeconds = Math.max(Math.ceil(remainingMs / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function SessionTimeout() {
  const router = useRouter();
  const timeoutIdRef = useRef<number | null>(null);
  const countdownIdRef = useRef<number | null>(null);
  const isAutoSigningOutRef = useRef(false);
  const scheduleSessionTimeoutRef = useRef<(startedAt: number) => void>(() => {});
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isExtending, setIsExtending] = useState(false);

  useEffect(() => {
    const clearLogoutTimer = () => {
      if (timeoutIdRef.current !== null) {
        window.clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };

    const clearCountdownTimer = () => {
      if (countdownIdRef.current !== null) {
        window.clearInterval(countdownIdRef.current);
        countdownIdRef.current = null;
      }
    };

    const updateRemainingTime = (startedAt: number) => {
      const nextRemainingMs = Math.max(
        SESSION_TIMEOUT_MS - (Date.now() - startedAt),
        0
      );

      setRemainingMs(nextRemainingMs);
      return nextRemainingMs;
    };

    const expireSession = async () => {
      if (isAutoSigningOutRef.current) {
        return;
      }

      isAutoSigningOutRef.current = true;
      clearLogoutTimer();
      clearCountdownTimer();
      clearSessionStartedAt();
      setRemainingMs(null);
      setIsSessionActive(false);

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
      clearCountdownTimer();

      const remainingTime = updateRemainingTime(startedAt);

      if (remainingTime <= 0) {
        void expireSession();
        return;
      }

      countdownIdRef.current = window.setInterval(() => {
        const nextRemainingMs = updateRemainingTime(startedAt);

        if (nextRemainingMs <= 0) {
          clearCountdownTimer();
        }
      }, COUNTDOWN_TICK_MS);

      timeoutIdRef.current = window.setTimeout(() => {
        void expireSession();
      }, remainingTime);
    };

    scheduleSessionTimeoutRef.current = scheduleSessionTimeout;

    const syncSessionTimeout = (
      event: AuthChangeEvent | "initial",
      session: Session | null
    ) => {
      clearLogoutTimer();
      clearCountdownTimer();

      if (!session) {
        clearSessionStartedAt();
        isAutoSigningOutRef.current = false;
        setRemainingMs(null);
        setIsSessionActive(false);
        return;
      }

      const storedStartedAt = readSessionStartedAt();
      const nextStartedAt =
        event === "SIGNED_IN" || !storedStartedAt ? Date.now() : storedStartedAt;

      writeSessionStartedAt(nextStartedAt);
      isAutoSigningOutRef.current = false;
      setIsSessionActive(true);
      scheduleSessionTimeout(nextStartedAt);
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== SESSION_STARTED_AT_KEY) {
        return;
      }

      const startedAt = readSessionStartedAt();

      if (!startedAt) {
        clearLogoutTimer();
        clearCountdownTimer();
        setRemainingMs(null);
        setIsSessionActive(false);
        return;
      }

      setIsSessionActive(true);
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
      clearCountdownTimer();
      window.removeEventListener("storage", handleStorageChange);
      subscription.unsubscribe();
    };
  }, [router]);

  const handleExtendSession = async () => {
    if (!isSessionActive || isExtending || isAutoSigningOutRef.current) {
      return;
    }

    setIsExtending(true);

    const nextStartedAt = Date.now();
    const {
      data: { session },
      error,
    } = await supabase.auth.refreshSession();

    if (error || !session) {
      setIsExtending(false);
      alert("세션 연장 실패: " + (error?.message ?? "세션 정보가 없습니다."));
      return;
    }

    writeSessionStartedAt(nextStartedAt);
    setIsSessionActive(true);
    scheduleSessionTimeoutRef.current(nextStartedAt);
    setIsExtending(false);
  };

  if (!isSessionActive || remainingMs === null) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-[16rem] sm:max-w-[17rem]">
      <div className="retro-panel rounded-[20px] px-4 py-3">
        <p className="theme-copy text-xs">세션 남은 시간</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="theme-heading text-lg font-semibold tabular-nums">
            {formatRemainingTime(remainingMs)}
          </p>
          <button
            type="button"
            onClick={handleExtendSession}
            disabled={isExtending}
            className="retro-button min-h-[38px] px-3 py-2 text-xs font-semibold disabled:opacity-60"
          >
            {isExtending ? "연장 중..." : "세션 연장"}
          </button>
        </div>
      </div>
    </div>
  );
}