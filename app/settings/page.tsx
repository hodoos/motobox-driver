"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { DriverSettings, UserType } from "../../types";
import SettingsForm from "../../components/settings/SettingsForm";

export default function SettingsPage() {
  const router = useRouter();

  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isBiweeklyPickMode, setIsBiweeklyPickMode] = useState(false);

  const [settings, setSettings] = useState<DriverSettings>({
    driver_name: "",
    unit_price: "",
    settlement_start_day: "26",
    settlement_start_month_offset: "-1",
    settlement_end_day: "25",
    settlement_end_month_offset: "0",
    off_days: [],
    biweekly_off_days: [],
    biweekly_anchor_date: "",
  });

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      setUser({
        id: user.id,
        email: user.email,
      });

      setLoading(false);
    };

    init();
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;

    setSettingsLoading(true);

    const { data, error } = await supabase
      .from("driver_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    setSettingsLoading(false);

    if (error) {
      if (error.code !== "PGRST116") {
        alert("기본설정 불러오기 실패: " + error.message);
      }
      return;
    }

    setSettings({
      driver_name: data.driver_name ?? "",
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

    const payload = {
      user_id: user.id,
      driver_name: settings.driver_name,
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

    const { error } = await supabase
      .from("driver_settings")
      .upsert(payload, { onConflict: "user_id" });

    setSaving(false);

    if (error) {
      alert("기본설정 저장 실패: " + error.message);
      return;
    }

    localStorage.setItem(
      "biweeklyPickMode",
      JSON.stringify(isBiweeklyPickMode)
    );

    alert("기본설정 저장 완료");
    router.push("/dashboard");
  };

  if (loading || settingsLoading) {
    return (
      <main className="retro-scanlines retro-grid-bg min-h-screen bg-[var(--bg)] px-4 py-6 text-[var(--text)]">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center justify-center">
          <div className="retro-panel w-full rounded-[28px] px-6 py-5 text-center">
            불러오는 중...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="retro-scanlines retro-grid-bg min-h-screen bg-[var(--bg)] px-4 py-6 text-[var(--text)]">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 md:max-w-2xl">
        <div className="retro-panel rounded-[28px] px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="retro-title text-[10px] text-[#6effa6]/60">SETTINGS</p>
              <h1 className="retro-title mt-3 text-lg leading-relaxed text-[#b8ffd2] md:text-xl">
                CONFIG PANEL
              </h1>
              <p className="mt-3 text-sm text-[#7dffb1]/62">
                정산기간, 단가, 휴무 기준을 설정합니다.
              </p>
            </div>

            <button
              onClick={() => router.push("/dashboard")}
              className="retro-button px-4 py-2.5 text-sm font-semibold"
            >
              돌아가기
            </button>
          </div>
        </div>

        <SettingsForm
          settings={settings}
          setSettings={setSettings}
          handleSettingsChange={handleSettingsChange}
          saveSettings={saveSettings}
          saving={saving}
          isBiweeklyPickMode={isBiweeklyPickMode}
          setIsBiweeklyPickMode={setIsBiweeklyPickMode}
        />
      </div>
    </main>
  );
}