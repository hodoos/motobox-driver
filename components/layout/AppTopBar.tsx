"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAdminUser } from "../../lib/admin";
import {
  COMMUNITY_BOARD_DEFINITIONS,
} from "../../lib/communityBoards";
import {
  DASHBOARD_SECTION_EVENT,
  DASHBOARD_SECTION_STORAGE_KEY,
  DashboardSectionId,
} from "../../lib/dashboardNavigation";
import {
  canUserAccessMenuCategory,
  canUserAccessMenuItem,
  getDefaultMenuVisibilitySettings,
  getMenuVisibilityItemHref,
  getMenuVisibilityItemsForCategory,
  isCustomMenuVisibilityItemKey,
  MENU_VISIBILITY_DEFINITIONS,
  MENU_VISIBILITY_UPDATED_EVENT,
} from "../../lib/menuVisibility";
import { KAKAO_INQUIRY_URL } from "../../lib/support";
import { supabase } from "../../lib/supabase";
import {
  createToastState,
  getKoreanErrorMessage,
  queuePendingToast,
  ToastState,
} from "../../lib/toast";
import { triggerLandingRipple } from "../../lib/landingRipple";
import type {
  IntrinsicMenuVisibilityItemKey,
  MenuVisibilityItemKey,
  MenuVisibilitySettings,
  MenuVisibilitySettingsResponse,
} from "../../types";
import ToastViewport from "../ui/ToastViewport";

type MenuItem = {
  id: string;
  label: string;
  href?: string;
  dashboardSectionId?: DashboardSectionId;
  isPlaceholder?: boolean;
  visibilityKey?: MenuVisibilityItemKey;
};

type MenuSection = {
  id: string;
  title: string;
  items: MenuItem[];
};

type ThemeMode = "dark" | "light";

const THEME_STORAGE_KEY = "motobox:theme";
let lastKnownMenuOpen = false;

const MENU_ITEM_DASHBOARD_SECTION_MAP: Partial<
  Record<IntrinsicMenuVisibilityItemKey, DashboardSectionId>
> = {
  dashboard: "home",
  "today-quick-card": "today-quick-card",
  "work-summary": "work-summary",
  stats: "stats",
  "daily-sales-list": "daily-sales-list",
  "work-calendar": "work-calendar",
};

function persistMenuOpen(nextOpen: boolean) {
  lastKnownMenuOpen = nextOpen;
}

function isExternalMenuHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function getMenuItemHref(key: MenuVisibilityItemKey, menuVisibility: MenuVisibilitySettings) {
  return getMenuVisibilityItemHref(key, menuVisibility) ?? undefined;
}

function getMenuItemDashboardSectionId(key: MenuVisibilityItemKey) {
  if (isCustomMenuVisibilityItemKey(key)) {
    return undefined;
  }

  return MENU_ITEM_DASHBOARD_SECTION_MAP[key];
}

function canUseIntrinsicMenuItem(user: User | null, key: MenuVisibilityItemKey) {
  if (!user) {
    return false;
  }

  if (isCustomMenuVisibilityItemKey(key)) {
    return true;
  }

  if (key === "admin") {
    return isAdminUser(user);
  }

  return true;
}

function isPlaceholderMenuItem(key: MenuVisibilityItemKey) {
  const board = COMMUNITY_BOARD_DEFINITIONS.find((item) => item.key === key);
  return Boolean(board && board.title.includes("구현중"));
}

function getMenuItemKeyByPath(pathname: string): MenuVisibilityItemKey | null {
  if (pathname === "/dashboard") {
    return "dashboard";
  }

  if (pathname === "/settings") {
    return "my-page";
  }

  if (pathname === "/admin") {
    return "admin";
  }

  if (pathname === "/vendor") {
    return "vendor-home";
  }

  return COMMUNITY_BOARD_DEFINITIONS.find((board) => board.path === pathname)?.key ?? null;
}

function getFallbackMenuHref(user: User | null, menuVisibility: MenuVisibilitySettings) {
  if (!user) {
    return "/";
  }

  const sortedDefinitions = [...MENU_VISIBILITY_DEFINITIONS].sort(
    (left, right) =>
      menuVisibility.categories[left.key].order - menuVisibility.categories[right.key].order
  );

  for (const definition of sortedDefinitions) {
    if (!canUserAccessMenuCategory(menuVisibility, definition.key, user)) {
      continue;
    }

    const sortedItems = getMenuVisibilityItemsForCategory(menuVisibility, definition.key).sort(
      (left, right) => menuVisibility.items[left.key].order - menuVisibility.items[right.key].order
    );

    for (const item of sortedItems) {
      if (
        !canUseIntrinsicMenuItem(user, item.key) ||
        !canUserAccessMenuItem(menuVisibility, item.key, user)
      ) {
        continue;
      }

      const href = getMenuItemHref(item.key, menuVisibility);

      if (href && !isExternalMenuHref(href)) {
        return href;
      }

      if (getMenuItemDashboardSectionId(item.key)) {
        return "/dashboard";
      }
    }
  }

  return "/";
}

function LogoWordmark({
  mode,
  className,
}: {
  mode: ThemeMode;
  className?: string;
}) {
  const wordmarkX = 116;
  const palette =
    mode === "light"
      ? {
          mainTop: "#342717",
          mainBottom: "#1F170D",
          accentTop: "#E68A14",
          accentBottom: "#CB6406",
          depthTop: "#E7D6BE",
          depthBottom: "#C8AF89",
          baseFace: "#8A6C48",
          backStroke: "#F8F1E4",
          frontStroke: "#FFF9F1",
          shadowColor: "#8D6737",
          shadowOpacity: 0.18,
        }
      : {
          mainTop: "#FFFFFF",
          mainBottom: "#F6F8FB",
          accentTop: "#FF9500",
          accentBottom: "#FF7800",
          depthTop: "#7088A2",
          depthBottom: "#223245",
          baseFace: "#4A6784",
          backStroke: "#08131E",
          frontStroke: "#07131F",
          shadowColor: "#09121C",
          shadowOpacity: 0.24,
        };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 620 202"
      className={className ?? "block h-auto w-[172px]"}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="logo-wordmark-main-face"
          x1="0"
          y1="36"
          x2="0"
          y2="160"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={palette.mainTop} />
          <stop offset="1" stopColor={palette.mainBottom} />
        </linearGradient>
        <linearGradient
          id="logo-wordmark-accent-face"
          x1="0"
          y1="36"
          x2="0"
          y2="160"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={palette.accentTop} />
          <stop offset="1" stopColor={palette.accentBottom} />
        </linearGradient>
        <linearGradient
          id="logo-wordmark-depth-face"
          x1="0"
          y1="86"
          x2="0"
          y2="186"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={palette.depthTop} />
          <stop offset="1" stopColor={palette.depthBottom} />
        </linearGradient>
        <filter
          id="logo-wordmark-shadow"
          x="0"
          y="0"
          width="620"
          height="202"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="4"
            floodColor={palette.shadowColor}
            floodOpacity={palette.shadowOpacity}
          />
        </filter>
      </defs>

      <g
        filter="url(#logo-wordmark-shadow)"
        fontFamily="Arial Black, Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, sans-serif"
        fontSize="136"
        fontWeight="900"
        letterSpacing="-10"
        strokeLinejoin="round"
        paintOrder="stroke fill"
      >
        <g transform="translate(26 22) skewX(-9)">
          <text
            x={wordmarkX}
            y="138"
            fill="url(#logo-wordmark-depth-face)"
            stroke={palette.backStroke}
            strokeWidth="24"
          >
            택배판
          </text>
        </g>

        <g transform="translate(16 12) skewX(-9)">
          <text
            x={wordmarkX}
            y="138"
            fill={palette.baseFace}
            stroke={palette.backStroke}
            strokeWidth="24"
          >
            택배판
          </text>
        </g>

        <g transform="skewX(-9)">
          <text
            x={wordmarkX}
            y="138"
            fill="url(#logo-wordmark-main-face)"
            stroke={palette.frontStroke}
            strokeWidth="22"
          >
            택배<tspan fill="url(#logo-wordmark-accent-face)">판</tspan>
          </text>
        </g>
      </g>
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 7H20M4 12H20M4 17H20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M14 5H18C19.1046 5 20 5.89543 20 7V17C20 18.1046 19.1046 19 18 19H14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10 8L6 12L10 16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 12H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 5H6C4.89543 5 4 5.89543 4 7V17C4 18.1046 4.89543 19 6 19H10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M14 8L18 12L14 16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 12H18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LoadingIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20 12C20 16.4183 16.4183 20 12 20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4 12C4 7.58172 7.58172 4 12 4C14.2783 4 16.3341 4.95359 17.791 6.48439"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuEntryLoadingCard() {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div aria-hidden="true" className="absolute inset-0 bg-[rgba(4,4,6,0.48)] backdrop-blur-[3px]" />
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="retro-panel retro-loading-panel pointer-events-none relative w-full max-w-72 rounded-3xl px-4 py-4 text-center sm:max-w-80 sm:px-5 sm:py-5"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-(--border-strong)/70 bg-[rgba(255,255,255,0.06)] text-(--text-strong)">
            <LoadingIcon />
          </div>
          <p className="retro-title theme-heading text-base leading-snug sm:text-lg">
            메뉴 진입 중..
          </p>
        </div>
      </div>
    </div>
  );
}

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.75V5.1M12 18.9V21.25M21.25 12H18.9M5.1 12H2.75M18.54 5.46L16.88 7.12M7.12 16.88L5.46 18.54M18.54 18.54L16.88 16.88M7.12 7.12L5.46 5.46"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M19 15.25C17.94 15.74 16.76 16 15.5 16C10.81 16 7 12.19 7 7.5C7 6.24 7.26 5.06 7.75 4C4.93 5.3 3 8.15 3 11.45C3 15.97 6.66 19.63 11.18 19.63C14.48 19.63 17.33 17.7 18.63 14.88C18.76 15 18.88 15.12 19 15.25Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MyPageIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M6.5 19.25C7.16 16.77 9.4 15 12 15C14.6 15 16.84 16.77 17.5 19.25"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4.75 4.75H19.25V19.25H4.75V4.75Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
}

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (storedTheme === "light") {
    return "light";
  }

  if (storedTheme === "dark") {
    return "dark";
  }

  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function createMenuSections(
  user: User | null,
  menuVisibility: MenuVisibilitySettings
): MenuSection[] {
  if (!user) {
    return [
      {
        id: "basic",
        title: "기본",
        items: [{ id: "home", href: "/", label: "초기화면" }],
      },
    ];
  }

  const sections: Array<MenuSection | null> = [...MENU_VISIBILITY_DEFINITIONS]
    .sort(
      (left, right) =>
        menuVisibility.categories[left.key].order - menuVisibility.categories[right.key].order
    )
    .map((definition) => {
      if (!canUserAccessMenuCategory(menuVisibility, definition.key, user)) {
        return null;
      }

      const items = getMenuVisibilityItemsForCategory(menuVisibility, definition.key)
        .sort(
          (left, right) =>
            menuVisibility.items[left.key].order - menuVisibility.items[right.key].order
        )
        .filter(
          (item) =>
            canUseIntrinsicMenuItem(user, item.key) &&
            canUserAccessMenuItem(menuVisibility, item.key, user)
        )
        .map(
          (item) =>
            ({
              id: item.key,
              label: menuVisibility.items[item.key].label,
              href: getMenuItemHref(item.key, menuVisibility),
              dashboardSectionId: getMenuItemDashboardSectionId(item.key),
              isPlaceholder: !isCustomMenuVisibilityItemKey(item.key) && isPlaceholderMenuItem(item.key),
              visibilityKey: item.key,
            }) satisfies MenuItem
        );

      if (items.length === 0) {
        return null;
      }

      return {
        id: definition.key,
        title: menuVisibility.categories[definition.key].label,
        items,
      } satisfies MenuSection;
    });

  return sections.filter((section): section is MenuSection => section !== null);
}

export default function AppTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(() =>
    pathname === "/" ? false : lastKnownMenuOpen
  );
  const [authPending, setAuthPending] = useState(false);
  const [menuEntryPending, setMenuEntryPending] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readStoredTheme());
  const [toast, setToast] = useState<ToastState | null>(null);
  const [menuVisibility, setMenuVisibility] = useState<MenuVisibilitySettings>(() =>
    getDefaultMenuVisibilitySettings()
  );

  useEffect(() => {
    persistMenuOpen(pathname === "/" ? false : menuOpen);
  }, [menuOpen, pathname]);

  useEffect(() => {
    setMenuEntryPending(false);
  }, [pathname]);

  useEffect(() => {
    let isDisposed = false;

    applyTheme(themeMode);

    const syncUser = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!isDisposed) {
        setUser(currentUser ?? null);
      }
    };

    void syncUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      isDisposed = true;
      subscription.unsubscribe();
    };
  }, [themeMode]);

  useEffect(() => {
    let isDisposed = false;

    const loadMenuVisibility = async () => {
      try {
        const response = await fetch("/api/menu-visibility", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json().catch(() => null)) as MenuVisibilitySettingsResponse | null;

        if (!isDisposed && payload?.settings) {
          setMenuVisibility(payload.settings);
        }
      } catch {
        // Ignore fetch failures and keep default menu visibility.
      }
    };

    const handleMenuVisibilityUpdated = () => {
      void loadMenuVisibility();
    };

    void loadMenuVisibility();

    window.addEventListener(MENU_VISIBILITY_UPDATED_EVENT, handleMenuVisibilityUpdated);

    return () => {
      isDisposed = true;
      window.removeEventListener(
        MENU_VISIBILITY_UPDATED_EVENT,
        handleMenuVisibilityUpdated
      );
    };
  }, []);

  useEffect(() => {
    if (!user || pathname === "/") {
      return;
    }

    const currentItemKey = getMenuItemKeyByPath(pathname);

    if (!currentItemKey) {
      return;
    }

    if (
      canUseIntrinsicMenuItem(user, currentItemKey) &&
      canUserAccessMenuItem(menuVisibility, currentItemKey, user)
    ) {
      return;
    }

    const fallbackHref = getFallbackMenuHref(user, menuVisibility);

    queuePendingToast({
      tone: "error",
      title: "메뉴 진입 권한이 없습니다",
      message: `${menuVisibility.items[currentItemKey].label} 메뉴 접근 권한을 관리자 설정에서 확인해주세요.`,
    });

    if (fallbackHref !== pathname) {
      router.replace(fallbackHref);
    } else {
      router.replace("/");
    }
  }, [menuVisibility, pathname, router, user]);

  const menuSections = createMenuSections(user, menuVisibility);
  const isLandingPage = pathname === "/";
  const isDashboardPage = pathname === "/dashboard";
  const isLoggedIn = Boolean(user);
  const logoHref = isLoggedIn ? "/dashboard" : "/";
  const logoAriaLabel = isLoggedIn ? "대시보드로 이동" : "초기화면으로 이동";
  const showDashboardMyPageButton = isLoggedIn && isDashboardPage;
  const showAuthButton = !isLandingPage || isLoggedIn;
  const authButtonLabel = authPending ? "처리 중" : isLoggedIn ? "로그아웃" : "로그인";
  const themeButtonLabel =
    themeMode === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환";
  const topBarWidthClass = isLandingPage ? "max-w-[22rem] sm:max-w-[24rem]" : "max-w-6xl";
  const topBarPanelClass = isLandingPage
    ? "landing-topbar-fx rounded-[22px] px-2.5 py-1.5 sm:rounded-[24px] sm:px-3 sm:py-2"
    : "rounded-[18px] px-2 py-2 sm:rounded-[20px] sm:px-3 sm:py-2.5";
  const topBarLayoutClass = isLandingPage
    ? "relative flex items-center justify-between gap-2.5 sm:gap-3"
    : "relative flex min-w-0 items-center justify-between gap-2 sm:gap-2.5";
  const topBarStartClass = isLandingPage
    ? "relative z-10 flex min-w-[2.25rem] shrink-0 items-center justify-start sm:min-w-[2.5rem]"
    : "relative z-10 flex min-w-[2.25rem] shrink-0 items-center justify-start sm:min-w-[2.5rem]";
  const topBarCenterClass = isLandingPage
    ? "pointer-events-none absolute inset-x-0 flex items-center justify-center px-[3.25rem] sm:px-[3.75rem]"
    : "pointer-events-none absolute inset-x-0 flex items-center justify-center px-[3.25rem] sm:px-[4.75rem]";
  const topBarEndClass = isLandingPage
    ? "relative z-10 flex min-w-[2.25rem] shrink-0 items-center justify-end gap-1.5 sm:min-w-[2.5rem] sm:gap-2"
    : "relative z-10 flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2";
  const iconButtonClass = isLandingPage
    ? "landing-nav-button flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[rgba(139,148,255,0.08)] p-0 text-[var(--text-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm sm:h-[36px] sm:w-[36px]"
    : "retro-button flex h-[36px] w-[36px] items-center justify-center p-0 text-sm font-semibold sm:h-[40px] sm:w-[40px]";
  const primaryIconButtonClass = isLandingPage
    ? "landing-nav-button landing-nav-button--solid flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[linear-gradient(180deg,rgba(99,102,241,0.96),rgba(79,70,229,0.88))] p-0 text-white shadow-[0_10px_24px_rgba(79,70,229,0.28)] sm:h-[36px] sm:w-[36px]"
    : "retro-button-solid flex h-[36px] w-[36px] items-center justify-center p-0 text-sm font-semibold sm:h-[40px] sm:w-[40px]";
  const menuPanelClass = isLandingPage
    ? "fixed left-1/2 top-[3.7rem] z-[60] w-[min(calc(100vw-1rem),22rem)] -translate-x-1/2 sm:top-[4.15rem] sm:w-[23rem]"
    : "fixed left-2 right-2 top-[3.95rem] z-[60] sm:left-3 sm:right-auto sm:top-[4.35rem] sm:w-[18rem]";

  const showToast = (tone: ToastState["tone"], title: string, message?: string) => {
    setToast(createToastState({ tone, title, message }));
  };

  const handleThemeToggle = () => {
    const nextTheme = themeMode === "dark" ? "light" : "dark";
    setThemeMode(nextTheme);
    applyTheme(nextTheme);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    }
  };

  const handleMyPageClick = () => {
    router.push("/settings");
  };

  const closeMenu = () => {
    persistMenuOpen(false);
    setMenuOpen(false);
  };

  const handleMenuItemSelect = (item: MenuItem) => {
    closeMenu();

    if (item.dashboardSectionId) {
      if (typeof window !== "undefined") {
        if (pathname === "/dashboard") {
          window.dispatchEvent(
            new CustomEvent<DashboardSectionId>(DASHBOARD_SECTION_EVENT, {
              detail: item.dashboardSectionId,
            })
          );
        } else {
          setMenuEntryPending(true);
          window.sessionStorage.setItem(
            DASHBOARD_SECTION_STORAGE_KEY,
            item.dashboardSectionId
          );
          router.push("/dashboard");
        }
      }

      return;
    }

    if (item.isPlaceholder) {
      showToast("info", item.label, "구현 중입니다.");
      return;
    }

    if (item.href) {
      if (isExternalMenuHref(item.href)) {
        window.open(item.href, "_blank", "noopener,noreferrer");
        return;
      }

      if (item.href === pathname) {
        return;
      }

      setMenuEntryPending(true);
      router.push(item.href);
    }
  };

  const handleAuthClick = async () => {
    if (!isLoggedIn) {
      router.push("/");
      return;
    }

    setAuthPending(true);

    const { error } = await supabase.auth.signOut();

    setAuthPending(false);

    if (error) {
      showToast(
        "error",
        "로그아웃 실패",
        getKoreanErrorMessage(error.message, "로그아웃 중 문제가 발생했습니다.")
      );
      return;
    }

    queuePendingToast({
      tone: "info",
      title: "로그아웃 완료",
      message: "초기화면으로 이동합니다.",
    });
    router.replace("/");
  };

  return (
    <div
      className="fixed z-50 px-2 sm:px-3"
      style={{ top: 0, left: 0, right: 0 }}
    >
      <div className={`mx-auto w-full ${topBarWidthClass}`}>
        <ToastViewport toast={toast} onDismiss={() => setToast(null)} />

        {menuEntryPending ? <MenuEntryLoadingCard /> : null}

        {menuOpen ? (
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-[rgba(4,4,6,0.52)] backdrop-blur-[2px]"
            onClick={closeMenu}
          />
        ) : null}

        <nav className={`retro-panel relative z-[60] w-full ${topBarPanelClass}`}>
          <div className={topBarLayoutClass}>
            <div className={topBarStartClass}>
              <button
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                onPointerDown={isLandingPage ? triggerLandingRipple : undefined}
                aria-label="메뉴 열기"
                aria-expanded={menuOpen}
                aria-controls="global-page-menu"
                title="메뉴"
                className={iconButtonClass}
              >
                <MenuIcon />
              </button>
            </div>

            <div className={topBarCenterClass}>
              <Link
                href={logoHref}
                aria-label={logoAriaLabel}
                className="pointer-events-auto app-topbar-logo app-topbar-logo--animated landing-logo-link"
              >
                <LogoWordmark
                  mode={themeMode}
                  className={
                    isLandingPage
                      ? "block h-auto w-[124px] sm:w-[136px]"
                      : "block h-auto w-[136px] sm:w-[156px] lg:w-[172px]"
                  }
                />
              </Link>
            </div>

            <div className={topBarEndClass}>
              {showDashboardMyPageButton ? (
                <button
                  type="button"
                  onClick={handleMyPageClick}
                  onPointerDown={isLandingPage ? triggerLandingRipple : undefined}
                  aria-label="마이페이지"
                  title="마이페이지"
                  className={iconButtonClass}
                >
                  <MyPageIcon />
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleThemeToggle}
                onPointerDown={isLandingPage ? triggerLandingRipple : undefined}
                aria-label={themeButtonLabel}
                title={themeButtonLabel}
                className={iconButtonClass}
              >
                {themeMode === "dark" ? <SunIcon /> : <MoonIcon />}
              </button>

              {showAuthButton ? (
                <button
                  type="button"
                  onClick={handleAuthClick}
                  onPointerDown={isLandingPage ? triggerLandingRipple : undefined}
                  disabled={authPending}
                  aria-label={authButtonLabel}
                  title={authButtonLabel}
                  className={primaryIconButtonClass}
                >
                  {authPending ? <LoadingIcon /> : isLoggedIn ? <LogoutIcon /> : <LoginIcon />}
                </button>
              ) : null}
            </div>
          </div>
        </nav>

        {menuOpen ? (
          <div id="global-page-menu" className={menuPanelClass}>
            <div className="retro-panel max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-[20px] px-3 py-3">
              <p className="theme-kicker px-2 pb-2 text-[10px]">GLOBAL MENU</p>

              <div className="space-y-3">
                {menuSections.map((section) => (
                  <section key={section.id} className="space-y-1.5">
                    <p className="theme-kicker px-2 text-[10px]">{section.title}</p>

                    {section.items.length > 0 ? (
                      <div className="space-y-1">
                        {section.items.map((item) => {
                          const isCurrentPage = Boolean(item.href && item.href === pathname);

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleMenuItemSelect(item)}
                              className={`app-topbar-menu-item ${
                                isCurrentPage ? "app-topbar-menu-item--active" : ""
                              }`}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                ))}

                <div className="mt-4 border-t border-[var(--border)] px-1 pt-3">
                  <a
                    href={KAKAO_INQUIRY_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="retro-button flex min-h-[40px] w-full items-center justify-center px-4 py-2 text-[12px] font-semibold sm:text-[13px]"
                    aria-label="카카오톡 문의하기"
                  >
                    문의하기
                  </a>

                  <p className="theme-kicker px-1 pt-2 text-center text-[10px] sm:text-[11px]">
                    카카오톡 상담으로 연결됩니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}