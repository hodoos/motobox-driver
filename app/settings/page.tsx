"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DriverSettings, UserType } from "@/types";
import { useRouter } from "next/navigation";
import SettingsForm from "@/components/settings/SettingsForm";

export default function SettingsPage() {
  const router = useRouter();

  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
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
    if (user) fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;

    setSettingsLoading(true);

    const { data, error } = await supabase
      .from("driver_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (error.code !== "PGRST116") {
        alert("기본설정 불러오기 실패: " + error.message);
      }
      setSettingsLoading(false);
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

    setSettingsLoading(false);
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
      <main className="min-h-screen bg-[#f6f7fb] p-4 flex items-center justify-center text-black">
        <div className="rounded-[28px] border border-black/8 bg-white px-6 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
          불러오는 중...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] p-4 text-black md:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center justify-between rounded-[28px] border border-black/8 bg-white px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">기본 설정</h1>
            <p className="mt-1 text-sm text-black/55">
              업무 기준값과 휴무 패턴을 설정합니다.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-black hover:text-white"
          >
            달력으로 돌아가기
          </button>
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