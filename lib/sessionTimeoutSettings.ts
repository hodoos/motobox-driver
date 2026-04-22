import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_SESSION_TIMEOUT_MINUTES,
  parseSessionTimeoutMinutes,
} from "./sessionTimeoutConfig";

type SessionTimeoutSettingsRecord = {
  timeout_minutes: number;
  updated_at: string | null;
};

const SESSION_TIMEOUT_SETTINGS_DIRECTORY = path.join(process.cwd(), "logs");
const SESSION_TIMEOUT_SETTINGS_FILE_PATH = path.join(
  SESSION_TIMEOUT_SETTINGS_DIRECTORY,
  "session-timeout-settings.json"
);

function getDefaultSessionTimeoutSettings(): SessionTimeoutSettingsRecord {
  return {
    timeout_minutes: DEFAULT_SESSION_TIMEOUT_MINUTES,
    updated_at: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSessionTimeoutSettingsRecord(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const timeoutMinutes = parseSessionTimeoutMinutes(value.timeout_minutes);

  if (timeoutMinutes === null) {
    return null;
  }

  return {
    timeout_minutes: timeoutMinutes,
    updated_at:
      typeof value.updated_at === "string" && value.updated_at.trim()
        ? value.updated_at
        : null,
  } satisfies SessionTimeoutSettingsRecord;
}

export async function readSessionTimeoutSettings() {
  try {
    const rawValue = await readFile(SESSION_TIMEOUT_SETTINGS_FILE_PATH, "utf8");
    const normalizedValue = normalizeSessionTimeoutSettingsRecord(JSON.parse(rawValue));

    return normalizedValue ?? getDefaultSessionTimeoutSettings();
  } catch (error) {
    const errorCode =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : null;

    if (errorCode === "ENOENT") {
      return getDefaultSessionTimeoutSettings();
    }

    throw error;
  }
}

export async function writeSessionTimeoutSettings(timeoutMinutes: number) {
  const normalizedMinutes = parseSessionTimeoutMinutes(timeoutMinutes);

  if (normalizedMinutes === null) {
    throw new Error("세션 타임아웃 설정값이 올바르지 않습니다.");
  }

  const nextValue = {
    timeout_minutes: normalizedMinutes,
    updated_at: new Date().toISOString(),
  } satisfies SessionTimeoutSettingsRecord;

  await mkdir(SESSION_TIMEOUT_SETTINGS_DIRECTORY, { recursive: true });
  await writeFile(
    SESSION_TIMEOUT_SETTINGS_FILE_PATH,
    JSON.stringify(nextValue, null, 2),
    "utf8"
  );

  return nextValue;
}