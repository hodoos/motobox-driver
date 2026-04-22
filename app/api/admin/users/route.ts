import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  canManageUserLevelChange,
  getAdminDisplayLevel,
  isAdminUser,
  isLegacyAdminUser,
} from "../../../../lib/admin";
import { extractDriverProfileSeed } from "../../../../lib/driverSettings";
import {
  createSupabaseAdminClient,
  createSupabaseServerAuthClient,
  getSupabaseAdminConfigurationError,
} from "../../../../lib/supabaseServer";
import { getKoreanErrorMessage } from "../../../../lib/toast";
import { getUserLevel, isUserLevel } from "../../../../lib/userLevel";
import { insertOperatorAuditLog } from "../../../../lib/operatorAuditLog";
import type {
  AdminManagedUserRow,
  AdminUserLevel,
  AdminUserLevelUpdateResponse,
  AdminUsersResponse,
} from "../../../../types";

export const dynamic = "force-dynamic";

type DriverSettingsLookupRow = {
  user_id: string;
  driver_name: string | null;
  phone_number: string | null;
  last_web_activity_at?: string | null;
  unit_price: number | null;
};

function createErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getAccessToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorization.slice(7).trim() || null;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readLastWebActivityAt(authUser: User, driverSettingsRow?: DriverSettingsLookupRow) {
  return (
    normalizeText(authUser.user_metadata?.last_web_activity_at) ||
    normalizeText(driverSettingsRow?.last_web_activity_at) ||
    null
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingDriverSettingsLastWebActivityColumn(error: { message?: string } | null) {
  return Boolean(
    error?.message?.includes("last_web_activity_at") &&
      error.message.includes("driver_settings")
  );
}

async function loadAuthorizedAdminUser(request: Request) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return {
      user: null,
      error: createErrorResponse("로그인이 필요합니다.", 401),
    };
  }

  const authClient = createSupabaseServerAuthClient();
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(accessToken);

  if (error || !user) {
    return {
      user: null,
      error: createErrorResponse(
        getKoreanErrorMessage(error?.message, "세션을 확인할 수 없습니다. 다시 로그인해주세요."),
        401
      ),
    };
  }

  if (!isAdminUser(user)) {
    return {
      user: null,
      error: createErrorResponse("권한이 있는 계정만 관리자 페이지에 접근할 수 있습니다.", 403),
    };
  }

  return {
    user,
    error: null,
  };
}

async function loadAllAuthUsers(adminClient: ReturnType<typeof createSupabaseAdminClient>) {
  const users: User[] = [];
  let page: number | null = 1;

  while (page) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      return { data: users, error };
    }

    users.push(...(data.users ?? []));
    page = data.nextPage ?? null;
  }

  return { data: users, error: null };
}

function toManagedUserRow(
  authUser: User,
  driverSettingsMap: Map<string, DriverSettingsLookupRow>
): AdminManagedUserRow {
  const storedRow = driverSettingsMap.get(authUser.id);
  const profileSeed = extractDriverProfileSeed(authUser);
  const isLegacyAdmin = isLegacyAdminUser(authUser);

  return {
    user_id: authUser.id,
    email: normalizeText(authUser.email) || null,
    driver_name: storedRow?.driver_name?.trim() || profileSeed.driverName?.trim() || null,
    phone_number: storedRow?.phone_number?.trim() || profileSeed.phoneNumber?.trim() || null,
    last_sign_in_at: normalizeText(authUser.last_sign_in_at) || null,
    last_web_activity_at: readLastWebActivityAt(authUser, storedRow),
    unit_price: storedRow?.unit_price ?? null,
    current_user_level: isLegacyAdmin ? getAdminDisplayLevel(authUser) : getUserLevel(authUser),
    is_legacy_admin: isLegacyAdmin,
  };
}

function createManagedUserRows(
  authUsers: User[],
  driverSettingsRows: DriverSettingsLookupRow[],
  currentActorUserId?: string | null
) {
  const driverSettingsMap = new Map(
    driverSettingsRows.map((row) => [row.user_id, row] as const)
  );

  return authUsers
    .map((authUser) => toManagedUserRow(authUser, driverSettingsMap))
    .filter(
      (row) => !row.is_legacy_admin || row.user_id === normalizeText(currentActorUserId)
    )
    .sort((left, right) => {
      const leftName = left.driver_name || left.email || left.user_id;
      const rightName = right.driver_name || right.email || right.user_id;
      const nameComparison = leftName.localeCompare(rightName, "ko");

      if (nameComparison !== 0) {
        return nameComparison;
      }

      return left.user_id.localeCompare(right.user_id);
    });
}

async function loadDriverSettingsRows(adminClient: ReturnType<typeof createSupabaseAdminClient>) {
  const result = await adminClient
    .from("driver_settings")
    .select("user_id, driver_name, phone_number, unit_price, last_web_activity_at")
    .order("driver_name", { ascending: true });

  if (isMissingDriverSettingsLastWebActivityColumn(result.error)) {
    return adminClient
      .from("driver_settings")
      .select("user_id, driver_name, phone_number, unit_price")
      .order("driver_name", { ascending: true });
  }

  return result;
}

async function loadDriverSettingsRowByUserId(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
) {
  const result = await adminClient
    .from("driver_settings")
    .select("user_id, driver_name, phone_number, unit_price, last_web_activity_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (isMissingDriverSettingsLastWebActivityColumn(result.error)) {
    return adminClient
      .from("driver_settings")
      .select("user_id, driver_name, phone_number, unit_price")
      .eq("user_id", userId)
      .maybeSingle();
  }

  return result;
}

function parseUserLevelUpdateInput(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const targetUserId = normalizeText(value.targetUserId);
  const nextUserLevel = normalizeText(value.nextUserLevel);

  if (!targetUserId || !isUserLevel(nextUserLevel)) {
    return null;
  }

  return {
    targetUserId,
    nextUserLevel: nextUserLevel as AdminUserLevel,
  };
}

export async function GET(request: Request) {
  const { user, error } = await loadAuthorizedAdminUser(request);

  if (error || !user) {
    return error;
  }

  const configurationError = getSupabaseAdminConfigurationError();

  if (configurationError) {
    return createErrorResponse(configurationError, 500);
  }

  const adminClient = createSupabaseAdminClient();
  const [usersResult, driverSettingsResult] = await Promise.all([
    loadAllAuthUsers(adminClient),
    loadDriverSettingsRows(adminClient),
  ]);

  if (usersResult.error || driverSettingsResult.error) {
    const rawMessage =
      usersResult.error?.message ||
      driverSettingsResult.error?.message ||
      "관리자 사용자 목록을 불러오지 못했습니다.";

    return createErrorResponse(
      getKoreanErrorMessage(rawMessage, "관리자 사용자 목록을 불러오지 못했습니다."),
      500
    );
  }

  const responseBody: AdminUsersResponse = {
    users: createManagedUserRows(
      usersResult.data ?? [],
      (driverSettingsResult.data as DriverSettingsLookupRow[] | null) ?? [],
      user.id
    ),
  };

  return NextResponse.json(responseBody);
}

export async function PATCH(request: Request) {
  const { user: actor, error } = await loadAuthorizedAdminUser(request);

  if (error || !actor) {
    return error;
  }

  const payload = parseUserLevelUpdateInput(await request.json().catch(() => null));

  if (!payload) {
    return createErrorResponse("변경할 사용자 등급 정보를 다시 확인해주세요.", 400);
  }

  const configurationError = getSupabaseAdminConfigurationError();

  if (configurationError) {
    return createErrorResponse(configurationError, 500);
  }

  const adminClient = createSupabaseAdminClient();
  const {
    data: targetUserResult,
    error: targetUserError,
  } = await adminClient.auth.admin.getUserById(payload.targetUserId);

  if (targetUserError || !targetUserResult.user) {
    return createErrorResponse(
      getKoreanErrorMessage(targetUserError?.message, "변경할 사용자를 찾지 못했습니다."),
      targetUserError ? 500 : 404
    );
  }

  const targetUser = targetUserResult.user;

  if (isLegacyAdminUser(targetUser)) {
    return createErrorResponse(
      "레거시 관리자 권한 계정은 관리자 페이지에서 등급을 변경할 수 없습니다.",
      403
    );
  }

  const previousUserLevel = getUserLevel(targetUser);

  if (!canManageUserLevelChange(actor, previousUserLevel, payload.nextUserLevel)) {
    return createErrorResponse(
      "현재 계정은 이 사용자 등급 변경을 수행할 수 없습니다.",
      403
    );
  }

  if (previousUserLevel === payload.nextUserLevel) {
    const { data: driverSettingsData } = await loadDriverSettingsRowByUserId(
      adminClient,
      targetUser.id
    );

    const responseBody: AdminUserLevelUpdateResponse = {
      user: toManagedUserRow(
        targetUser,
        new Map(
          driverSettingsData
            ? [[driverSettingsData.user_id, driverSettingsData as DriverSettingsLookupRow]]
            : []
        )
      ),
    };

    return NextResponse.json(responseBody);
  }

  const mergedUserMetadata = {
    ...(targetUser.user_metadata ?? {}),
    user_level: payload.nextUserLevel,
  };

  const {
    data: updatedUserResult,
    error: updateUserError,
  } = await adminClient.auth.admin.updateUserById(targetUser.id, {
    user_metadata: mergedUserMetadata,
  });

  if (updateUserError || !updatedUserResult.user) {
    return createErrorResponse(
      getKoreanErrorMessage(updateUserError?.message, "사용자 등급을 변경하지 못했습니다."),
      500
    );
  }

  await insertOperatorAuditLog(adminClient, actor, {
    action: "user_level_changed",
    targetType: "user",
    targetId: targetUser.id,
    summary: `${getAdminDisplayLevel(actor)} 계정이 사용자 등급을 변경했습니다.`,
    details: {
      target_user_id: targetUser.id,
      target_email: normalizeText(targetUser.email) || null,
      previous_user_level: previousUserLevel,
      next_user_level: payload.nextUserLevel,
    },
    source: "/admin",
  });

  const {
    data: driverSettingsData,
    error: driverSettingsError,
  } = await loadDriverSettingsRowByUserId(adminClient, targetUser.id);

  if (driverSettingsError) {
    return createErrorResponse(
      getKoreanErrorMessage(driverSettingsError.message, "변경된 사용자 정보를 불러오지 못했습니다."),
      500
    );
  }

  const responseBody: AdminUserLevelUpdateResponse = {
    user: toManagedUserRow(
      updatedUserResult.user,
      new Map(
        driverSettingsData
          ? [[driverSettingsData.user_id, driverSettingsData as DriverSettingsLookupRow]]
          : []
      )
    ),
  };

  return NextResponse.json(responseBody);
}
