"use client";

import { useEffect } from "react";
import type { ToastState } from "../../lib/toast";

type Props = {
  toast: ToastState | null;
  onDismiss: () => void;
};

const TOAST_BADGE_LABEL = {
  success: "성공",
  error: "실패",
  info: "안내",
} as const;

export default function ToastViewport({ toast, onDismiss }: Props) {
  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(onDismiss, toast.tone === "success" ? 2400 : 3600);

    return () => window.clearTimeout(timeoutId);
  }, [toast, onDismiss]);

  if (!toast) {
    return null;
  }

  return (
    <div
      className="pointer-events-none z-[100001]"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
      }}
    >
      <div
        className="bg-black/26 backdrop-blur-[1.5px]"
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
        }}
      />
      <div
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "calc(100vw - 1.5rem)",
          maxWidth: "24rem",
          pointerEvents: "auto",
        }}
      >
        <div
          role={toast.tone === "error" ? "alert" : "status"}
          aria-live={toast.tone === "error" ? "assertive" : "polite"}
          className={`retro-toast retro-toast-${toast.tone} rounded-[24px] px-4 py-4 sm:px-5 sm:py-4`}
        >
          <div className="flex items-start gap-3">
            <span className="retro-toast__badge retro-title shrink-0 text-[10px] leading-none tracking-[0.18em]">
              {TOAST_BADGE_LABEL[toast.tone]}
            </span>

            <div className="min-w-0 flex-1">
              <p className="retro-title theme-heading text-[12px] sm:text-[13px]">{toast.title}</p>
              {toast.message ? (
                <p className="theme-copy mt-1 text-sm leading-relaxed">{toast.message}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onDismiss}
              className="retro-button min-h-[34px] min-w-[34px] shrink-0 px-2 text-xs font-semibold"
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