import type { User } from "@supabase/supabase-js";
import { isLegacyAdminUser } from "./admin";
import { COMMUNITY_BOARD_DEFINITIONS } from "./communityBoards";
import {
  hasMinimumUserLevel,
  isUserLevel,
  USER_LEVEL_OPTIONS,
} from "./userLevel";
import type {
  MenuAccessLevel,
  MenuVisibilityCategorySettings,
  MenuVisibilityCategorySettingsMap,
  MenuVisibilityCategorySettingsPatch,
  MenuVisibilityItemKey,
  MenuVisibilityItemSettings,
  MenuVisibilityItemSettingsEntry,
  MenuVisibilityItemSettingsPatch,
  MenuVisibilityKey,
  MenuVisibilitySettings,
  MenuVisibilitySettingsPatch,
  MenuWriteAccessLevel,
} from "../types";

export type MenuVisibilityDefinitionItem = {
  key: MenuVisibilityItemKey;
  parentKey: MenuVisibilityKey;
  label: string;
  description: string;
  defaultOrder: number;
  minimumAccessLevel: MenuAccessLevel;
  defaultAccessLevel: MenuAccessLevel;
  supportsWriteAccess: boolean;
  minimumWriteAccessLevel: MenuWriteAccessLevel;
  defaultWriteAccessLevel: MenuWriteAccessLevel;
};

export type MenuVisibilityDefinition = {
  key: MenuVisibilityKey;
  label: string;
  description: string;
  defaultOrder: number;
  minimumAccessLevel: MenuAccessLevel;
  defaultAccessLevel: MenuAccessLevel;
  supportsWriteAccess: boolean;
  minimumWriteAccessLevel: MenuWriteAccessLevel;
  defaultWriteAccessLevel: MenuWriteAccessLevel;
  items?: readonly MenuVisibilityDefinitionItem[];
};

export const MENU_VISIBILITY_UPDATED_EVENT = "motobox:menu-visibility-updated";

export const MENU_ACCESS_LEVEL_OPTIONS = [
  "authenticated",
  ...USER_LEVEL_OPTIONS,
] as const satisfies readonly MenuAccessLevel[];

export const MENU_WRITE_ACCESS_LEVEL_OPTIONS = [
  "disabled",
  ...MENU_ACCESS_LEVEL_OPTIONS,
] as const satisfies readonly MenuWriteAccessLevel[];

const MENU_ACCESS_LEVEL_RANK: Record<MenuAccessLevel, number> = {
  authenticated: -1,
  기사Lv: 0,
  벤더Lv: 1,
  "Lv3-제휴": 2,
  관리자Lv: 3,
  운영자Lv: 4,
};

const MENU_WRITE_ACCESS_LEVEL_RANK: Record<MenuWriteAccessLevel, number> = {
  disabled: Number.MAX_SAFE_INTEGER,
  authenticated: -1,
  기사Lv: 0,
  벤더Lv: 1,
  "Lv3-제휴": 2,
  관리자Lv: 3,
  운영자Lv: 4,
};

const COMMUNITY_MENU_ITEMS: readonly MenuVisibilityDefinitionItem[] = COMMUNITY_BOARD_DEFINITIONS
  .filter((board) => board.sectionTitle === "커뮤니티")
  .map((board, index) => ({
    key: board.key,
    parentKey: "community",
    label: board.menuLabel,
    description: `${board.title} 메뉴를 표시합니다.`,
    defaultOrder: index,
    minimumAccessLevel: board.accessLevel,
    defaultAccessLevel: board.accessLevel,
    supportsWriteAccess: true,
    minimumWriteAccessLevel: board.accessLevel,
    defaultWriteAccessLevel: board.accessLevel,
  }));

const AFFILIATE_MENU_ITEMS: readonly MenuVisibilityDefinitionItem[] = COMMUNITY_BOARD_DEFINITIONS
  .filter((board) => board.sectionTitle === "제휴 전용")
  .map((board, index) => ({
    key: board.key,
    parentKey: "affiliate",
    label: board.menuLabel,
    description: `${board.title} 메뉴를 표시합니다.`,
    defaultOrder: index,
    minimumAccessLevel: "authenticated",
    defaultAccessLevel: "authenticated",
    supportsWriteAccess: true,
    minimumWriteAccessLevel: "authenticated",
    defaultWriteAccessLevel: "Lv3-제휴",
  }));

export const MENU_VISIBILITY_DEFINITIONS: readonly MenuVisibilityDefinition[] = [
  {
    key: "basic",
    label: "기본 메뉴",
    description: "홈과 마이페이지 카테고리를 표시합니다.",
    defaultOrder: 0,
    minimumAccessLevel: "authenticated",
    defaultAccessLevel: "authenticated",
    supportsWriteAccess: false,
    minimumWriteAccessLevel: "disabled",
    defaultWriteAccessLevel: "disabled",
    items: [
      {
        key: "dashboard",
        parentKey: "basic",
        label: "홈",
        description: "대시보드 홈 메뉴를 표시합니다.",
        defaultOrder: 0,
        minimumAccessLevel: "authenticated",
        defaultAccessLevel: "authenticated",
        supportsWriteAccess: false,
        minimumWriteAccessLevel: "disabled",
        defaultWriteAccessLevel: "disabled",
      },
      {
        key: "my-page",
        parentKey: "basic",
        label: "마이페이지",
        description: "설정 페이지 진입 메뉴를 표시합니다.",
        defaultOrder: 1,
        minimumAccessLevel: "authenticated",
        defaultAccessLevel: "authenticated",
        supportsWriteAccess: false,
        minimumWriteAccessLevel: "disabled",
        defaultWriteAccessLevel: "disabled",
      },
    ],
  },
  {
    key: "admin",
    label: "관리자 메뉴",
    description: "관리자 페이지 진입 메뉴를 표시합니다.",
    defaultOrder: 1,
    minimumAccessLevel: "관리자Lv",
    defaultAccessLevel: "관리자Lv",
    supportsWriteAccess: false,
    minimumWriteAccessLevel: "disabled",
    defaultWriteAccessLevel: "disabled",
    items: [
      {
        key: "admin",
        parentKey: "admin",
        label: "관리자",
        description: "관리자 페이지 진입 메뉴를 표시합니다.",
        defaultOrder: 0,
        minimumAccessLevel: "관리자Lv",
        defaultAccessLevel: "관리자Lv",
        supportsWriteAccess: false,
        minimumWriteAccessLevel: "disabled",
        defaultWriteAccessLevel: "disabled",
      },
    ],
  },
  {
    key: "dashboard",
    label: "대시보드 카테고리",
    description: "업무 작성, 통계, 캘린더 메뉴 묶음을 표시합니다.",
    defaultOrder: 2,
    minimumAccessLevel: "authenticated",
    defaultAccessLevel: "authenticated",
    supportsWriteAccess: false,
    minimumWriteAccessLevel: "disabled",
    defaultWriteAccessLevel: "disabled",
    items: [
      {
        key: "today-quick-card",
        parentKey: "dashboard",
        label: "업무 작성",
        description: "오늘 업무 작성 메뉴를 표시합니다.",
        defaultOrder: 0,
        minimumAccessLevel: "authenticated",
        defaultAccessLevel: "authenticated",
        supportsWriteAccess: false,
        minimumWriteAccessLevel: "disabled",
        defaultWriteAccessLevel: "disabled",
      },
      {
        key: "work-summary",
        parentKey: "dashboard",
        label: "근무 통계",
        description: "근무 통계 메뉴를 표시합니다.",
        defaultOrder: 1,
        minimumAccessLevel: "authenticated",
        defaultAccessLevel: "authenticated",
        supportsWriteAccess: false,
        minimumWriteAccessLevel: "disabled",
        defaultWriteAccessLevel: "disabled",
      },
      {
        key: "stats",
        parentKey: "dashboard",
        label: "매출 통계",
        description: "매출 통계 메뉴를 표시합니다.",
        defaultOrder: 2,
        minimumAccessLevel: "authenticated",
        defaultAccessLevel: "authenticated",
        supportsWriteAccess: false,
        minimumWriteAccessLevel: "disabled",
        defaultWriteAccessLevel: "disabled",
      },
      {
        key: "daily-sales-list",
        parentKey: "dashboard",
        label: "일별 매출 리스트 형",
        description: "일별 매출 리스트 메뉴를 표시합니다.",
        defaultOrder: 3,
        minimumAccessLevel: "authenticated",
        defaultAccessLevel: "authenticated",
        supportsWriteAccess: false,
        minimumWriteAccessLevel: "disabled",
        defaultWriteAccessLevel: "disabled",
      },
      {
        key: "work-calendar",
        parentKey: "dashboard",
        label: "일별 매출 캘린더 형",
        description: "일별 매출 캘린더 메뉴를 표시합니다.",
        defaultOrder: 4,
        minimumAccessLevel: "authenticated",
        defaultAccessLevel: "authenticated",
        supportsWriteAccess: false,
        minimumWriteAccessLevel: "disabled",
        defaultWriteAccessLevel: "disabled",
      },
    ],
  },
  {
    key: "community",
    label: "커뮤니티 카테고리",
    description: "커뮤니티 메뉴 묶음을 표시합니다.",
    defaultOrder: 3,
    minimumAccessLevel: "authenticated",
    defaultAccessLevel: "authenticated",
    supportsWriteAccess: true,
    minimumWriteAccessLevel: "authenticated",
    defaultWriteAccessLevel: "authenticated",
    items: COMMUNITY_MENU_ITEMS,
  },
  {
    key: "affiliate",
    label: "제휴 전용 카테고리",
    description: "제휴 관련 메뉴 카테고리를 표시합니다.",
    defaultOrder: 4,
    minimumAccessLevel: "authenticated",
    defaultAccessLevel: "authenticated",
    supportsWriteAccess: true,
    minimumWriteAccessLevel: "authenticated",
    defaultWriteAccessLevel: "Lv3-제휴",
    items: AFFILIATE_MENU_ITEMS,
  },
  {
    key: "vendor",
    label: "밴더 전용 카테고리",
    description: "밴더 관련 메뉴 카테고리를 표시합니다.",
    defaultOrder: 5,
    minimumAccessLevel: "authenticated",
    defaultAccessLevel: "authenticated",
    supportsWriteAccess: false,
    minimumWriteAccessLevel: "disabled",
    defaultWriteAccessLevel: "disabled",
    items: [
      {
        key: "vendor-home",
        parentKey: "vendor",
        label: "밴더 전용 페이지",
        description: "밴더 페이지 메뉴를 표시합니다.",
        defaultOrder: 0,
        minimumAccessLevel: "authenticated",
        defaultAccessLevel: "authenticated",
        supportsWriteAccess: false,
        minimumWriteAccessLevel: "disabled",
        defaultWriteAccessLevel: "disabled",
      },
    ],
  },
] as const;

export const MENU_VISIBILITY_KEYS: MenuVisibilityKey[] = MENU_VISIBILITY_DEFINITIONS.map(
  (definition) => definition.key
);

export const MENU_VISIBILITY_ITEM_DEFINITIONS = MENU_VISIBILITY_DEFINITIONS.flatMap(
  (definition) => definition.items ?? []
);

export const MENU_VISIBILITY_ITEM_KEYS: MenuVisibilityItemKey[] = MENU_VISIBILITY_ITEM_DEFINITIONS.map(
  (definition) => definition.key
);

export function getMenuVisibilityDefinition(key: MenuVisibilityKey) {
  return MENU_VISIBILITY_DEFINITIONS.find((definition) => definition.key === key) ?? null;
}

export function getMenuVisibilityItemDefinition(key: MenuVisibilityItemKey) {
  return MENU_VISIBILITY_ITEM_DEFINITIONS.find((definition) => definition.key === key) ?? null;
}

export function getMenuVisibilityItemParentKey(key: MenuVisibilityItemKey): MenuVisibilityKey | null {
  return getMenuVisibilityItemDefinition(key)?.parentKey ?? null;
}

export function isMenuVisibilityKey(value: unknown): value is MenuVisibilityKey {
  return typeof value === "string" && MENU_VISIBILITY_KEYS.includes(value as MenuVisibilityKey);
}

export function isMenuVisibilityItemKey(value: unknown): value is MenuVisibilityItemKey {
  return (
    typeof value === "string" &&
    MENU_VISIBILITY_ITEM_KEYS.includes(value as MenuVisibilityItemKey)
  );
}

export function isMenuAccessLevel(value: unknown): value is MenuAccessLevel {
  return value === "authenticated" || isUserLevel(value);
}

export function isMenuWriteAccessLevel(value: unknown): value is MenuWriteAccessLevel {
  return value === "disabled" || isMenuAccessLevel(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMenuLabel(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue.slice(0, 40) : fallback;
}

function normalizeMenuOrder(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(999, Math.round(value)));
}

function getMoreRestrictiveMenuAccessLevel(
  currentLevel: MenuAccessLevel,
  minimumLevel: MenuAccessLevel
) {
  return MENU_ACCESS_LEVEL_RANK[currentLevel] < MENU_ACCESS_LEVEL_RANK[minimumLevel]
    ? minimumLevel
    : currentLevel;
}

function getMoreRestrictiveMenuWriteAccessLevel(
  currentLevel: MenuWriteAccessLevel,
  minimumLevel: MenuWriteAccessLevel
) {
  return MENU_WRITE_ACCESS_LEVEL_RANK[currentLevel] < MENU_WRITE_ACCESS_LEVEL_RANK[minimumLevel]
    ? minimumLevel
    : currentLevel;
}

function createDefaultCategorySetting(
  definition: MenuVisibilityDefinition
): MenuVisibilityCategorySettings {
  return {
    visible: true,
    enabled: true,
    label: definition.label,
    order: definition.defaultOrder,
    access_level: definition.defaultAccessLevel,
    write_access_level: definition.defaultWriteAccessLevel,
  };
}

function createDefaultItemSetting(
  definition: MenuVisibilityDefinitionItem
): MenuVisibilityItemSettingsEntry {
  return {
    visible: true,
    enabled: true,
    label: definition.label,
    order: definition.defaultOrder,
    access_level: definition.defaultAccessLevel,
    write_access_level: definition.defaultWriteAccessLevel,
  };
}

export function sanitizeMenuVisibilityCategorySettings(
  key: MenuVisibilityKey,
  value: Partial<MenuVisibilityCategorySettings> | null | undefined
): MenuVisibilityCategorySettings {
  const definition = getMenuVisibilityDefinition(key);

  if (!definition) {
    throw new Error(`Unknown menu category key: ${key}`);
  }

  const defaultValue = createDefaultCategorySetting(definition);
  const nextValue = value ?? {};
  const accessLevel = isMenuAccessLevel(nextValue.access_level)
    ? nextValue.access_level
    : defaultValue.access_level;
  const writeAccessLevel = isMenuWriteAccessLevel(nextValue.write_access_level)
    ? nextValue.write_access_level
    : defaultValue.write_access_level;

  return {
    visible: typeof nextValue.visible === "boolean" ? nextValue.visible : defaultValue.visible,
    enabled: typeof nextValue.enabled === "boolean" ? nextValue.enabled : defaultValue.enabled,
    label: normalizeMenuLabel(nextValue.label, defaultValue.label),
    order: normalizeMenuOrder(nextValue.order, defaultValue.order),
    access_level: getMoreRestrictiveMenuAccessLevel(accessLevel, definition.minimumAccessLevel),
    write_access_level: definition.supportsWriteAccess
      ? getMoreRestrictiveMenuWriteAccessLevel(
          writeAccessLevel,
          definition.minimumWriteAccessLevel
        )
      : "disabled",
  };
}

export function sanitizeMenuVisibilityItemSettings(
  key: MenuVisibilityItemKey,
  value: Partial<MenuVisibilityItemSettingsEntry> | null | undefined
): MenuVisibilityItemSettingsEntry {
  const definition = getMenuVisibilityItemDefinition(key);

  if (!definition) {
    throw new Error(`Unknown menu item key: ${key}`);
  }

  const defaultValue = createDefaultItemSetting(definition);
  const nextValue = value ?? {};
  const accessLevel = isMenuAccessLevel(nextValue.access_level)
    ? nextValue.access_level
    : defaultValue.access_level;
  const writeAccessLevel = isMenuWriteAccessLevel(nextValue.write_access_level)
    ? nextValue.write_access_level
    : defaultValue.write_access_level;

  return {
    visible: typeof nextValue.visible === "boolean" ? nextValue.visible : defaultValue.visible,
    enabled: typeof nextValue.enabled === "boolean" ? nextValue.enabled : defaultValue.enabled,
    label: normalizeMenuLabel(nextValue.label, defaultValue.label),
    order: normalizeMenuOrder(nextValue.order, defaultValue.order),
    access_level: getMoreRestrictiveMenuAccessLevel(accessLevel, definition.minimumAccessLevel),
    write_access_level: definition.supportsWriteAccess
      ? getMoreRestrictiveMenuWriteAccessLevel(
          writeAccessLevel,
          definition.minimumWriteAccessLevel
        )
      : "disabled",
  };
}

export function getDefaultMenuVisibilityCategorySettings(): MenuVisibilityCategorySettingsMap {
  return MENU_VISIBILITY_DEFINITIONS.reduce<MenuVisibilityCategorySettingsMap>((settings, definition) => {
    settings[definition.key] = createDefaultCategorySetting(definition);
    return settings;
  }, {} as MenuVisibilityCategorySettingsMap);
}

export function getDefaultMenuVisibilityItemSettings(): MenuVisibilityItemSettings {
  return MENU_VISIBILITY_ITEM_DEFINITIONS.reduce<MenuVisibilityItemSettings>((settings, definition) => {
    settings[definition.key] = createDefaultItemSetting(definition);
    return settings;
  }, {} as MenuVisibilityItemSettings);
}

export function getDefaultMenuVisibilitySettings(): MenuVisibilitySettings {
  return {
    categories: getDefaultMenuVisibilityCategorySettings(),
    items: getDefaultMenuVisibilityItemSettings(),
  };
}

function normalizeMenuCategorySettingsPatch(
  value: unknown
): Partial<MenuVisibilityCategorySettingsMap> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Partial<MenuVisibilityCategorySettingsMap>>(
    (categories, [key, entryValue]) => {
      if (isMenuVisibilityKey(key) && isRecord(entryValue)) {
        categories[key] = sanitizeMenuVisibilityCategorySettings(
          key,
          entryValue as MenuVisibilityCategorySettingsPatch
        );
      }

      return categories;
    },
    {}
  );
}

function normalizeMenuItemSettingsPatch(value: unknown): Partial<MenuVisibilityItemSettings> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Partial<MenuVisibilityItemSettings>>(
    (items, [key, entryValue]) => {
      if (isMenuVisibilityItemKey(key) && isRecord(entryValue)) {
        items[key] = sanitizeMenuVisibilityItemSettings(
          key,
          entryValue as MenuVisibilityItemSettingsPatch
        );
      }

      return items;
    },
    {}
  );
}

export function applyMenuVisibilitySettingsPatch(
  currentSettings: MenuVisibilitySettings,
  patch: MenuVisibilitySettingsPatch
): MenuVisibilitySettings {
  const defaultSettings = getDefaultMenuVisibilitySettings();
  const currentCategories = currentSettings.categories ?? defaultSettings.categories;
  const currentItems = currentSettings.items ?? defaultSettings.items;
  const nextCategoryPatch = patch.categories
    ? normalizeMenuCategorySettingsPatch(patch.categories)
    : {};
  const nextItemPatch = patch.items ? normalizeMenuItemSettingsPatch(patch.items) : {};

  return {
    categories: MENU_VISIBILITY_KEYS.reduce<MenuVisibilityCategorySettingsMap>((categories, key) => {
      categories[key] = sanitizeMenuVisibilityCategorySettings(key, {
        ...currentCategories[key],
        ...nextCategoryPatch[key],
      });
      return categories;
    }, {} as MenuVisibilityCategorySettingsMap),
    items: MENU_VISIBILITY_ITEM_KEYS.reduce<MenuVisibilityItemSettings>((items, key) => {
      items[key] = sanitizeMenuVisibilityItemSettings(key, {
        ...currentItems[key],
        ...nextItemPatch[key],
      });
      return items;
    }, {} as MenuVisibilityItemSettings),
  };
}

export function normalizeMenuVisibilityPatch(value: unknown): MenuVisibilitySettingsPatch {
  if (!isRecord(value)) {
    return {};
  }

  const settings: MenuVisibilitySettingsPatch = {};

  if (isRecord(value.categories)) {
    const categories = normalizeMenuCategorySettingsPatch(value.categories);

    if (Object.keys(categories).length > 0) {
      settings.categories = categories;
    }
  }

  if (isRecord(value.items)) {
    const items = normalizeMenuItemSettingsPatch(value.items);

    if (Object.keys(items).length > 0) {
      settings.items = items;
    }
  }

  if (Object.keys(settings).length > 0) {
    return settings;
  }

  return Object.entries(value).reduce<MenuVisibilitySettingsPatch>((nextSettings, [key, entryValue]) => {
    if (isMenuVisibilityKey(key) && typeof entryValue === "boolean") {
      nextSettings.categories ??= {};
      nextSettings.categories[key] = { visible: entryValue };
      return nextSettings;
    }

    if (key === "items" && isRecord(entryValue)) {
      nextSettings.items = Object.entries(entryValue).reduce<Partial<MenuVisibilityItemSettings>>(
        (items, [itemKey, itemValue]) => {
          if (isMenuVisibilityItemKey(itemKey) && typeof itemValue === "boolean") {
            items[itemKey] = sanitizeMenuVisibilityItemSettings(itemKey, { visible: itemValue });
          }

          return items;
        },
        {}
      );
    }

    return nextSettings;
  }, {});
}

export function getMenuAccessLevelLabel(level: MenuAccessLevel) {
  return level === "authenticated" ? "로그인 계정" : `${level} 이상`;
}

export function getMenuWriteAccessLevelLabel(level: MenuWriteAccessLevel) {
  if (level === "disabled") {
    return "작성 불가";
  }

  return getMenuAccessLevelLabel(level);
}

export function canUserAccessMenuLevel(
  user?: Pick<User, "app_metadata" | "user_metadata"> | null,
  level: MenuAccessLevel = "authenticated"
) {
  if (!user) {
    return false;
  }

  if (level === "authenticated") {
    return true;
  }

  return isLegacyAdminUser(user) || hasMinimumUserLevel(user, level);
}

export function canUserAccessMenuWriteLevel(
  user?: Pick<User, "app_metadata" | "user_metadata"> | null,
  level: MenuWriteAccessLevel = "disabled"
) {
  if (level === "disabled") {
    return false;
  }

  return canUserAccessMenuLevel(user, level);
}

function canAdminPreviewHiddenMenu(
  user?: Pick<User, "app_metadata" | "user_metadata"> | null
) {
  if (!user) {
    return false;
  }

  return isLegacyAdminUser(user) || hasMinimumUserLevel(user, "관리자Lv");
}

export function canUserAccessMenuCategory(
  settings: MenuVisibilitySettings,
  key: MenuVisibilityKey,
  user?: Pick<User, "app_metadata" | "user_metadata"> | null
) {
  const categorySettings = settings.categories[key];
  const canPreviewHidden = canAdminPreviewHiddenMenu(user);

  if (
    !categorySettings ||
    !categorySettings.enabled ||
    (!categorySettings.visible && !canPreviewHidden)
  ) {
    return false;
  }

  return canUserAccessMenuLevel(user, categorySettings.access_level);
}

export function canUserAccessMenuItem(
  settings: MenuVisibilitySettings,
  key: MenuVisibilityItemKey,
  user?: Pick<User, "app_metadata" | "user_metadata"> | null
) {
  const parentKey = getMenuVisibilityItemParentKey(key);
  const canPreviewHidden = canAdminPreviewHiddenMenu(user);

  if (!parentKey || !canUserAccessMenuCategory(settings, parentKey, user)) {
    return false;
  }

  const itemSettings = settings.items[key];

  if (!itemSettings || !itemSettings.enabled || (!itemSettings.visible && !canPreviewHidden)) {
    return false;
  }

  return canUserAccessMenuLevel(user, itemSettings.access_level);
}

export function canUserWriteMenuItem(
  settings: MenuVisibilitySettings,
  key: MenuVisibilityItemKey,
  user?: Pick<User, "app_metadata" | "user_metadata"> | null
) {
  const itemDefinition = getMenuVisibilityItemDefinition(key);
  const parentKey = itemDefinition?.parentKey ?? null;

  if (!itemDefinition || !parentKey || !itemDefinition.supportsWriteAccess) {
    return false;
  }

  if (!canUserAccessMenuItem(settings, key, user)) {
    return false;
  }

  const categorySettings = settings.categories[parentKey];
  const itemSettings = settings.items[key];

  return (
    canUserAccessMenuWriteLevel(user, categorySettings.write_access_level) &&
    canUserAccessMenuWriteLevel(user, itemSettings.write_access_level)
  );
}

export function hasWritableMenuChildren(key: MenuVisibilityKey) {
  return MENU_VISIBILITY_ITEM_DEFINITIONS.some(
    (item) => item.parentKey === key && item.supportsWriteAccess
  );
}