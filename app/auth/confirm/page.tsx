"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ensureDriverSettingsRow, extractDriverProfileSeed } from "../../../lib/driverSettings";
import { PageLoadingShell } from "../../../components/layout/PageShell";
import { supabase } from "../../../lib/supabase";
import { getKoreanErrorMessage, queuePendingToast } from "../../../lib/toast";

type EmailConfirmationType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email";

function isEmailConfirmationType(value: string | null): value is EmailConfirmationType {
  return (
    value === "signup" ||
    value === "invite" ||
    value === "magiclink" ||
    value === "recovery" ||
    value === "email_change" ||
    value === "email"
  );
}

function getRedirectPath(type: EmailConfirmationType) {
  if (type === "recovery") {
    return "/";
  }

  return "/dashboard";
}

function getHashParams() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }

  const hash = window.location.hash;

  return new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
}

export default function AuthConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (hasProcessedRef.current) {
      return;
    }

    hasProcessedRef.current = true;

    const verifyEmail = async () => {
      const tokenHash = searchParams.get("token_hash");
      const queryType = searchParams.get("type");
      const hashParams = getHashParams();
      const hashType = hashParams.get("type");
      const type = isEmailConfirmationType(queryType)
        ? queryType
        : isEmailConfirmationType(hashType)
          ? hashType
          : null;

      if (!type) {
        queuePendingToast({
          tone: "error",
          title: "이메일 인증 링크를 확인해주세요",
          message: "인증 링크가 올바르지 않거나 만료되었습니다.",
        });
        router.replace("/");
        return;
      }

      let confirmedUser: User | null = null;

      if (tokenHash) {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });

        if (error || !data.user) {
          queuePendingToast({
            tone: "error",
            title: "이메일 인증 실패",
            message: getKoreanErrorMessage(
              error?.message,
              "이메일 인증 중 문제가 발생했습니다. 다시 시도해주세요."
            ),
          });
          router.replace("/");
          return;
        }

        confirmedUser = data.user;
      } else {
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error || !data.user) {
            queuePendingToast({
              tone: "error",
              title: "이메일 인증 실패",
              message: getKoreanErrorMessage(
                error?.message,
                "이메일 인증 중 문제가 발생했습니다. 다시 시도해주세요."
              ),
            });
            router.replace("/");
            return;
          }

          confirmedUser = data.user;
        } else {
          const {
            data: { user },
            error,
          } = await supabase.auth.getUser();

          if (error || !user) {
            queuePendingToast({
              tone: "error",
              title: "이메일 인증 링크를 확인해주세요",
              message: getKoreanErrorMessage(
                error?.message,
                "인증 링크가 올바르지 않거나 만료되었습니다."
              ),
            });
            router.replace("/");
            return;
          }

          confirmedUser = user;
        }
      }

      if (type === "signup") {
        const { error: settingsError } = await ensureDriverSettingsRow(
          confirmedUser.id,
          extractDriverProfileSeed(confirmedUser)
        );

        if (settingsError) {
          queuePendingToast({
            tone: "error",
            title: "인증은 완료됐지만 추가 정보를 저장하지 못했습니다",
            message: getKoreanErrorMessage(
              settingsError.message,
              "추가 정보를 저장하지 못했습니다. 설정 화면에서 다시 확인해주세요."
            ),
          });
          router.replace("/dashboard");
          return;
        }

        queuePendingToast({
          tone: "success",
          title: "이메일 인증 완료",
          message: "대시보드로 이동합니다.",
        });
        router.replace("/dashboard");
        return;
      }

      queuePendingToast({
        tone: "success",
        title: "인증이 완료되었습니다",
      });
      router.replace(getRedirectPath(type));
    };

    void verifyEmail();
  }, [router, searchParams]);

  return <PageLoadingShell message="이메일 인증을 확인하는 중..." />;
}