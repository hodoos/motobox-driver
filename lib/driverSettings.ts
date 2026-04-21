import type { User } from "@supabase/supabase-js";
import { recordOperatorAuditLog } from "./operatorAuditLogClient";
import { supabase } from "./supabase";

type DriverProfileSeed = {
  driverName?: string;
  phoneNumber?: string;
};

function normalizeSeedValue(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function isMissingDriverSettingsPhoneNumberColumn(error: { message?: string } | null) {
  return Boolean(
    error?.message?.includes("phone_number") &&
      error.message.includes("driver_settings")
  );
}

export function extractDriverProfileSeed(user: Pick<User, "user_metadata">): DriverProfileSeed {
  const metadata = user.user_metadata;

  return {
    driverName:
      typeof metadata?.driver_name === "string" ? metadata.driver_name : "",
    phoneNumber:
      typeof metadata?.phone_number === "string" ? metadata.phone_number : "",
  };
}

export async function ensureDriverSettingsRow(
  userId: string,
  seed: DriverProfileSeed = {}
) {
  const { data, error } = await supabase
    .from("driver_settings")
    .select("user_id")
    .eq("user_id", userId)
    .limit(1);

  const existingRow = Array.isArray(data) ? data[0] ?? null : null;

  if (error || existingRow) {
    return { error, created: false };
  }

  const basePayload = {
    user_id: userId,
    driver_name: normalizeSeedValue(seed.driverName),
    unit_price: null,
    settlement_start_day: 26,
    settlement_start_month_offset: -1,
    settlement_end_day: 25,
    settlement_end_month_offset: 0,
    off_days: [],
    biweekly_off_days: [],
    biweekly_anchor_date: null,
  };

  const payloadWithPhoneNumber = {
    ...basePayload,
    phone_number: normalizeSeedValue(seed.phoneNumber) || null,
  };

  const { error: insertError } = await supabase
    .from("driver_settings")
    .insert(payloadWithPhoneNumber);

  if (isMissingDriverSettingsPhoneNumberColumn(insertError)) {
    const { error: fallbackInsertError } = await supabase
      .from("driver_settings")
      .insert(basePayload);

    if (!fallbackInsertError) {
      await recordOperatorAuditLog({
        action: "driver_settings_created",
        targetType: "driver_settings",
        targetId: userId,
        summary: "관리 권한 계정의 기사 기본설정 행이 생성됐습니다.",
        details: {
          user_id: userId,
          driver_name: basePayload.driver_name,
        },
      });
    }

    return {
      error: fallbackInsertError,
      created: !fallbackInsertError,
    };
  }

  if (!insertError) {
    await recordOperatorAuditLog({
      action: "driver_settings_created",
      targetType: "driver_settings",
      targetId: userId,
      summary: "관리 권한 계정의 기사 기본설정 행이 생성됐습니다.",
      details: {
        user_id: userId,
        driver_name: payloadWithPhoneNumber.driver_name,
        phone_number: payloadWithPhoneNumber.phone_number,
      },
    });
  }

  return {
    error: insertError,
    created: !insertError,
  };
}

export { isMissingDriverSettingsPhoneNumberColumn };