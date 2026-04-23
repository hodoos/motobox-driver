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
  "flex flex-1 w-full max-w-[28rem] items-center justify-center";

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
      <div className="retro-panel w-full rounded-[28px] px-6 py-5 text-center">{message}</div>
    </PageShell>
  );
}