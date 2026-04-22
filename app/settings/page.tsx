"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { recordOperatorAuditLog } from "../../lib/operatorAuditLogClient";
import { supabase } from "../../lib/supabase";
import {
  extractUserProfileSeed,
  getLoginIdValidationMessage,
  normalizeLoginId,
  sanitizeLoginIdInput,
} from "../../lib/loginId";
import {
  createToastState,
  getKoreanErrorMessage,
  queuePendingToast,
  ToastState,
} from "../../lib/toast";
import {
  isMissingDriverSettingsPhoneNumberColumn,
} from "../../lib/driverSettings";
import PageShell, { PageLoadingShell } from "../../components/layout/PageShell";
import { AccountSettings, UserType } from "../../types";
import SettingsForm from "../../components/settings/SettingsForm";
import ToastViewport from "../../components/ui/ToastViewport";

async function loadDriverSettings(userId: string) {
  const { data, error } = await supabase
    .from("driver_settings")
    .select("*")
    .eq("user_id", userId)
    .limit(1);

  return {
    data: Array.isArray(data) ? data[0] ?? null : null,
    error,
  };
}

export default function SettingsPage() {
  const router = useRouter();

  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [settings, setSettings] = useState<AccountSettings>({
    login_id: "",
    email: "",
    password: "",
    password_confirm: "",
    driver_name: "",
    phone_number: "",
    signup_type: "driver",
    is_coupang: true,
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

  const readApiErrorMessage = async (response: Response, fallback: string) => {
    const body = await response.json().catch(() => null);

    if (body && typeof body.error === "string") {
      return body.error;
    }

    return fallback;
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

      const profileSeed = extractUserProfileSeed(user);

      setUser({
        id: user.id,
        email: user.email,
        login_id: profileSeed.loginId,
        driver_name: profileSeed.driverName,
        phone_number: profileSeed.phoneNumber,
        signup_type: profileSeed.signupType,
        is_coupang: profileSeed.isCoupang,
      });

      setSettings((prev) => ({
        ...prev,
        login_id: profileSeed.loginId || prev.login_id,
        email: user.email || prev.email,
        driver_name: profileSeed.driverName || prev.driver_name,
        phone_number: profileSeed.phoneNumber || prev.phone_number,
        signup_type: profileSeed.signupType,
        is_coupang: profileSeed.isCoupang,
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
          showToast(
            "error",
            "기본설정 불러오기 실패",
            getKoreanErrorMessage(error.message, "기본설정을 불러오지 못했습니다.")
          );
          return;
        }

        if (!data) {
          return;
        }

        setSettings({
          login_id: user.login_id ?? "",
          email: user.email ?? "",
          password: "",
          password_confirm: "",
          driver_name: data.driver_name ?? user.driver_name ?? "",
          phone_number: data.phone_number ?? user.phone_number ?? "",
          signup_type: user.signup_type ?? "driver",
          is_coupang: user.is_coupang !== false,
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
    const { name } = e.target;
    const value =
      e.target instanceof HTMLInputElement && e.target.type === "checkbox"
        ? e.target.checked
        : e.target.value;

    setSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLoginIdChange = (value: string) => {
    setSettings((prev) => ({
      ...prev,
      login_id: sanitizeLoginIdInput(value),
    }));
  };

  const handleAffiliationCheckedChange = (checked: boolean) => {
    if (!checked) {
      showToast("info", "소속 선택 필요", "소속은 최소 1개 이상 선택해야 합니다.");
      return;
    }

    setSettings((prev) => ({
      ...prev,
      is_coupang: true,
    }));
  };

  const saveSettings = async () => {
    if (!user) return;

    const currentLoginId = normalizeLoginId(user.login_id);
    const loginIdLocked = Boolean(currentLoginId);
    const normalizedLoginId = normalizeLoginId(settings.login_id);
    const resolvedLoginId = currentLoginId || normalizedLoginId;
    const normalizedEmail = settings.email.trim();
    const nextPassword = settings.password;
    const nextPasswordConfirm = settings.password_confirm;
    const hasPasswordChange = Boolean(nextPassword || nextPasswordConfirm);

    if (loginIdLocked && currentLoginId !== normalizedLoginId) {
      showToast("error", "ID 수정 불가", "한번 설정한 ID는 변경할 수 없습니다.");
      return;
    }

    if (!loginIdLocked) {
      const loginIdValidationMessage = getLoginIdValidationMessage(normalizedLoginId);

      if (loginIdValidationMessage) {
        showToast("error", "ID를 확인해주세요", loginIdValidationMessage);
        return;
      }
    }

    if (!settings.is_coupang) {
      showToast("error", "소속을 확인해주세요", "소속은 최소 1개 이상 선택해야 합니다.");
      return;
    }

    if (!normalizedEmail) {
      showToast("error", "이메일을 확인해주세요", "이메일을 입력해주세요.");
      return;
    }

    if (hasPasswordChange) {
      if (!nextPassword || !nextPasswordConfirm) {
        showToast(
          "error",
          "비밀번호를 확인해주세요",
          "새 비밀번호와 비밀번호 확인을 모두 입력해주세요."
        );
        return;
      }

      if (nextPassword !== nextPasswordConfirm) {
        showToast(
          "error",
          "비밀번호가 일치하지 않습니다",
          "새 비밀번호와 비밀번호 확인을 다시 입력해주세요."
        );
        return;
      }

      if (nextPassword.length < 6) {
        showToast(
          "error",
          "비밀번호를 확인해주세요",
          "비밀번호는 6자 이상 입력해주세요."
        );
        return;
      }
    }

    setSaving(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setSaving(false);
      showToast("error", "세션 확인 실패", "다시 로그인한 뒤 시도해주세요.");
      return;
    }

    if (!loginIdLocked) {
      const loginIdResponse = await fetch("/api/auth/login-id", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ loginId: resolvedLoginId }),
      });

      if (!loginIdResponse.ok) {
        setSaving(false);
        showToast(
          "error",
          "ID 저장 실패",
          await readApiErrorMessage(loginIdResponse, "ID를 저장하지 못했습니다.")
        );
        return;
      }
    }

    const { error: authError } = await supabase.auth.updateUser({
      email: normalizedEmail,
      password: hasPasswordChange ? nextPassword : undefined,
      data: {
        login_id: resolvedLoginId,
        driver_name: settings.driver_name.trim(),
        phone_number: settings.phone_number.trim(),
        signup_type: settings.signup_type,
        is_coupang: settings.is_coupang,
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

    await recordOperatorAuditLog({
      action: "auth_profile_updated",
      targetType: "auth_user",
      targetId: user.id,
      summary: "관리 권한 계정이 자신의 프로필 정보를 수정했습니다.",
      details: {
        user_id: user.id,
        login_id: resolvedLoginId,
        email: normalizedEmail,
        password_changed: hasPasswordChange,
        driver_name: settings.driver_name.trim(),
        phone_number: settings.phone_number.trim(),
        signup_type: settings.signup_type,
        is_coupang: settings.is_coupang,
      },
    });

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

    await recordOperatorAuditLog({
      action: "driver_settings_saved",
      targetType: "driver_settings",
      targetId: user.id,
      summary: "관리 권한 계정이 기본설정을 저장했습니다.",
      details: {
        user_id: user.id,
        login_id: resolvedLoginId,
        email: normalizedEmail,
        password_changed: hasPasswordChange,
        driver_name: settings.driver_name.trim(),
        phone_number: settings.phone_number.trim(),
        signup_type: settings.signup_type,
        is_coupang: settings.is_coupang,
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
      },
    });

    setUser((prev) =>
      prev
        ? {
            ...prev,
            email: normalizedEmail,
          login_id: resolvedLoginId,
            driver_name: settings.driver_name.trim(),
            phone_number: settings.phone_number.trim(),
            signup_type: settings.signup_type,
            is_coupang: settings.is_coupang,
          }
        : prev
    );

    setSettings((prev) => ({
      ...prev,
      password: "",
      password_confirm: "",
    }));

    queuePendingToast({
      tone: "success",
      title: "기본설정 저장 완료",
      message: "변경한 설정이 대시보드에 반영됩니다.",
    });
    router.push("/dashboard");
  };

  if (loading || settingsLoading) {
    return <PageLoadingShell message="불러오는 중..." />;
  }

  const loginIdLocked = Boolean(normalizeLoginId(user?.login_id));

  return (
    <PageShell contentClassName="flex w-full max-w-[34rem] flex-col gap-4 sm:max-w-2xl sm:gap-5">
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} />
      <div className="flex w-full flex-col gap-4 sm:gap-5">
        <div className="retro-panel rounded-[24px] px-4 py-5 sm:rounded-[28px] sm:px-6 sm:py-6">
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div aria-hidden="true" />

              <div className="text-center">
                <h1 className="retro-title theme-heading text-xl leading-none sm:text-2xl md:text-[1.9rem]">
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
              계정 정보와 정산 기준을 함께 설정합니다.
            </p>
          </div>
        </div>

        <SettingsForm
          settings={settings}
          setSettings={setSettings}
          loginIdLocked={loginIdLocked}
          handleSettingsChange={handleSettingsChange}
          handleLoginIdChange={handleLoginIdChange}
          handleAffiliationCheckedChange={handleAffiliationCheckedChange}
          saveSettings={saveSettings}
          saving={saving}
        />
      </div>
    </PageShell>
  );
}