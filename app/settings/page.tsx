"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import {
  createToastState,
  getKoreanErrorMessage,
  queuePendingToast,
  ToastState,
} from "../../lib/toast";
import {
  extractDriverProfileSeed,
  isMissingDriverSettingsPhoneNumberColumn,
} from "../../lib/driverSettings";
import { DriverSettings, UserType } from "../../types";
import SettingsForm from "../../components/settings/SettingsForm";
import ToastViewport from "../../components/ui/ToastViewport";

async function loadDriverSettings(userId: string) {
  return supabase.from("driver_settings").select("*").eq("user_id", userId).single();
}

export default function SettingsPage() {
  const router = useRouter();

  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [settings, setSettings] = useState<DriverSettings>({
    driver_name: "",
    phone_number: "",
    unit_price: "",
    settlement_start_day: "26",
    settlement_start_month_offset: "-1",
    settlement_end_day: "25",
    settlement_end_month_offset: "0",
    off_days: [],
    biweekly_off_days: [],
    biweekly_anchor_date: "",
  });

  const showToast = (tone: ToastState["tone"], title: string, message?: string) => {
    setToast(createToastState({ tone, title, message }));
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      const profileSeed = extractDriverProfileSeed(user);

      setUser({
        id: user.id,
        email: user.email,
        driver_name: profileSeed.driverName,
        phone_number: profileSeed.phoneNumber,
      });

      setSettings((prev) => ({
        ...prev,
        driver_name: profileSeed.driverName || prev.driver_name,
        phone_number: profileSeed.phoneNumber || prev.phone_number,
      }));

      setLoading(false);
    };

    init();
  }, [router]);

  useEffect(() => {
    if (user) {
      const loadSettings = async () => {
        setSettingsLoading(true);

        const { data, error } = await loadDriverSettings(user.id);

        setSettingsLoading(false);

        if (error) {
          if (error.code !== "PGRST116") {
            showToast(
              "error",
              "기본설정 불러오기 실패",
              getKoreanErrorMessage(error.message, "기본설정을 불러오지 못했습니다.")
            );
          }
          return;
        }

        setSettings({
          driver_name: data.driver_name ?? user.driver_name ?? "",
          phone_number: data.phone_number ?? user.phone_number ?? "",
          unit_price: data.unit_price ? String(data.unit_price) : "",
          settlement_start_day: data.settlement_start_day
            ? String(data.settlement_start_day)
            : "26",
          settlement_start_month_offset:
            data.settlement_start_month_offset !== null &&
            data.settlement_start_month_offset !== undefined
              ? String(data.settlement_start_month_offset)
              : "-1",
          settlement_end_day: data.settlement_end_day
            ? String(data.settlement_end_day)
            : "25",
          settlement_end_month_offset:
            data.settlement_end_month_offset !== null &&
            data.settlement_end_month_offset !== undefined
              ? String(data.settlement_end_month_offset)
              : "0",
          off_days: Array.isArray(data.off_days) ? data.off_days : [],
          biweekly_off_days: Array.isArray(data.biweekly_off_days)
            ? data.biweekly_off_days
            : [],
          biweekly_anchor_date: data.biweekly_anchor_date ?? "",
        });
      };

      void loadSettings();
    }
  }, [user]);

  const handleSettingsChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveSettings = async () => {
    if (!user) return;

    setSaving(true);

    const { error: authError } = await supabase.auth.updateUser({
      data: {
        driver_name: settings.driver_name.trim(),
        phone_number: settings.phone_number.trim(),
      },
    });

    if (authError) {
      setSaving(false);
      showToast(
        "error",
        "기본설정 저장 실패",
        getKoreanErrorMessage(authError.message, "기본설정을 저장하지 못했습니다.")
      );
      return;
    }

    const basePayload = {
      user_id: user.id,
      driver_name: settings.driver_name.trim(),
      unit_price: settings.unit_price ? Number(settings.unit_price) : null,
      settlement_start_day: Number(settings.settlement_start_day || 1),
      settlement_start_month_offset: Number(
        settings.settlement_start_month_offset || 0
      ),
      settlement_end_day: Number(settings.settlement_end_day || 31),
      settlement_end_month_offset: Number(
        settings.settlement_end_month_offset || 0
      ),
      off_days: settings.off_days,
      biweekly_off_days: settings.biweekly_off_days,
      biweekly_anchor_date: settings.biweekly_anchor_date || null,
    };

    const payloadWithPhoneNumber = {
      ...basePayload,
      phone_number: settings.phone_number.trim() || null,
    };

    let { error } = await supabase
      .from("driver_settings")
      .upsert(payloadWithPhoneNumber, { onConflict: "user_id" });

    if (isMissingDriverSettingsPhoneNumberColumn(error)) {
      const fallbackResult = await supabase
        .from("driver_settings")
        .upsert(basePayload, { onConflict: "user_id" });

      error = fallbackResult.error;
    }

    setSaving(false);

    if (error) {
      showToast(
        "error",
        "기본설정 저장 실패",
        getKoreanErrorMessage(error.message, "기본설정을 저장하지 못했습니다.")
      );
      return;
    }

    setUser((prev) =>
      prev
        ? {
            ...prev,
            driver_name: settings.driver_name.trim(),
            phone_number: settings.phone_number.trim(),
          }
        : prev
    );

    queuePendingToast({
      tone: "success",
      title: "기본설정 저장 완료",
      message: "변경한 설정이 대시보드에 반영됩니다.",
    });
    router.push("/dashboard");
  };

  if (loading || settingsLoading) {
    return (
      <main className="retro-scanlines retro-grid-bg min-h-[100dvh] bg-[var(--bg)] px-3 py-4 text-[var(--text)] sm:px-4 sm:py-6">
        <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-[28rem] items-center justify-center sm:min-h-[calc(100vh-3rem)]">
          <div className="retro-panel w-full rounded-[28px] px-6 py-5 text-center">
            불러오는 중...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="retro-scanlines retro-grid-bg min-h-[100dvh] bg-[var(--bg)] px-3 py-4 text-[var(--text)] sm:px-4 sm:py-6">
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} />
      <div className="mx-auto flex w-full max-w-[34rem] flex-col gap-4 sm:gap-5 sm:max-w-2xl">
        <div className="retro-panel rounded-[24px] px-4 py-5 sm:rounded-[28px] sm:px-6 sm:py-6">
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div aria-hidden="true" />

              <div className="text-center">
                <h1 className="retro-title theme-heading text-xl leading-none text-[rgba(255,255,255,0.96)] sm:text-2xl md:text-[1.9rem]">
                  설정
                </h1>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="retro-button min-h-[38px] px-3.5 py-1.5 text-[12px] font-semibold sm:text-xs"
                  style={{ marginRight: "0.875rem" }}
                >
                  돌아가기
                </button>
              </div>
            </div>

            <p className="theme-copy text-center text-sm">
              정산기간, 단가, 휴무 기준을 설정합니다.
            </p>
          </div>
        </div>

        <SettingsForm
          settings={settings}
          setSettings={setSettings}
          handleSettingsChange={handleSettingsChange}
          saveSettings={saveSettings}
          saving={saving}
        />
      </div>
    </main>
  );
}