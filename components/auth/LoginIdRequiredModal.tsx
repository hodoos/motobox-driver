"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  extractUserProfileSeed,
  getLoginIdValidationMessage,
  normalizeLoginId,
  sanitizeLoginIdInput,
} from "../../lib/loginId";
import { supabase } from "../../lib/supabase";

export default function LoginIdRequiredModal() {
  const pathname = usePathname();
  const [requiredEmail, setRequiredEmail] = useState<string | null>(null);
  const [loginId, setLoginId] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const syncUserState = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (!user || pathname === "/" || pathname.startsWith("/auth/")) {
        setRequiredEmail(null);
        setLoginId("");
        setErrorMessage(null);
        return;
      }

      const profileSeed = extractUserProfileSeed(user);

      if (profileSeed.loginId) {
        setRequiredEmail(null);
        setLoginId(profileSeed.loginId);
        setErrorMessage(null);
        return;
      }

      setRequiredEmail(user.email ?? "");
      setLoginId("");
    };

    void syncUserState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void syncUserState();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [pathname]);

  if (!requiredEmail || typeof document === "undefined") {
    return null;
  }

  const handleSave = async () => {
    const normalizedLoginId = normalizeLoginId(loginId);
    const validationMessage = getLoginIdValidationMessage(normalizedLoginId);

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setSaving(false);
      setErrorMessage("세션을 확인하지 못했습니다. 다시 로그인해주세요.");
      return;
    }

    const response = await fetch("/api/auth/login-id", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ loginId: normalizedLoginId }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);

      setSaving(false);
      setErrorMessage(
        body && typeof body.error === "string"
          ? body.error
          : "ID를 저장하지 못했습니다. 잠시 후 다시 시도해주세요."
      );
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setSaving(false);

    if (user && extractUserProfileSeed(user).loginId) {
      setRequiredEmail(null);
      setErrorMessage(null);
      return;
    }

    setErrorMessage("ID 저장 후 정보를 다시 확인하지 못했습니다. 새로고침 후 다시 시도해주세요.");
  };

  return createPortal(
    <div
      className="z-[100000] bg-black/80 px-4 py-6 backdrop-blur-sm"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="retro-panel mx-auto flex w-full max-w-[28rem] flex-col gap-5 rounded-[28px] px-5 py-6 text-left sm:px-6 sm:py-7">
        <div className="space-y-3 text-center">
          <p className="retro-title theme-kicker text-[10px]">ID REQUIRED</p>
          <h2 className="retro-title theme-heading text-base leading-relaxed sm:text-lg">
            계속 이용하려면 로그인 ID를 설정해주세요
          </h2>
          <p className="theme-copy text-sm leading-relaxed">
            기존 이메일 계정은 먼저 ID를 등록해야 기능을 이용할 수 있습니다.
          </p>
          <p className="theme-copy text-xs leading-relaxed">현재 계정: {requiredEmail}</p>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="로그인 ID"
            value={loginId}
            onChange={(event) => setLoginId(sanitizeLoginIdInput(event.target.value))}
            autoComplete="username"
            maxLength={20}
            className="block h-12 w-full px-4 py-3 text-center text-base"
          />
          <p className="theme-copy text-center text-[11px] leading-relaxed">
            영문 소문자와 숫자로 4~20자
          </p>
          {errorMessage ? (
            <p className="text-center text-sm font-semibold text-[rgba(255,167,167,0.95)]">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="retro-button-solid ui-action-fit min-h-[48px] px-6 py-3 text-base font-semibold disabled:opacity-60"
        >
          {saving ? "저장 중..." : "ID 저장"}
        </button>
      </div>
    </div>,
    document.body
  );
}