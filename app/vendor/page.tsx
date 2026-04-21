"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLegacyAdminUser, isVendorUser } from "../../lib/admin";
import { extractDriverProfileSeed } from "../../lib/driverSettings";
import PageShell, { PageLoadingShell } from "../../components/layout/PageShell";
import { supabase } from "../../lib/supabase";
import {
  queuePendingToast,
  ToastState,
} from "../../lib/toast";
import { getUserLevel } from "../../lib/userLevel";
import ToastViewport from "../../components/ui/ToastViewport";
import type { UserType } from "../../types";

export default function VendorPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserType | null>(null);
  const [userLevel, setUserLevel] = useState<string>("");
  const [accessScope, setAccessScope] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        queuePendingToast({
          tone: "error",
          title: "로그인이 필요합니다",
          message: "밴더 전용 페이지는 로그인한 계정만 접근할 수 있습니다.",
        });
        router.replace("/");
        return;
      }

      if (!isVendorUser(user)) {
        queuePendingToast({
          tone: "error",
          title: "밴더 권한이 없습니다",
          message:
            "벤더Lv 이상 또는 기존 관리자 권한 계정만 밴더 전용 페이지에 접근할 수 있습니다.",
        });
        router.replace("/dashboard");
        return;
      }

      const profileSeed = extractDriverProfileSeed(user);
      const nextUserLevel = getUserLevel(user);

      setUser({
        id: user.id,
        email: user.email,
        driver_name: profileSeed.driverName,
        phone_number: profileSeed.phoneNumber,
      });
      setUserLevel(nextUserLevel);
      setAccessScope(
        isLegacyAdminUser(user) && nextUserLevel === "기사Lv"
          ? "레거시 관리자 권한"
          : "벤더Lv 이상"
      );
      setLoading(false);
    };

    void init();
  }, [router]);

  if (loading) {
    return <PageLoadingShell message="밴더 전용 페이지 확인 중..." />;
  }

  return (
    <PageShell contentClassName="flex w-full max-w-[34rem] flex-col gap-4 sm:max-w-2xl lg:max-w-4xl">
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} />

      <section className="retro-panel rounded-[24px] px-4 py-5 sm:rounded-[28px] sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="theme-kicker text-[11px] sm:text-xs">VENDOR ONLY</p>
            <h1 className="retro-title theme-heading mt-2 text-lg sm:text-xl">
              밴더 전용 페이지
            </h1>
            <p className="theme-copy mt-3 text-sm leading-relaxed">
              벤더Lv 이상 또는 기존 관리자 권한 계정만 접근할 수 있는 전용 영역입니다. 이후
              밴더용 기능과 메뉴를 이 화면을 기준으로 확장할 수 있습니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="retro-button min-h-[40px] px-4 py-2 text-sm font-semibold"
          >
            대시보드
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
          <span className="theme-chip-subtle px-3 py-1.5">
            현재 등급: {userLevel}
          </span>
          <span className="theme-chip-subtle px-3 py-1.5">
            접근 기준: {accessScope}
          </span>
          <span className="theme-chip-subtle px-3 py-1.5">
            사용자: {user?.driver_name || user?.email || "사용자"}
          </span>
        </div>
      </section>

      <section className="retro-panel rounded-[24px] px-4 py-5 sm:rounded-[28px] sm:px-6 sm:py-6">
        <div className="space-y-3">
          <p className="theme-kicker text-[11px] sm:text-xs">READY FOR VENDOR FEATURES</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="theme-note-box rounded-[20px] px-4 py-4 text-sm leading-relaxed">
              벤더 공지, 정산 공유, 기사 배정 관련 기능을 이 영역에 추가할 수 있습니다.
            </div>
            <div className="theme-note-box rounded-[20px] px-4 py-4 text-sm leading-relaxed">
              현재는 접근 권한과 전용 진입 경로를 실제로 연결한 초기 페이지입니다.
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}