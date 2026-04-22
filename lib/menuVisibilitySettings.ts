import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  applyMenuVisibilitySettingsPatch,
  getDefaultMenuVisibilitySettings,
  MENU_VISIBILITY_ITEM_KEYS,
  MENU_VISIBILITY_KEYS,
} from "./menuVisibility";
import type {
  MenuVisibilitySettings,
  MenuVisibilitySettingsPatch,
  MenuVisibilitySettingsResponse,
} from "../types";

const MENU_VISIBILITY_SETTINGS_DIRECTORY = path.join(process.cwd(), "logs");
const MENU_VISIBILITY_SETTINGS_FILE_PATH = path.join(
  MENU_VISIBILITY_SETTINGS_DIRECTORY,
  "menu-visibility-settings.json"
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMenuVisibilitySettings(value: unknown): MenuVisibilitySettingsResponse | null {
  if (!isRecord(value) || !isRecord(value.settings)) {
    return null;
  }

  const defaultSettings = getDefaultMenuVisibilitySettings();
  const nextItemSettings = MENU_VISIBILITY_ITEM_KEYS.reduce<MenuVisibilitySettings["items"]>(
    (items, key) => {
      items[key] =
        isRecord(value.settings.items) && typeof value.settings.items[key] === "boolean"
          ? (value.settings.items[key] as boolean)
          : defaultSettings.items[key];

      return items;
    },
    { ...defaultSettings.items }
  );
  const nextSettings = MENU_VISIBILITY_KEYS.reduce<MenuVisibilitySettings>((settings, key) => {
    settings[key] =
      typeof value.settings[key] === "boolean"
        ? (value.settings[key] as boolean)
        : defaultSettings[key];
    return settings;
  }, { ...defaultSettings, items: nextItemSettings });

  return {
    settings: nextSettings,
    updated_at:
      typeof value.updated_at === "string" && value.updated_at.trim()
        ? value.updated_at
        : null,
  };
}

export async function readMenuVisibilitySettings(): Promise<MenuVisibilitySettingsResponse> {
  try {
    const rawValue = await readFile(MENU_VISIBILITY_SETTINGS_FILE_PATH, "utf8");
    const normalizedValue = normalizeMenuVisibilitySettings(JSON.parse(rawValue));

    return (
      normalizedValue ?? {
        settings: getDefaultMenuVisibilitySettings(),
        updated_at: null,
      }
    );
  } catch (error) {
    const errorCode =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : null;

    if (errorCode === "ENOENT") {
      return {
        settings: getDefaultMenuVisibilitySettings(),
        updated_at: null,
      };
    }

    throw error;
  }
}

export async function writeMenuVisibilitySettings(
  settings: MenuVisibilitySettingsPatch
): Promise<MenuVisibilitySettingsResponse> {
  const currentSettings = await readMenuVisibilitySettings();
  const nextValue: MenuVisibilitySettingsResponse = {
    settings: applyMenuVisibilitySettingsPatch(currentSettings.settings, settings),
    updated_at: new Date().toISOString(),
  };

  await mkdir(MENU_VISIBILITY_SETTINGS_DIRECTORY, { recursive: true });
  await writeFile(
    MENU_VISIBILITY_SETTINGS_FILE_PATH,
    JSON.stringify(nextValue, null, 2),
    "utf8"
  );

  return nextValue;
}

export function getMenuVisibilityKeys() {
  return [...MENU_VISIBILITY_KEYS];
}