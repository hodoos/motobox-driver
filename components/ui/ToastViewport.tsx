"use client";

import type { ToastState, ToastTone } from "../../lib/toast";

type Props = {
  toast: ToastState | null;
  onDismiss: () => void;
};

const TOAST_BADGE_LABEL = {
  success: "성공",
  error: "실패",
  info: "안내",
} as const;

const TOAST_KICKER_LABEL = {
  success: "SYSTEM OK",
  error: "SYSTEM ALERT",
  info: "SYSTEM NOTE",
} as const;

function ToastToneIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M6.75 12.5L10.2 15.95L17.25 8.9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (tone === "error") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12 7.25V12.25"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="16.25" r="1" fill="currentColor" />
        <path
          d="M10.35 4.62L4.7 14.42C3.97 15.68 4.88 17.25 6.35 17.25H17.65C19.12 17.25 20.03 15.68 19.3 14.42L13.65 4.62C12.91 3.34 11.09 3.34 10.35 4.62Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 10V15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7.25" r="1" fill="currentColor" />
    </svg>
  );
}

export default function ToastViewport({ toast, onDismiss }: Props) {
  if (!toast) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-18 z-[100001] flex justify-center px-2.5 sm:top-21 sm:px-4">
      <div className="retro-toast-shell w-full max-w-120">
        <div
          role={toast.tone === "error" ? "alert" : "status"}
          aria-live={toast.tone === "error" ? "assertive" : "polite"}
          aria-atomic="true"
          className={`retro-toast retro-toast-${toast.tone} pointer-events-auto rounded-[28px] px-3 py-3 sm:px-4 sm:py-4`}
        >
          <div className="retro-toast__layout">
            <div className="retro-toast__main">
              <div
                className={`retro-toast__icon retro-toast__icon--${toast.tone}`}
                aria-hidden="true"
              >
                <ToastToneIcon tone={toast.tone} />
              </div>

              <div className="retro-toast__content">
                <div className="retro-toast__meta">
                  <span className="retro-toast__eyebrow retro-title text-[10px] leading-none tracking-[0.22em]">
                    {TOAST_KICKER_LABEL[toast.tone]}
                  </span>
                  <span className="retro-toast__badge retro-title text-[10px] leading-none tracking-[0.18em]">
                    {TOAST_BADGE_LABEL[toast.tone]}
                  </span>
                </div>

                <div className="retro-toast__copy">
                  <p className="retro-title theme-heading text-sm leading-tight sm:text-[15px]">
                    {toast.title}
                  </p>
                  {toast.message ? (
                    <p className="theme-copy text-[13px] leading-relaxed sm:text-sm">
                      {toast.message}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onDismiss}
              className="retro-toast__dismiss retro-button min-h-11 min-w-[5.25rem] shrink-0 px-4 text-xs font-semibold sm:min-h-12"
              aria-label="알림 닫기"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}