import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  applyMenuVisibilitySettingsPatch,
  getDefaultMenuVisibilitySettings,
  getMenuVisibilityItemKeys,
  isMenuVisibilityItemKey,
  MENU_VISIBILITY_KEYS,
  sanitizeMenuVisibilityCategorySettings,
  sanitizeMenuVisibilityItemSettings,
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
  const storedSettings = value.settings;
  const storedCategories = isRecord(storedSettings.categories)
    ? storedSettings.categories
    : null;
  const storedItemSettings = isRecord(storedSettings.items) ? storedSettings.items : null;
  const nextItemKeys = Array.from(
    new Set([
      ...getMenuVisibilityItemKeys(defaultSettings),
      ...(storedItemSettings ? Object.keys(storedItemSettings).filter(isMenuVisibilityItemKey) : []),
    ])
  );
  const nextCategories = MENU_VISIBILITY_KEYS.reduce<MenuVisibilitySettings["categories"]>(
    (categories, key) => {
      const storedCategoryValue =
        storedCategories && isRecord(storedCategories[key]) ? storedCategories[key] : null;
      const legacyVisibleValue = typeof storedSettings[key] === "boolean" ? storedSettings[key] : undefined;

      categories[key] = sanitizeMenuVisibilityCategorySettings(key, {
        ...defaultSettings.categories[key],
        ...(legacyVisibleValue === undefined ? {} : { visible: legacyVisibleValue }),
        ...(storedCategoryValue ?? {}),
      });
      return categories;
    },
    { ...defaultSettings.categories }
  );
  const nextItemSettings = nextItemKeys.reduce<MenuVisibilitySettings["items"]>(
    (items, key) => {
      const storedItemValue =
        storedItemSettings && isRecord(storedItemSettings[key])
          ? storedItemSettings[key]
          : null;
      const legacyItemVisibleValue =
        storedItemSettings && typeof storedItemSettings[key] === "boolean"
          ? storedItemSettings[key]
          : undefined;

      items[key] = sanitizeMenuVisibilityItemSettings(key, {
        ...defaultSettings.items[key],
        ...(legacyItemVisibleValue === undefined ? {} : { visible: legacyItemVisibleValue }),
        ...(storedItemValue ?? {}),
      });

      return items;
    },
    { ...defaultSettings.items }
  );
  const nextSettings: MenuVisibilitySettings = {
    categories: nextCategories,
    items: nextItemSettings,
  };

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