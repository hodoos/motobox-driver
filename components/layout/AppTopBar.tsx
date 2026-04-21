"use client";

import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAdminUser, isVendorUser } from "../../lib/admin";
import {
  canAccessCommunityBoard,
  COMMUNITY_BOARD_DEFINITIONS,
} from "../../lib/communityBoards";
import {
  DASHBOARD_SECTION_EVENT,
  DASHBOARD_SECTION_STORAGE_KEY,
  DashboardSectionId,
} from "../../lib/dashboardNavigation";
import { KAKAO_INQUIRY_URL } from "../../lib/support";
import { supabase } from "../../lib/supabase";
import {
  createToastState,
  getKoreanErrorMessage,
  queuePendingToast,
  ToastState,
} from "../../lib/toast";
import ToastViewport from "../ui/ToastViewport";

type MenuItem = {
  id: string;
  label: string;
  href?: string;
  dashboardSectionId?: DashboardSectionId;
  isPlaceholder?: boolean;
};

type MenuSection = {
  id: string;
  title: string;
  items: MenuItem[];
};

type ThemeMode = "dark" | "light";

const THEME_STORAGE_KEY = "motobox:theme";

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
      className="h-5 w-5 animate-spin"
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

function createMenuSections(user: User | null): MenuSection[] {
  if (!user) {
    return [
      {
        id: "basic",
        title: "기본",
        items: [{ id: "home", href: "/", label: "초기화면" }],
      },
    ];
  }

  const basicItems: MenuItem[] = [
    { id: "dashboard", href: "/dashboard", label: "홈", dashboardSectionId: "home" },
    { id: "my-page", href: "/settings", label: "마이페이지" },
  ];

  if (isAdminUser(user)) {
    basicItems.push({ id: "admin", href: "/admin", label: "관리자" });
  }

  const communityItems = COMMUNITY_BOARD_DEFINITIONS.filter(
    (board) => board.sectionTitle === "커뮤니티"
  ).map((board) => ({
    id: board.key,
    href: board.path,
    label: board.menuLabel,
    isPlaceholder: true,
  } satisfies MenuItem));

  const vendorSections = isVendorUser(user)
    ? [
        {
          id: "vendor-only",
          title: "밴더 전용",
          items: [
            {
              id: "vendor-home",
              href: "/vendor",
              label: "밴더 전용 페이지",
            },
          ],
        } satisfies MenuSection,
      ]
    : [];

  const affiliateSections: MenuSection[] = COMMUNITY_BOARD_DEFINITIONS.filter(
    (board) => board.sectionTitle === "제휴 전용" && canAccessCommunityBoard(board, user)
  ).map((board) => ({
    id: `${board.key}-section`,
    title: board.sectionTitle,
    items: [
      {
        id: board.key,
        href: board.path,
        label: board.menuLabel,
      },
    ],
  }));

  return [
    {
      id: "basic",
      title: "기본",
      items: basicItems,
    },
    {
      id: "dashboard-sections",
      title: "대시보드",
      items: [
        {
          id: "today-quick-card",
          label: "업무 작성",
          dashboardSectionId: "today-quick-card",
        },
        {
          id: "stats",
          label: "통계",
          dashboardSectionId: "stats",
        },
        {
          id: "work-calendar",
          label: "업무 캘린더",
          dashboardSectionId: "work-calendar",
        },
      ],
    },
    {
      id: "community",
      title: "커뮤니티",
      items: communityItems,
    },
    ...affiliateSections,
    ...vendorSections,
  ];
}

export default function AppTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [menuPathname, setMenuPathname] = useState<string | null>(null);
  const [authPending, setAuthPending] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readStoredTheme());
  const [toast, setToast] = useState<ToastState | null>(null);
  const menuOpen = menuPathname === pathname;

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

  const menuSections = createMenuSections(user);
  const isDashboardPage = pathname === "/dashboard";
  const isLoggedIn = Boolean(user);
  const logoHref = isLoggedIn ? "/dashboard" : "/";
  const logoAriaLabel = isLoggedIn ? "대시보드로 이동" : "초기화면으로 이동";
  const showDashboardMyPageButton = isLoggedIn && isDashboardPage;
  const authButtonLabel = authPending ? "처리 중" : isLoggedIn ? "로그아웃" : "로그인";
  const themeButtonLabel =
    themeMode === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환";

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

  const handleMenuItemSelect = (item: MenuItem) => {
    setMenuPathname(null);

    if (item.dashboardSectionId) {
      if (typeof window !== "undefined") {
        if (pathname === "/dashboard") {
          window.dispatchEvent(
            new CustomEvent<DashboardSectionId>(DASHBOARD_SECTION_EVENT, {
              detail: item.dashboardSectionId,
            })
          );
        } else {
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
    <div className="sticky top-0 z-50">
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} />

      {menuOpen ? (
        <button
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setMenuPathname(null)}
          className="fixed inset-0 z-40 bg-[rgba(4,4,6,0.52)] backdrop-blur-[2px]"
        />
      ) : null}

      <nav className="retro-panel relative z-[60] rounded-[24px] px-3 py-3 sm:px-4 sm:py-4">
        <div className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 sm:grid-cols-[3.25rem_1fr_auto]">
          <div className="relative justify-self-start">
            <button
              type="button"
              onClick={() =>
                setMenuPathname((current) => (current === pathname ? null : pathname))
              }
              aria-label="메뉴 열기"
              aria-expanded={menuOpen}
              aria-controls="global-page-menu"
              title="메뉴"
              className="retro-button flex h-[42px] w-[42px] items-center justify-center p-0 text-sm font-semibold"
            >
              <MenuIcon />
            </button>
          </div>

          <div className="justify-self-center">
            <Link href={logoHref} aria-label={logoAriaLabel}>
              <Image
                src="/driver-report-logo.svg"
                alt="택배판"
                width={172}
                height={56}
                priority
                className="block"
              />
            </Link>
          </div>

          <div className="flex items-center justify-self-end gap-2">
            {showDashboardMyPageButton ? (
              <button
                type="button"
                onClick={handleMyPageClick}
                aria-label="마이페이지"
                title="마이페이지"
                className="retro-button flex h-[42px] w-[42px] items-center justify-center p-0 text-sm font-semibold"
              >
                <MyPageIcon />
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleThemeToggle}
              aria-label={themeButtonLabel}
              title={themeButtonLabel}
              className="retro-button flex h-[42px] w-[42px] items-center justify-center p-0 text-sm font-semibold"
            >
              {themeMode === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>

            <button
              type="button"
              onClick={handleAuthClick}
              disabled={authPending}
              aria-label={authButtonLabel}
              title={authButtonLabel}
              className="retro-button-solid flex h-[42px] w-[42px] items-center justify-center p-0 text-sm font-semibold"
            >
              {authPending ? <LoadingIcon /> : isLoggedIn ? <LogoutIcon /> : <LoginIcon />}
            </button>
          </div>
        </div>
      </nav>

      {menuOpen ? (
        <div
          id="global-page-menu"
          className="fixed left-3 right-3 top-[5.5rem] z-[60] sm:left-4 sm:right-auto sm:top-[6rem] sm:w-[18rem]"
        >
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
                            className={`block w-full rounded-[14px] px-3 py-2.5 text-left text-sm font-semibold transition ${
                              isCurrentPage
                                ? "bg-[rgba(255,255,255,0.12)] text-[var(--text-strong)]"
                                : "text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)]"
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
                  onClick={() => setMenuPathname(null)}
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
  );
}