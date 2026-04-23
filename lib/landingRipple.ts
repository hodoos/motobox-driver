import type { PointerEvent as ReactPointerEvent } from "react";

const RIPPLE_TIMEOUT_MS = 720;

export function triggerLandingRipple(event: ReactPointerEvent<HTMLElement>) {
  if (typeof window === "undefined") {
    return;
  }

  const target = event.currentTarget;
  const rect = target.getBoundingClientRect();
  const relativeX = ((event.clientX - rect.left) / rect.width) * 100;
  const relativeY = ((event.clientY - rect.top) / rect.height) * 100;
  const previousTimeoutId = target.dataset.landingRippleTimeoutId;

  target.style.setProperty("--landing-ripple-x", `${relativeX}%`);
  target.style.setProperty("--landing-ripple-y", `${relativeY}%`);
  target.classList.remove("is-rippling");

  void target.offsetWidth;

  target.classList.add("is-rippling");

  if (previousTimeoutId) {
    window.clearTimeout(Number(previousTimeoutId));
  }

  const timeoutId = window.setTimeout(() => {
    target.classList.remove("is-rippling");
    delete target.dataset.landingRippleTimeoutId;
  }, RIPPLE_TIMEOUT_MS);

  target.dataset.landingRippleTimeoutId = String(timeoutId);
}