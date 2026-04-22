import {
  COMMUNITY_BOARD_DEFINITIONS,
} from "./communityBoards";
import type {
  MenuVisibilityItemKey,
  MenuVisibilityItemSettings,
  MenuVisibilityKey,
  MenuVisibilitySettings,
  MenuVisibilitySettingsPatch,
} from "../types";

type MenuVisibilityDefinitionItem = {
  key: MenuVisibilityItemKey;
  label: string;
  description: string;
};

type MenuVisibilityDefinition = {
  key: MenuVisibilityKey;
  label: string;
  description: string;
  items?: readonly MenuVisibilityDefinitionItem[];
};

export const MENU_VISIBILITY_UPDATED_EVENT = "motobox:menu-visibility-updated";

export const MENU_VISIBILITY_KEYS: MenuVisibilityKey[] = [
  "basic",
  "admin",
  "dashboard",
  "community",
  "affiliate",
  "vendor",
];

export const MENU_VISIBILITY_ITEM_KEYS: MenuVisibilityItemKey[] = [
  "dashboard",
  "my-page",
  "today-quick-card",
  "work-summary",
  "stats",
  "daily-sales-list",
  "work-calendar",
  "jobs",
  "free-talk",
  "notice",
  "tips",
  "affiliate",
  "vendor-home",
];

const COMMUNITY_MENU_ITEMS: readonly MenuVisibilityDefinitionItem[] = COMMUNITY_BOARD_DEFINITIONS
  .filter((board) => board.sectionTitle === "커뮤니티")
  .map((board) => ({
    key: board.key,
    label: board.menuLabel,
    description: `${board.title} 메뉴를 표시합니다.`,
  }));

const AFFILIATE_MENU_ITEMS: readonly MenuVisibilityDefinitionItem[] = COMMUNITY_BOARD_DEFINITIONS
  .filter((board) => board.sectionTitle === "제휴 전용")
  .map((board) => ({
    key: board.key,
    label: board.menuLabel,
    description: `${board.title} 메뉴를 표시합니다.`,
  }));

export const MENU_VISIBILITY_DEFINITIONS: readonly MenuVisibilityDefinition[] = [
  {
    key: "basic",
    label: "기본 메뉴",
    description: "홈과 마이페이지 카테고리를 표시합니다.",
    items: [
      {
        key: "dashboard",
        label: "홈",
        description: "대시보드 홈 메뉴를 표시합니다.",
      },
      {
        key: "my-page",
        label: "마이페이지",
        description: "설정 페이지 진입 메뉴를 표시합니다.",
      },
    ],
  },
  {
    key: "admin",
    label: "관리자 메뉴",
    description: "관리자 페이지 진입 메뉴를 표시합니다.",
  },
  {
    key: "dashboard",
    label: "대시보드 카테고리",
    description: "업무 작성, 통계, 캘린더 메뉴 묶음을 표시합니다.",
    items: [
      {
        key: "today-quick-card",
        label: "업무 작성",
        description: "오늘 업무 작성 메뉴를 표시합니다.",
      },
      {
        key: "work-summary",
        label: "근무 통계",
        description: "근무 통계 메뉴를 표시합니다.",
      },
      {
        key: "stats",
        label: "매출 통계",
        description: "매출 통계 메뉴를 표시합니다.",
      },
      {
        key: "daily-sales-list",
        label: "일별 매출 리스트 형",
        description: "일별 매출 리스트 메뉴를 표시합니다.",
      },
      {
        key: "work-calendar",
        label: "일별 매출 캘린더 형",
        description: "일별 매출 캘린더 메뉴를 표시합니다.",
      },
    ],
  },
  {
    key: "community",
    label: "커뮤니티 카테고리",
    description: "커뮤니티 메뉴 묶음을 표시합니다.",
    items: COMMUNITY_MENU_ITEMS,
  },
  {
    key: "affiliate",
    label: "제휴 전용 카테고리",
    description: "제휴 사용자 전용 메뉴 카테고리를 표시합니다.",
    items: AFFILIATE_MENU_ITEMS,
  },
  {
    key: "vendor",
    label: "밴더 전용 카테고리",
    description: "밴더 사용자 전용 메뉴 카테고리를 표시합니다.",
    items: [
      {
        key: "vendor-home",
        label: "밴더 전용 페이지",
        description: "밴더 전용 페이지 메뉴를 표시합니다.",
      },
    ],
  },
] as const;

export const MENU_VISIBILITY_ITEM_DEFINITIONS = MENU_VISIBILITY_DEFINITIONS.flatMap(
  (definition) => definition.items ?? []
);

export function getDefaultMenuVisibilityItemSettings(): MenuVisibilityItemSettings {
  return {
    dashboard: true,
    "my-page": true,
    "today-quick-card": true,
    "work-summary": true,
    stats: true,
    "daily-sales-list": true,
    "work-calendar": true,
    jobs: true,
    "free-talk": true,
    notice: true,
    tips: true,
    affiliate: true,
    "vendor-home": true,
  };
}

export function getDefaultMenuVisibilitySettings(): MenuVisibilitySettings {
  return {
    basic: true,
    admin: true,
    dashboard: true,
    community: true,
    affiliate: true,
    vendor: true,
    items: getDefaultMenuVisibilityItemSettings(),
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeMenuVisibilityItemPatch(
  value: unknown
): Partial<MenuVisibilityItemSettings> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Partial<MenuVisibilityItemSettings>>(
    (items, [key, entryValue]) => {
      if (isMenuVisibilityItemKey(key) && typeof entryValue === "boolean") {
        items[key] = entryValue;
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
  const { items, ...categoryPatch } = patch;
  const nextItemPatch = items ? normalizeMenuVisibilityItemPatch(items) : {};
  const currentItemSettings = currentSettings.items ?? getDefaultMenuVisibilityItemSettings();

  return {
    ...currentSettings,
    ...categoryPatch,
    items: {
      ...currentItemSettings,
      ...nextItemPatch,
    },
  };
}

export function normalizeMenuVisibilityPatch(value: unknown): MenuVisibilitySettingsPatch {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<MenuVisibilitySettingsPatch>((settings, [key, entryValue]) => {
    if (key === "items") {
      const itemPatch = normalizeMenuVisibilityItemPatch(entryValue);

      if (Object.keys(itemPatch).length > 0) {
        settings.items = itemPatch;
      }

      return settings;
    }

    if (isMenuVisibilityKey(key) && typeof entryValue === "boolean") {
      settings[key] = entryValue;
    }

    return settings;
  }, {});
}