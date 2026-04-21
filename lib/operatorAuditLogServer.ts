import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { User } from "@supabase/supabase-js";
import {
  canRecordStaffAuditLog,
  createOperatorAuditLogRow,
  type OperatorAuditLogInput,
} from "./operatorAuditLog";

const OPERATOR_AUDIT_LOG_DIRECTORY = path.join(process.cwd(), "logs");
const OPERATOR_AUDIT_LOG_FILE_PATH = path.join(
  OPERATOR_AUDIT_LOG_DIRECTORY,
  "operator-audit-log.ndjson"
);

export async function appendOperatorAuditLogFile(
  actor: Pick<User, "id" | "email" | "app_metadata" | "user_metadata"> | null | undefined,
  input: OperatorAuditLogInput
) {
  if (!actor || !canRecordStaffAuditLog(actor)) {
    return false;
  }

  const logRecord = {
    ...createOperatorAuditLogRow(actor, input),
    created_at: new Date().toISOString(),
    storage: "file-fallback",
  };

  await mkdir(OPERATOR_AUDIT_LOG_DIRECTORY, { recursive: true });
  await appendFile(OPERATOR_AUDIT_LOG_FILE_PATH, `${JSON.stringify(logRecord)}\n`, "utf8");

  return true;
}