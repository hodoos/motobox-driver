"use client";

import type { OperatorAuditLogInput } from "./operatorAuditLog";
import { supabase } from "./supabase";

export async function recordOperatorAuditLog(input: OperatorAuditLogInput) {
  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      return false;
    }

    const source =
      input.source ?? (typeof window !== "undefined" ? window.location.pathname : null);

    const response = await fetch("/api/operator-audit-logs", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...input,
        source,
      }),
      keepalive: true,
    });

    return response.ok;
  } catch (error) {
    console.warn("operator audit log request failed", error);
    return false;
  }
}