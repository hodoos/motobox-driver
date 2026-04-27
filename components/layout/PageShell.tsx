import type { ReactNode } from "react";
import LoginIdRequiredModal from "../auth/LoginIdRequiredModal";
import AppTopBar from "./AppTopBar";

type PageShellProps = {
  children: ReactNode;
  contentClassName: string;
};

type PageLoadingShellProps = {
  message: string;
  contentClassName?: string;
};

const PAGE_SHELL_CLASS_NAME =
  "retro-scanlines retro-grid-bg min-h-[100dvh] bg-[var(--bg)] px-2 pb-4 pt-3 text-[var(--text)] sm:px-3 sm:pb-5 sm:pt-4";

const DEFAULT_LOADING_CONTENT_CLASS_NAME =
  "flex w-full max-w-[32rem] flex-1 items-center justify-center";

function PageLoadingIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 4.5V7.25"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 16.75V19.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M19.5 12H16.75"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7.25 12H4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M17.3 6.7L15.35 8.65"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8.65 15.35L6.7 17.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M17.3 17.3L15.35 15.35"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8.65 8.65L6.7 6.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
    </svg>
  );
}

export default function PageShell({ children, contentClassName }: PageShellProps) {
  return (
    <main className={PAGE_SHELL_CLASS_NAME}>
      <AppTopBar />
      <div className="mx-auto flex min-h-[calc(100dvh-1.75rem)] w-full max-w-6xl min-w-0 flex-col gap-3 pt-[3.75rem] sm:min-h-[calc(100dvh-2rem)] sm:gap-4 sm:pt-[4.15rem]">
        <LoginIdRequiredModal />
        <div className={`w-full min-w-0 self-center ${contentClassName}`}>{children}</div>
      </div>
    </main>
  );
}

export function PageLoadingShell({
  message,
  contentClassName = DEFAULT_LOADING_CONTENT_CLASS_NAME,
}: PageLoadingShellProps) {
  return (
    <PageShell contentClassName={contentClassName}>
      <div className="sr-only" role="status" aria-live="polite" aria-busy="true">
        {message}
      </div>
    </PageShell>
  );
}