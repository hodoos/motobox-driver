import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  VehicleExpenseCategory,
  VehicleExpenseRow,
  VehicleManagementStorageMode,
  VehicleProfileRow,
} from "../types";

const VEHICLE_MANAGEMENT_DIRECTORY = path.join(process.cwd(), "logs");
const VEHICLE_MANAGEMENT_FILE_PATH = path.join(
  VEHICLE_MANAGEMENT_DIRECTORY,
  "vehicle-management.json"
);
const VEHICLE_PROFILE_COLUMNS =
  "user_id, vehicle_name, vehicle_model, plate_number, fuel_type, current_mileage_km, insurance_annual_cost, inspection_due_date, note, updated_at";
const VEHICLE_EXPENSE_COLUMNS =
  "id, user_id, expense_date, category, title, amount, vendor, note, created_at, updated_at";

const VEHICLE_EXPENSE_CATEGORIES = new Set<VehicleExpenseCategory>([
  "fuel",
  "maintenance",
  "repair",
  "parking",
  "wash",
  "insurance",
  "toll",
  "other",
]);

type VehicleManagementFileState = {
  profiles: VehicleProfileRow[];
  expenses: VehicleExpenseRow[];
};

export type VehicleProfileInput = {
  vehicle_name: string | null;
  vehicle_model: string | null;
  plate_number: string | null;
  fuel_type: string | null;
  current_mileage_km: number | null;
  insurance_annual_cost: number | null;
  inspection_due_date: string | null;
  note: string | null;
};

export type VehicleExpenseInput = {
  expense_date: string;
  category: VehicleExpenseCategory;
  title: string;
  amount: number;
  vendor: string | null;
  note: string | null;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  return text.slice(0, maxLength);
}

function normalizeRequiredText(value: unknown, maxLength: number) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  return text.slice(0, maxLength);
}

function normalizeDateOnly(value: unknown) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  const date = new Date(`${text}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return text;
}

function normalizeIsoDate(value: unknown) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function normalizeInteger(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/,/g, "").trim());

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed);
}

function isVehicleExpenseCategory(value: string): value is VehicleExpenseCategory {
  return VEHICLE_EXPENSE_CATEGORIES.has(value as VehicleExpenseCategory);
}

function sortVehicleExpenses(expenses: VehicleExpenseRow[]) {
  return [...expenses].sort((left, right) => {
    const expenseDateDelta = right.expense_date.localeCompare(left.expense_date);

    if (expenseDateDelta !== 0) {
      return expenseDateDelta;
    }

    const createdAtDelta =
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime();

    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }

    return right.id.localeCompare(left.id);
  });
}

function normalizeVehicleProfileRow(value: unknown): VehicleProfileRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const userId = normalizeText(value.user_id);
  const updatedAt = normalizeIsoDate(value.updated_at);

  if (!userId || !updatedAt) {
    return null;
  }

  return {
    user_id: userId,
    vehicle_name: normalizeOptionalText(value.vehicle_name, 80),
    vehicle_model: normalizeOptionalText(value.vehicle_model, 80),
    plate_number: normalizeOptionalText(value.plate_number, 32),
    fuel_type: normalizeOptionalText(value.fuel_type, 40),
    current_mileage_km: normalizeInteger(value.current_mileage_km),
    insurance_annual_cost: normalizeInteger(value.insurance_annual_cost),
    inspection_due_date: normalizeDateOnly(value.inspection_due_date),
    note: normalizeOptionalText(value.note, 500),
    updated_at: updatedAt,
  };
}

function normalizeVehicleExpenseRow(value: unknown): VehicleExpenseRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeText(value.id);
  const userId = normalizeText(value.user_id);
  const expenseDate = normalizeDateOnly(value.expense_date);
  const category = normalizeText(value.category);
  const title = normalizeRequiredText(value.title, 80);
  const amount = normalizeInteger(value.amount);
  const createdAt = normalizeIsoDate(value.created_at);
  const updatedAt = normalizeIsoDate(value.updated_at);

  if (
    !id ||
    !userId ||
    !expenseDate ||
    !isVehicleExpenseCategory(category) ||
    !title ||
    amount === null ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id,
    user_id: userId,
    expense_date: expenseDate,
    category,
    title,
    amount,
    vendor: normalizeOptionalText(value.vendor, 80),
    note: normalizeOptionalText(value.note, 300),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function createEmptyFileState(): VehicleManagementFileState {
  return {
    profiles: [],
    expenses: [],
  };
}

async function readVehicleManagementFile() {
  try {
    const raw = await readFile(VEHICLE_MANAGEMENT_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);

    if (!isRecord(parsed)) {
      return createEmptyFileState();
    }

    const profiles = Array.isArray(parsed.profiles)
      ? parsed.profiles
          .map((value) => normalizeVehicleProfileRow(value))
          .filter((value): value is VehicleProfileRow => Boolean(value))
      : [];

    const expenses = Array.isArray(parsed.expenses)
      ? parsed.expenses
          .map((value) => normalizeVehicleExpenseRow(value))
          .filter((value): value is VehicleExpenseRow => Boolean(value))
      : [];

    return {
      profiles,
      expenses: sortVehicleExpenses(expenses),
    } satisfies VehicleManagementFileState;
  } catch {
    return createEmptyFileState();
  }
}

async function writeVehicleManagementFile(state: VehicleManagementFileState) {
  await mkdir(VEHICLE_MANAGEMENT_DIRECTORY, { recursive: true });
  await writeFile(VEHICLE_MANAGEMENT_FILE_PATH, JSON.stringify(state, null, 2), "utf8");
}

function isEmptyVehicleProfileInput(input: VehicleProfileInput) {
  return (
    !input.vehicle_name &&
    !input.vehicle_model &&
    !input.plate_number &&
    !input.fuel_type &&
    input.current_mileage_km === null &&
    input.insurance_annual_cost === null &&
    !input.inspection_due_date &&
    !input.note
  );
}

export function normalizeVehicleProfileInput(value: unknown): VehicleProfileInput | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    vehicle_name: normalizeOptionalText(value.vehicle_name, 80),
    vehicle_model: normalizeOptionalText(value.vehicle_model, 80),
    plate_number: normalizeOptionalText(value.plate_number, 32),
    fuel_type: normalizeOptionalText(value.fuel_type, 40),
    current_mileage_km: normalizeInteger(value.current_mileage_km),
    insurance_annual_cost: normalizeInteger(value.insurance_annual_cost),
    inspection_due_date: normalizeDateOnly(value.inspection_due_date),
    note: normalizeOptionalText(value.note, 500),
  };
}

export function normalizeVehicleExpenseInput(value: unknown): VehicleExpenseInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const expenseDate = normalizeDateOnly(value.expense_date);
  const category = normalizeText(value.category);
  const title = normalizeRequiredText(value.title, 80);
  const amount = normalizeInteger(value.amount);

  if (!expenseDate || !isVehicleExpenseCategory(category) || !title || amount === null) {
    return null;
  }

  return {
    expense_date: expenseDate,
    category,
    title,
    amount,
    vendor: normalizeOptionalText(value.vendor, 80),
    note: normalizeOptionalText(value.note, 300),
  };
}

export function normalizeVehicleExpenseDeleteInput(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeText(value.id);
  return id || null;
}

export function normalizeVehicleExpenseUpdateInput(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeText(value.id);
  const expense = normalizeVehicleExpenseInput(value);

  if (!id || !expense) {
    return null;
  }

  return {
    id,
    ...expense,
  };
}

function createVehicleExpenseRecord(userId: string, input: VehicleExpenseInput): VehicleExpenseRow {
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    user_id: userId,
    expense_date: input.expense_date,
    category: input.category,
    title: input.title,
    amount: input.amount,
    vendor: input.vendor,
    note: input.note,
    created_at: now,
    updated_at: now,
  };
}

export async function listStoredVehicleManagement(
  adminClient: SupabaseClient | null,
  userId: string
) {
  if (adminClient) {
    const [profileResult, expenseResult] = await Promise.all([
      adminClient
        .from("vehicle_profiles")
        .select(VEHICLE_PROFILE_COLUMNS)
        .eq("user_id", userId)
        .maybeSingle(),
      adminClient
        .from("vehicle_expenses")
        .select(VEHICLE_EXPENSE_COLUMNS)
        .eq("user_id", userId)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    if (!profileResult.error && !expenseResult.error) {
      return {
        profile: profileResult.data ? normalizeVehicleProfileRow(profileResult.data) : null,
        expenses: Array.isArray(expenseResult.data)
          ? expenseResult.data
              .map((value) => normalizeVehicleExpenseRow(value))
              .filter((value): value is VehicleExpenseRow => Boolean(value))
          : [],
        storage: "database" as VehicleManagementStorageMode,
      };
    }
  }

  const fileState = await readVehicleManagementFile();

  return {
    profile: fileState.profiles.find((profile) => profile.user_id === userId) ?? null,
    expenses: fileState.expenses.filter((expense) => expense.user_id === userId),
    storage: "file-fallback" as VehicleManagementStorageMode,
  };
}

export async function saveStoredVehicleProfile(
  adminClient: SupabaseClient | null,
  userId: string,
  input: VehicleProfileInput
) {
  const now = new Date().toISOString();

  if (adminClient) {
    if (isEmptyVehicleProfileInput(input)) {
      const { error } = await adminClient.from("vehicle_profiles").delete().eq("user_id", userId);

      if (!error) {
        return {
          profile: null,
          storage: "database" as VehicleManagementStorageMode,
        };
      }
    } else {
      const { data, error } = await adminClient
        .from("vehicle_profiles")
        .upsert(
          {
            user_id: userId,
            ...input,
            updated_at: now,
          },
          { onConflict: "user_id" }
        )
        .select(VEHICLE_PROFILE_COLUMNS)
        .maybeSingle();

      if (!error && data) {
        const profile = normalizeVehicleProfileRow(data);

        if (profile) {
          return {
            profile,
            storage: "database" as VehicleManagementStorageMode,
          };
        }
      }
    }
  }

  const fileState = await readVehicleManagementFile();
  const nextProfiles = fileState.profiles.filter((profile) => profile.user_id !== userId);

  if (!isEmptyVehicleProfileInput(input)) {
    nextProfiles.push({
      user_id: userId,
      ...input,
      updated_at: now,
    });
  }

  await writeVehicleManagementFile({
    ...fileState,
    profiles: nextProfiles,
  });

  return {
    profile: nextProfiles.find((profile) => profile.user_id === userId) ?? null,
    storage: "file-fallback" as VehicleManagementStorageMode,
  };
}

export async function createStoredVehicleExpense(
  adminClient: SupabaseClient | null,
  userId: string,
  input: VehicleExpenseInput
) {
  const nextExpense = createVehicleExpenseRecord(userId, input);

  if (adminClient) {
    const { data, error } = await adminClient
      .from("vehicle_expenses")
      .insert(nextExpense)
      .select(VEHICLE_EXPENSE_COLUMNS)
      .maybeSingle();

    if (!error && data) {
      const expense = normalizeVehicleExpenseRow(data);

      if (expense) {
        return {
          expense,
          storage: "database" as VehicleManagementStorageMode,
        };
      }
    }
  }

  const fileState = await readVehicleManagementFile();
  const nextExpenses = sortVehicleExpenses([nextExpense, ...fileState.expenses]);

  await writeVehicleManagementFile({
    ...fileState,
    expenses: nextExpenses,
  });

  return {
    expense: nextExpense,
    storage: "file-fallback" as VehicleManagementStorageMode,
  };
}

export async function deleteStoredVehicleExpense(
  adminClient: SupabaseClient | null,
  userId: string,
  expenseId: string
) {
  if (adminClient) {
    const { data, error } = await adminClient
      .from("vehicle_expenses")
      .delete()
      .eq("user_id", userId)
      .eq("id", expenseId)
      .select("id")
      .maybeSingle();

    if (!error) {
      return {
        deleted: Boolean(data?.id),
        storage: "database" as VehicleManagementStorageMode,
      };
    }
  }

  const fileState = await readVehicleManagementFile();
  const nextExpenses = fileState.expenses.filter(
    (expense) => !(expense.user_id === userId && expense.id === expenseId)
  );

  const deleted = nextExpenses.length !== fileState.expenses.length;

  if (deleted) {
    await writeVehicleManagementFile({
      ...fileState,
      expenses: nextExpenses,
    });
  }

  return {
    deleted,
    storage: "file-fallback" as VehicleManagementStorageMode,
  };
}

export async function updateStoredVehicleExpense(
  adminClient: SupabaseClient | null,
  userId: string,
  expenseId: string,
  input: VehicleExpenseInput
) {
  const now = new Date().toISOString();

  if (adminClient) {
    const { data, error } = await adminClient
      .from("vehicle_expenses")
      .update({
        expense_date: input.expense_date,
        category: input.category,
        title: input.title,
        amount: input.amount,
        vendor: input.vendor,
        note: input.note,
        updated_at: now,
      })
      .eq("user_id", userId)
      .eq("id", expenseId)
      .select(VEHICLE_EXPENSE_COLUMNS)
      .maybeSingle();

    if (!error) {
      const expense = normalizeVehicleExpenseRow(data);

      if (expense) {
        return {
          expense,
          storage: "database" as VehicleManagementStorageMode,
        };
      }

      return {
        expense: null,
        storage: "database" as VehicleManagementStorageMode,
      };
    }
  }

  const fileState = await readVehicleManagementFile();
  let updatedExpense: VehicleExpenseRow | null = null;
  const nextExpenses = sortVehicleExpenses(
    fileState.expenses.map((expense) => {
      if (expense.user_id !== userId || expense.id !== expenseId) {
        return expense;
      }

      updatedExpense = {
        ...expense,
        expense_date: input.expense_date,
        category: input.category,
        title: input.title,
        amount: input.amount,
        vendor: input.vendor,
        note: input.note,
        updated_at: now,
      };

      return updatedExpense;
    })
  );

  if (updatedExpense) {
    await writeVehicleManagementFile({
      ...fileState,
      expenses: nextExpenses,
    });
  }

  return {
    expense: updatedExpense,
    storage: "file-fallback" as VehicleManagementStorageMode,
  };
}