import type { User } from "@supabase/supabase-js";
import { isAdminUser, isOperatorUser } from "./admin";
import { getUserLevel } from "./userLevel";
import type { StaffAuditLogRow } from "../types";

export type OperatorAuditLogInput = {
  action: string;
  targetType: string;
  targetId?: string | null;
  summary: string;
  details?: Record<string, unknown>;
  source?: string | null;
};

type InsertError = {
  message?: string;
} | null;

type OperatorAuditInsertClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => Promise<{ error: InsertError }>;
  };
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: unknown) {
  const normalizedValue = normalizeText(value);
  return normalizedValue || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeOperatorAuditLogInput(value: unknown): OperatorAuditLogInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const action = normalizeText(value.action);
  const targetType = normalizeText(value.targetType);
  const summary = normalizeText(value.summary);

  if (!action || !targetType || !summary) {
    return null;
  }

  return {
    action,
    targetType,
    targetId: normalizeOptionalText(value.targetId),
    summary,
    details: isRecord(value.details) ? value.details : {},
    source: normalizeOptionalText(value.source),
  };
}

export function getStaffAuditActorLevel(
  actor: Pick<User, "app_metadata" | "user_metadata"> | null | undefined
) {
  if (isOperatorUser(actor)) {
    return "운영자Lv";
  }

  if (isAdminUser(actor)) {
    return "관리자Lv";
  }

  return getUserLevel(actor);
}

export function canRecordStaffAuditLog(
  actor: Pick<User, "app_metadata" | "user_metadata"> | null | undefined
) {
  return isAdminUser(actor);
}

export function createOperatorAuditLogRow(
  actor: Pick<User, "id" | "email" | "app_metadata" | "user_metadata">,
  input: OperatorAuditLogInput
): Omit<StaffAuditLogRow, "id" | "created_at"> {
  return {
    actor_user_id: actor.id,
    actor_email: normalizeOptionalText(actor.email),
    actor_level: getStaffAuditActorLevel(actor),
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    source: input.source ?? null,
    summary: input.summary,
    details: input.details ?? {},
  };
}

export async function insertOperatorAuditLog(
  adminClient: OperatorAuditInsertClient,
  actor: Pick<User, "id" | "email" | "app_metadata" | "user_metadata"> | null | undefined,
  input: OperatorAuditLogInput
) {
  if (!actor || !canRecordStaffAuditLog(actor)) {
    return {
      recorded: false,
      error: null,
    };
  }

  const { error } = await adminClient
    .from("operator_audit_logs")
    .insert(createOperatorAuditLogRow(actor, input));

  return {
    recorded: !error,
    error,
  };
}