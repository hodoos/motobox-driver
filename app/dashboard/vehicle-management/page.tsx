"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { canUserAccessMenuItem, getDefaultMenuVisibilitySettings } from "../../../lib/menuVisibility";
import { formatMoney, toDateString } from "../../../lib/format";
import { supabase } from "../../../lib/supabase";
import { createToastState, type ToastState } from "../../../lib/toast";
import PageShell, { PageLoadingShell } from "../../../components/layout/PageShell";
import ToastViewport from "../../../components/ui/ToastViewport";
import type {
  MenuVisibilitySettings,
  MenuVisibilitySettingsResponse,
  VehicleExpenseDeleteResponse,
  VehicleExpenseMutationResponse,
  VehicleExpenseRow,
  VehicleManagementResponse,
  VehicleManagementStorageMode,
  VehicleProfileMutationResponse,
  VehicleProfileRow,
} from "../../../types";

type TrackedVehicleExpenseCategory = "fuel" | "maintenance";

type VehicleProfileFormState = {
  vehicle_model: string;
  current_mileage_km: string;
  insurance_annual_cost: string;
};

type VehicleExpenseFormState = {
  expense_date: string;
  amount: string;
};

type VehicleExpensePanelProps = {
  title: string;
  totalAmount: number;
  expenses: VehicleExpenseRow[];
  form: VehicleExpenseFormState;
  saving: boolean;
  deletingExpenseId: string | null;
  onFormChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onDelete: (expenseId: string) => void;
};

type VehicleExpenseStatRow = {
  id: string;
  label: string;
  count: number;
  fuelAmount: number;
  maintenanceAmount: number;
  totalAmount: number;
};

type VehicleExpenseStatsSectionProps = {
  title: string;
  description: string;
  rows: VehicleExpenseStatRow[];
  emptyMessage: string;
};

const VEHICLE_EXPENSE_LABELS: Record<TrackedVehicleExpenseCategory, string> = {
  fuel: "주유/충전",
  maintenance: "차량 정비",
};

function createEmptyVehicleProfileForm(): VehicleProfileFormState {
  return {
    vehicle_model: "",
    current_mileage_km: "",
    insurance_annual_cost: "",
  };
}

function createEmptyExpenseForm(dateKey: string): VehicleExpenseFormState {
  return {
    expense_date: dateKey,
    amount: "",
  };
}

function getExpenseMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");

  if (!year || !month) {
    return monthKey;
  }

  return `${year}년 ${Number(month)}월`;
}

function isVehicleManagementResponse(value: unknown): value is VehicleManagementResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      "expenses" in value &&
      Array.isArray((value as { expenses?: unknown }).expenses)
  );
}

function isVehicleProfileMutationResponse(value: unknown): value is VehicleProfileMutationResponse {
  return Boolean(value && typeof value === "object" && "storage" in value && "profile" in value);
}

function isVehicleExpenseMutationResponse(value: unknown): value is VehicleExpenseMutationResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      "expense" in value &&
      (value as { expense?: unknown }).expense &&
      typeof (value as { expense?: unknown }).expense === "object"
  );
}

function isVehicleExpenseDeleteResponse(value: unknown): value is VehicleExpenseDeleteResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      "deletedId" in value &&
      typeof (value as { deletedId?: unknown }).deletedId === "string"
  );
}

async function getSupabaseAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

async function loadClientMenuVisibilitySettings() {
  const response = await fetch("/api/menu-visibility", {
    method: "GET",
    cache: "no-store",
  });
  const responseBody = (await response.json().catch(() => null)) as
    | MenuVisibilitySettingsResponse
    | { error?: string }
    | null;

  if (!response.ok || !responseBody || !("settings" in responseBody) || !responseBody.settings) {
    return getDefaultMenuVisibilitySettings();
  }

  return responseBody.settings;
}

async function readApiErrorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);

  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }

  return fallback;
}

function mapProfileRowToForm(profile: VehicleProfileRow | null): VehicleProfileFormState {
  if (!profile) {
    return createEmptyVehicleProfileForm();
  }

  return {
    vehicle_model: profile.vehicle_model ?? "",
    current_mileage_km:
      profile.current_mileage_km !== null && profile.current_mileage_km !== undefined
        ? String(profile.current_mileage_km)
        : "",
    insurance_annual_cost:
      profile.insurance_annual_cost !== null && profile.insurance_annual_cost !== undefined
        ? String(profile.insurance_annual_cost)
        : "",
  };
}

function sortVehicleExpenses(expenses: VehicleExpenseRow[]) {
  return [...expenses].sort((left, right) => {
    const expenseDateDelta = right.expense_date.localeCompare(left.expense_date);

    if (expenseDateDelta !== 0) {
      return expenseDateDelta;
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
}

function createVehicleExpenseStatRows(
  expenses: VehicleExpenseRow[],
  mode: "day" | "month"
) {
  const statMap = new Map<string, VehicleExpenseStatRow>();

  expenses.forEach((expense) => {
    const key = mode === "day" ? expense.expense_date : expense.expense_date.slice(0, 7);
    const label = mode === "day" ? expense.expense_date : getExpenseMonthLabel(key);
    const current = statMap.get(key) ?? {
      id: key,
      label,
      count: 0,
      fuelAmount: 0,
      maintenanceAmount: 0,
      totalAmount: 0,
    };

    if (expense.category === "fuel") {
      current.fuelAmount += expense.amount;
    }

    if (expense.category === "maintenance") {
      current.maintenanceAmount += expense.amount;
    }

    current.count += 1;
    current.totalAmount += expense.amount;
    statMap.set(key, current);
  });

  return Array.from(statMap.values()).sort((left, right) => right.id.localeCompare(left.id));
}

function VehicleExpensePanel({
  title,
  totalAmount,
  expenses,
  form,
  saving,
  deletingExpenseId,
  onFormChange,
  onSubmit,
  onDelete,
}: VehicleExpensePanelProps) {
  return (
    <section className="retro-panel rounded-3xl px-4 py-5 sm:rounded-[28px] sm:px-5 sm:py-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="retro-title theme-heading text-base sm:text-lg">{title}</p>
          <p className="theme-copy text-sm leading-relaxed">날짜와 비용만 간단히 기록합니다.</p>
        </div>
        <p className="theme-copy text-xs">총 {expenses.length}건 · {formatMoney(totalAmount)}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <input
          type="date"
          name="expense_date"
          value={form.expense_date}
          onChange={onFormChange}
          className="block h-12 w-full rounded-2xl px-4 py-3 text-sm"
        />
        <input
          type="number"
          min="0"
          name="amount"
          value={form.amount}
          onChange={onFormChange}
          placeholder="비용"
          className="block h-12 w-full rounded-2xl px-4 py-3 text-sm"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="retro-button-solid min-h-12 px-5 py-3 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "저장 중..." : "추가"}
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="theme-note-box mt-4 rounded-2xl px-4 py-4 text-sm leading-relaxed">
          아직 기록이 없습니다.
        </div>
      ) : (
        <div className="mt-4 grid gap-2.5">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="theme-note-box flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
            >
              <div className="min-w-0">
                <p className="theme-heading text-sm font-semibold">{expense.expense_date}</p>
                <p className="theme-copy text-xs">{title}</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="theme-heading whitespace-nowrap text-sm font-semibold">
                  {formatMoney(expense.amount)}
                </p>
                <button
                  type="button"
                  onClick={() => onDelete(expense.id)}
                  disabled={deletingExpenseId === expense.id}
                  className="retro-button min-h-9.5 px-3 py-2 text-xs font-semibold disabled:opacity-60"
                >
                  {deletingExpenseId === expense.id ? "삭제 중..." : "삭제"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function VehicleExpenseStatsSection({
  title,
  description,
  rows,
  emptyMessage,
}: VehicleExpenseStatsSectionProps) {
  return (
    <section className="retro-panel rounded-3xl px-4 py-5 sm:rounded-[28px] sm:px-5 sm:py-6">
      <div className="space-y-1">
        <p className="retro-title theme-heading text-base sm:text-lg">{title}</p>
        <p className="theme-copy text-sm leading-relaxed">{description}</p>
      </div>

      {rows.length === 0 ? (
        <div className="theme-note-box mt-4 rounded-2xl px-4 py-4 text-sm leading-relaxed">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-4 grid gap-2.5">
          {rows.map((row) => (
            <div key={row.id} className="theme-note-box rounded-2xl px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="theme-heading text-sm font-semibold">{row.label}</p>
                  <p className="theme-copy text-xs">총 {row.count}건</p>
                </div>

                <div className="grid grid-cols-3 gap-3 sm:min-w-88">
                  <div>
                    <p className="theme-copy text-[11px]">주유/충전</p>
                    <p className="theme-heading text-sm font-semibold">
                      {formatMoney(row.fuelAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="theme-copy text-[11px]">정비</p>
                    <p className="theme-heading text-sm font-semibold">
                      {formatMoney(row.maintenanceAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="theme-copy text-[11px]">합계</p>
                    <p className="theme-heading text-sm font-semibold">
                      {formatMoney(row.totalAmount)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function VehicleManagementPage() {
  const router = useRouter();
  const todayString = toDateString(new Date());

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [menuVisibilitySettings, setMenuVisibilitySettings] = useState<MenuVisibilitySettings>(
    () => getDefaultMenuVisibilitySettings()
  );
  const [loading, setLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [savingExpenseCategory, setSavingExpenseCategory] =
    useState<TrackedVehicleExpenseCategory | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [storageMode, setStorageMode] = useState<VehicleManagementStorageMode | null>(null);
  const [storedProfileRow, setStoredProfileRow] = useState<VehicleProfileRow | null>(null);
  const [vehicleProfile, setVehicleProfile] = useState<VehicleProfileFormState>(() =>
    createEmptyVehicleProfileForm()
  );
  const [fuelExpenseForm, setFuelExpenseForm] = useState<VehicleExpenseFormState>(() =>
    createEmptyExpenseForm(todayString)
  );
  const [maintenanceExpenseForm, setMaintenanceExpenseForm] = useState<VehicleExpenseFormState>(() =>
    createEmptyExpenseForm(todayString)
  );
  const [expenses, setExpenses] = useState<VehicleExpenseRow[]>([]);

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

      const nextMenuVisibilitySettings = await loadClientMenuVisibilitySettings();

      if (!canUserAccessMenuItem(nextMenuVisibilitySettings, "dashboard", user)) {
        router.replace("/dashboard");
        return;
      }

      setAuthUser(user);
      setMenuVisibilitySettings(nextMenuVisibilitySettings);

      const accessToken = await getSupabaseAccessToken();

      if (!accessToken) {
        setLoading(false);
        showToast("error", "세션 확인 실패", "다시 로그인한 뒤 차량관리 메뉴를 열어주세요.");
        return;
      }

      const response = await fetch("/api/vehicle-management", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });
      const responseBody = (await response.json().catch(() => null)) as
        | VehicleManagementResponse
        | { error?: string }
        | null;

      if (!response.ok || !responseBody || !isVehicleManagementResponse(responseBody)) {
        setLoading(false);
        showToast(
          "error",
          "차량관리 불러오기 실패",
          responseBody && typeof responseBody === "object" && "error" in responseBody
            ? responseBody.error
            : "차량관리 정보를 불러오지 못했습니다."
        );
        return;
      }

      setStoredProfileRow(responseBody.profile);
      setVehicleProfile(mapProfileRowToForm(responseBody.profile));
      setExpenses(sortVehicleExpenses(responseBody.expenses));
      setStorageMode(responseBody.storage);
      setLoading(false);
    };

    void init();
  }, [router]);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    if (!canUserAccessMenuItem(menuVisibilitySettings, "dashboard", authUser)) {
      router.replace("/dashboard");
    }
  }, [authUser, menuVisibilitySettings, router]);

  const fuelExpenses = useMemo(
    () => expenses.filter((expense) => expense.category === "fuel"),
    [expenses]
  );
  const maintenanceExpenses = useMemo(
    () => expenses.filter((expense) => expense.category === "maintenance"),
    [expenses]
  );
  const fuelTotalAmount = useMemo(
    () => fuelExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [fuelExpenses]
  );
  const maintenanceTotalAmount = useMemo(
    () => maintenanceExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [maintenanceExpenses]
  );
  const dailyStatRows = useMemo(() => createVehicleExpenseStatRows(expenses, "day"), [expenses]);
  const monthlyStatRows = useMemo(
    () => createVehicleExpenseStatRows(expenses, "month"),
    [expenses]
  );
  const insuranceAnnualCost = Number(vehicleProfile.insurance_annual_cost || 0);
  const insuranceMonthlyCost = Math.round(insuranceAnnualCost / 12);
  const insuranceDailyCost = Math.round(insuranceAnnualCost / 365);
  const storageModeLabel =
    storageMode === "database" ? "클라우드 저장" : storageMode === "file-fallback" ? "로컬 저장" : "확인 중";

  const handleProfileFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setVehicleProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFuelExpenseFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setFuelExpenseForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleMaintenanceExpenseFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setMaintenanceExpenseForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveVehicleProfile = async () => {
    if (!authUser) {
      return;
    }

    setProfileSaving(true);

    const accessToken = await getSupabaseAccessToken();

    if (!accessToken) {
      setProfileSaving(false);
      showToast("error", "세션 확인 실패", "다시 로그인한 뒤 다시 시도해주세요.");
      return;
    }

    const response = await fetch("/api/vehicle-management", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vehicle_name: storedProfileRow?.vehicle_name ?? null,
        vehicle_model: vehicleProfile.vehicle_model,
        plate_number: storedProfileRow?.plate_number ?? null,
        fuel_type: storedProfileRow?.fuel_type ?? null,
        current_mileage_km: vehicleProfile.current_mileage_km,
        insurance_annual_cost: vehicleProfile.insurance_annual_cost,
        inspection_due_date: storedProfileRow?.inspection_due_date ?? null,
        note: storedProfileRow?.note ?? null,
      }),
    });
    const responseBody = (await response.json().catch(() => null)) as
      | VehicleProfileMutationResponse
      | { error?: string }
      | null;

    setProfileSaving(false);

    if (!response.ok || !responseBody || !isVehicleProfileMutationResponse(responseBody)) {
      showToast(
        "error",
        "차량 정보 저장 실패",
        responseBody && typeof responseBody === "object" && "error" in responseBody
          ? responseBody.error
          : "차량 기본정보를 저장하지 못했습니다."
      );
      return;
    }

    setStoredProfileRow(responseBody.profile);
    setVehicleProfile(mapProfileRowToForm(responseBody.profile));
    setStorageMode(responseBody.storage);
    showToast("success", "차량 정보 저장 완료", "차종, 주행거리, 보험비를 저장했습니다.");
  };

  const saveVehicleExpense = async (
    category: TrackedVehicleExpenseCategory,
    form: VehicleExpenseFormState,
    resetForm: React.Dispatch<React.SetStateAction<VehicleExpenseFormState>>
  ) => {
    if (!authUser) {
      return;
    }

    if (!form.expense_date || !form.amount.trim()) {
      showToast("error", "지출 기록 확인 필요", "날짜와 비용을 입력해주세요.");
      return;
    }

    if (Number.isNaN(Number(form.amount)) || Number(form.amount) < 0) {
      showToast("error", "금액 확인 필요", "비용은 0원 이상 숫자로 입력해주세요.");
      return;
    }

    setSavingExpenseCategory(category);

    const accessToken = await getSupabaseAccessToken();

    if (!accessToken) {
      setSavingExpenseCategory(null);
      showToast("error", "세션 확인 실패", "다시 로그인한 뒤 다시 시도해주세요.");
      return;
    }

    const response = await fetch("/api/vehicle-management", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expense_date: form.expense_date,
        category,
        title: VEHICLE_EXPENSE_LABELS[category],
        amount: form.amount,
        vendor: null,
        note: null,
      }),
    });
    const responseBody = (await response.json().catch(() => null)) as
      | VehicleExpenseMutationResponse
      | { error?: string }
      | null;

    setSavingExpenseCategory(null);

    if (!response.ok || !responseBody || !isVehicleExpenseMutationResponse(responseBody)) {
      showToast(
        "error",
        "지출 기록 저장 실패",
        responseBody && typeof responseBody === "object" && "error" in responseBody
          ? responseBody.error
          : "차량 지출을 저장하지 못했습니다."
      );
      return;
    }

    setExpenses((prev) => sortVehicleExpenses([responseBody.expense, ...prev]));
    setStorageMode(responseBody.storage);
    resetForm(createEmptyExpenseForm(todayString));
    showToast("success", "지출 기록 저장 완료", `${VEHICLE_EXPENSE_LABELS[category]} 비용을 추가했습니다.`);
  };

  const deleteVehicleExpense = async (expenseId: string) => {
    setDeletingExpenseId(expenseId);

    const accessToken = await getSupabaseAccessToken();

    if (!accessToken) {
      setDeletingExpenseId(null);
      showToast("error", "세션 확인 실패", "다시 로그인한 뒤 다시 시도해주세요.");
      return;
    }

    const response = await fetch("/api/vehicle-management", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: expenseId }),
    });

    if (!response.ok) {
      setDeletingExpenseId(null);
      showToast(
        "error",
        "지출 기록 삭제 실패",
        await readApiErrorMessage(response, "지출 기록을 삭제하지 못했습니다.")
      );
      return;
    }

    const responseBody = (await response.json().catch(() => null)) as
      | VehicleExpenseDeleteResponse
      | { error?: string }
      | null;

    setDeletingExpenseId(null);

    if (!responseBody || !isVehicleExpenseDeleteResponse(responseBody)) {
      showToast("error", "지출 기록 삭제 실패", "삭제 결과를 확인하지 못했습니다.");
      return;
    }

    setExpenses((prev) => prev.filter((expense) => expense.id !== responseBody.deletedId));
    setStorageMode(responseBody.storage);
    showToast("success", "지출 기록 삭제 완료", "선택한 지출 기록을 삭제했습니다.");
  };

  if (loading) {
    return <PageLoadingShell message="차량관리 불러오는 중..." />;
  }

  return (
    <PageShell contentClassName="flex w-full min-w-0 max-w-[34rem] flex-col gap-3 sm:max-w-4xl sm:gap-4 xl:max-w-5xl">
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex w-full flex-col gap-3 sm:gap-4">
        <section className="retro-panel rounded-3xl px-4 py-5 sm:rounded-[28px] sm:px-5 sm:py-6">
          <p className="retro-title theme-kicker text-[10px]">VEHICLE MANAGEMENT</p>
          <div className="mt-2 space-y-1">
            <h1 className="retro-title theme-heading text-lg sm:text-xl">차량관리</h1>
            <p className="theme-copy text-sm leading-relaxed">
              차종, 현재 주행거리, 보험비와 일별 주유/충전·정비 지출만 간단히 관리합니다.
            </p>
            <p className="theme-copy text-xs">저장 방식: {storageModeLabel}</p>
          </div>
        </section>

        <section className="retro-panel rounded-3xl px-4 py-5 sm:rounded-[28px] sm:px-5 sm:py-6">
          <div className="space-y-1">
            <p className="retro-title theme-heading text-base sm:text-lg">기본정보</p>
            <p className="theme-copy text-sm leading-relaxed">
              필요한 정보만 저장하고, 보험비는 연간 비용을 넣으면 월/일 비용이 자동 계산됩니다.
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <input
              type="text"
              name="vehicle_model"
              value={vehicleProfile.vehicle_model}
              onChange={handleProfileFieldChange}
              placeholder="차종"
              className="block h-12 w-full rounded-2xl px-4 py-3 text-sm"
            />
            <input
              type="number"
              min="0"
              name="current_mileage_km"
              value={vehicleProfile.current_mileage_km}
              onChange={handleProfileFieldChange}
              placeholder="현재 주행거리(km)"
              className="block h-12 w-full rounded-2xl px-4 py-3 text-sm"
            />
            <input
              type="number"
              min="0"
              name="insurance_annual_cost"
              value={vehicleProfile.insurance_annual_cost}
              onChange={handleProfileFieldChange}
              placeholder="보험비 연간 비용"
              className="block h-12 w-full rounded-2xl px-4 py-3 text-sm"
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="retro-card rounded-2xl px-4 py-4">
              <p className="theme-kicker text-[10px]">보험비 연간</p>
              <p className="theme-heading mt-2 text-base font-semibold sm:text-lg">
                {formatMoney(insuranceAnnualCost)}
              </p>
            </div>
            <div className="retro-card rounded-2xl px-4 py-4">
              <p className="theme-kicker text-[10px]">보험비 월간</p>
              <p className="theme-heading mt-2 text-base font-semibold sm:text-lg">
                {formatMoney(insuranceMonthlyCost)}
              </p>
            </div>
            <div className="retro-card rounded-2xl px-4 py-4">
              <p className="theme-kicker text-[10px]">보험비 일간</p>
              <p className="theme-heading mt-2 text-base font-semibold sm:text-lg">
                {formatMoney(insuranceDailyCost)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={saveVehicleProfile}
              disabled={profileSaving}
              className="retro-button-solid min-h-11.5 px-5 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {profileSaving ? "저장 중..." : "기본정보 저장"}
            </button>
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-2">
          <VehicleExpensePanel
            title="일별 주유/충전 지출"
            totalAmount={fuelTotalAmount}
            expenses={fuelExpenses}
            form={fuelExpenseForm}
            saving={savingExpenseCategory === "fuel"}
            deletingExpenseId={deletingExpenseId}
            onFormChange={handleFuelExpenseFieldChange}
            onSubmit={() => saveVehicleExpense("fuel", fuelExpenseForm, setFuelExpenseForm)}
            onDelete={deleteVehicleExpense}
          />

          <VehicleExpensePanel
            title="일별 차량 정비 지출"
            totalAmount={maintenanceTotalAmount}
            expenses={maintenanceExpenses}
            form={maintenanceExpenseForm}
            saving={savingExpenseCategory === "maintenance"}
            deletingExpenseId={deletingExpenseId}
            onFormChange={handleMaintenanceExpenseFieldChange}
            onSubmit={() =>
              saveVehicleExpense("maintenance", maintenanceExpenseForm, setMaintenanceExpenseForm)
            }
            onDelete={deleteVehicleExpense}
          />
        </section>

        <section className="grid gap-3 xl:grid-cols-2">
          <VehicleExpenseStatsSection
            title="일별 통계"
            description="날짜별로 주유/충전과 정비 지출 합계를 한 번에 봅니다."
            rows={dailyStatRows}
            emptyMessage="아직 일별 통계를 만들 지출 기록이 없습니다."
          />

          <VehicleExpenseStatsSection
            title="월별 통계"
            description="월 기준으로 누적된 차량 지출을 바로 확인합니다."
            rows={monthlyStatRows}
            emptyMessage="아직 월별 통계를 만들 지출 기록이 없습니다."
          />
        </section>
      </div>
    </PageShell>
  );
}