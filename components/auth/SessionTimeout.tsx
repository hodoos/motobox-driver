"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import {
  DEFAULT_SESSION_TIMEOUT_MINUTES,
  readCachedSessionTimeoutMinutes,
  SESSION_TIMEOUT_CACHE_KEY,
  SESSION_TIMEOUT_SETTINGS_EVENT,
  toSessionTimeoutMilliseconds,
  parseSessionTimeoutMinutes,
  writeCachedSessionTimeoutMinutes,
} from "../../lib/sessionTimeoutConfig";
import {
  createToastState,
  getKoreanErrorMessage,
  queuePendingToast,
  ToastState,
} from "../../lib/toast";
import ToastViewport from "../ui/ToastViewport";

const SESSION_STARTED_AT_KEY = "motobox.session.startedAt";

type SessionTimeoutSettingsResponse = {
  timeout_minutes?: unknown;
};

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
  const sessionTimeoutMsRef = useRef(
    toSessionTimeoutMilliseconds(
      readCachedSessionTimeoutMinutes() ?? DEFAULT_SESSION_TIMEOUT_MINUTES
    )
  );
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

      const remainingTime = Math.max(
        sessionTimeoutMsRef.current - (Date.now() - startedAt),
        0
      );

      if (remainingTime <= 0) {
        void expireSession();
        return;
      }

      timeoutIdRef.current = window.setTimeout(() => {
        void expireSession();
      }, remainingTime);
    };

    const applySessionTimeoutMinutes = (timeoutMinutes: number, persist = false) => {
      sessionTimeoutMsRef.current = toSessionTimeoutMilliseconds(timeoutMinutes);

      if (persist) {
        writeCachedSessionTimeoutMinutes(timeoutMinutes);
      }
    };

    const syncCachedSessionTimeout = () => {
      const cachedTimeoutMinutes = readCachedSessionTimeoutMinutes();

      if (cachedTimeoutMinutes !== null) {
        applySessionTimeoutMinutes(cachedTimeoutMinutes);
      }
    };

    const refreshSessionTimeoutSettings = async (accessToken: string, startedAt: number) => {
      try {
        const response = await fetch("/api/session-timeout", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json().catch(() => null)) as
          | SessionTimeoutSettingsResponse
          | null;
        const timeoutMinutes = parseSessionTimeoutMinutes(payload?.timeout_minutes);

        if (timeoutMinutes === null) {
          return;
        }

        applySessionTimeoutMinutes(timeoutMinutes, true);
        scheduleSessionTimeout(startedAt);
      } catch {
        return;
      }
    };

    const syncSessionTimeout = async (
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
      syncCachedSessionTimeout();
      isAutoSigningOutRef.current = false;
      scheduleSessionTimeout(nextStartedAt);

      if (session.access_token) {
        await refreshSessionTimeoutSettings(session.access_token, nextStartedAt);
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === SESSION_TIMEOUT_CACHE_KEY) {
        syncCachedSessionTimeout();

        const startedAt = readSessionStartedAt();

        if (startedAt) {
          scheduleSessionTimeout(startedAt);
        }

        return;
      }

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

    const handleSessionTimeoutSettingsChange = () => {
      syncCachedSessionTimeout();

      const startedAt = readSessionStartedAt();

      if (startedAt) {
        scheduleSessionTimeout(startedAt);
      }
    };

    const initializeSessionTimeout = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await syncSessionTimeout("initial", session);
    };

    void initializeSessionTimeout();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      void syncSessionTimeout(event, session);
    });

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(
      SESSION_TIMEOUT_SETTINGS_EVENT,
      handleSessionTimeoutSettingsChange
    );

    return () => {
      clearLogoutTimer();
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        SESSION_TIMEOUT_SETTINGS_EVENT,
        handleSessionTimeoutSettingsChange
      );
      subscription.unsubscribe();
    };
  }, [router]);

  return <ToastViewport toast={toast} onDismiss={() => setToast(null)} />;
}