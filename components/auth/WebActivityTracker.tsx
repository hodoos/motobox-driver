"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";

const WEB_ACTIVITY_INTERVAL_MS = 60 * 1000;

export default function WebActivityTracker() {
  const pathname = usePathname();
  const accessTokenRef = useRef<string | null>(null);
  const lastTrackedAtRef = useRef(0);

  const trackActivity = useEffectEvent((force = false, keepalive = false) => {
    const accessToken = accessTokenRef.current;

    if (!accessToken) {
      return;
    }

    const now = Date.now();

    if (!force && now - lastTrackedAtRef.current < WEB_ACTIVITY_INTERVAL_MS) {
      return;
    }

    lastTrackedAtRef.current = now;

    void fetch("/api/web-activity", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      keepalive,
      cache: "no-store",
    }).catch(() => undefined);
  });

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      accessTokenRef.current = session?.access_token ?? null;

      if (session?.access_token) {
        trackActivity(true);
      }
    };

    void syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      accessTokenRef.current = session?.access_token ?? null;

      if (session?.access_token) {
        trackActivity(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    trackActivity(true);
  }, [pathname]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      trackActivity();
    }, WEB_ACTIVITY_INTERVAL_MS);

    const handleFocus = () => {
      trackActivity(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        trackActivity(true);
        return;
      }

      trackActivity(true, true);
    };

    const handlePageHide = () => {
      trackActivity(true, true);
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  return null;
}