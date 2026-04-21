import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isAdminUser, isOperatorUser } from "../../../lib/admin";
import { extractDriverProfileSeed } from "../../../lib/driverSettings";
import {
  insertOperatorAuditLog,
  normalizeOperatorAuditLogInput,
} from "../../../lib/operatorAuditLog";
import { appendOperatorAuditLogFile } from "../../../lib/operatorAuditLogServer";
import {
  createSupabaseAdminClient,
  createSupabaseServerAuthClient,
  getSupabaseAdminConfigurationError,
} from "../../../lib/supabaseServer";
import { getKoreanErrorMessage } from "../../../lib/toast";
import type { StaffAuditLogResponse, StaffAuditLogRow } from "../../../types";

export const dynamic = "force-dynamic";

const STAFF_AUDIT_LOG_LIMIT = 50;
const HIDDEN_AUDIT_LOG_ACTIONS = new Set(["validation_probe", "migration_validation_probe"]);
const USER_TARGET_TYPES = new Set(["user", "auth_user", "driver_settings", "daily_report"]);

function getAccessToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorization.slice(7).trim() || null;
}

function createErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getDetailsRecord(log: StaffAuditLogRow) {
  return log.details && typeof log.details === "object" && !Array.isArray(log.details)
    ? log.details
    : {};
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

function getAuditTargetUserId(log: StaffAuditLogRow) {
  const details = getDetailsRecord(log);
  const detailUserId = normalizeText(details.user_id) || normalizeText(details.target_user_id);

  if (detailUserId) {
    return detailUserId;
  }

  if (!USER_TARGET_TYPES.has(log.target_type)) {
    return "";
  }

  const targetId = normalizeText(log.target_id);

  if (!targetId) {
    return "";
  }

  if (log.target_type === "daily_report") {
    return targetId.split(":")[0]?.trim() ?? "";
  }

  return targetId;
}

function createUserNameMap(
  userIds: string[],
  authUsers: User[],
  driverSettingsRows: Array<{ user_id: string; driver_name: string | null }>
) {
  const authUserMap = new Map(authUsers.map((authUser) => [authUser.id, authUser]));
  const driverSettingsMap = new Map(
    driverSettingsRows.map((row) => [row.user_id, normalizeText(row.driver_name)])
  );
  const userNameMap = new Map<string, string>();

  userIds.forEach((userId) => {
    const storedDriverName = driverSettingsMap.get(userId) ?? "";

    if (storedDriverName) {
      userNameMap.set(userId, storedDriverName);
      return;
    }

    const authUser = authUserMap.get(userId);
    const profileSeed = authUser ? extractDriverProfileSeed(authUser) : {};
    const metadataDriverName = normalizeText(profileSeed.driverName);

    if (metadataDriverName) {
      userNameMap.set(userId, metadataDriverName);
      return;
    }

    const email = normalizeText(authUser?.email);

    if (email) {
      userNameMap.set(userId, email);
      return;
    }

    userNameMap.set(userId, userId);
  });

  return userNameMap;
}

function getAuditActionSummary(log: StaffAuditLogRow) {
  const details = getDetailsRecord(log);

  switch (log.action) {
    case "user_level_changed": {
      const previousLevel = normalizeText(details.previous_user_level);
      const nextLevel = normalizeText(details.next_user_level);

      if (previousLevel && nextLevel) {
        return `${previousLevel} -> ${nextLevel}`;
      }

      return "등급 변경";
    }
    case "auth_profile_updated":
      return "프로필 수정";
    case "driver_settings_saved":
      return "설정 저장";
    case "driver_settings_created":
      return "설정 생성";
    case "daily_report_saved": {
      const reportDate = normalizeText(details.report_date);
      return reportDate ? `${reportDate} 저장` : "리포트 저장";
    }
    case "daily_report_deleted": {
      const reportDate = normalizeText(details.report_date);
      return reportDate ? `${reportDate} 삭제` : "리포트 삭제";
    }
    default:
      return normalizeText(log.summary) || log.action;
  }
}

function getAuditTargetName(log: StaffAuditLogRow, userNameMap: Map<string, string>) {
  const details = getDetailsRecord(log);
  const targetUserId = getAuditTargetUserId(log);
  const targetUserName = targetUserId ? userNameMap.get(targetUserId) ?? "" : "";
  const reportDate = normalizeText(details.report_date);

  if (targetUserName && reportDate && log.target_type === "daily_report") {
    return `${targetUserName} · ${reportDate}`;
  }

  if (targetUserName) {
    return targetUserName;
  }

  return normalizeText(log.target_type) || normalizeText(log.target_id) || "대상 없음";
}

export async function POST(request: Request) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return createErrorResponse("로그인이 필요합니다.", 401);
  }

  const authClient = createSupabaseServerAuthClient();
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(accessToken);

  if (authError || !user) {
    return createErrorResponse(
      getKoreanErrorMessage(authError?.message, "세션을 확인할 수 없습니다. 다시 로그인해주세요."),
      401
    );
  }

  const payload = normalizeOperatorAuditLogInput(await request.json().catch(() => null));

  if (!payload) {
    return createErrorResponse("감사 로그 정보를 다시 확인해주세요.", 400);
  }

  if (!isAdminUser(user)) {
    return NextResponse.json({ recorded: false }, { status: 200 });
  }

  const configurationError = getSupabaseAdminConfigurationError();

  if (configurationError) {
    return createErrorResponse(configurationError, 500);
  }

  const adminClient = createSupabaseAdminClient();
  const auditResult = await insertOperatorAuditLog(adminClient, user, payload);

  if (auditResult.error) {
    try {
      const fallbackRecorded = await appendOperatorAuditLogFile(user, payload);

      if (fallbackRecorded) {
        return NextResponse.json({ recorded: true, storage: "file" }, { status: 201 });
      }
    } catch (fallbackError) {
      return createErrorResponse(
        getKoreanErrorMessage(
          fallbackError instanceof Error ? fallbackError.message : auditResult.error.message,
          "감사 로그를 저장하지 못했습니다."
        ),
        500
      );
    }

    return createErrorResponse(
      getKoreanErrorMessage(auditResult.error.message, "감사 로그를 저장하지 못했습니다."),
      500
    );
  }

  return NextResponse.json({ recorded: auditResult.recorded, storage: "database" }, { status: 201 });
}

export async function GET(request: Request) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return createErrorResponse("로그인이 필요합니다.", 401);
  }

  const authClient = createSupabaseServerAuthClient();
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(accessToken);

  if (authError || !user) {
    return createErrorResponse(
      getKoreanErrorMessage(authError?.message, "세션을 확인할 수 없습니다. 다시 로그인해주세요."),
      401
    );
  }

  if (!isOperatorUser(user)) {
    return createErrorResponse("운영자Lv 계정만 수정 기록 로그를 확인할 수 있습니다.", 403);
  }

  const configurationError = getSupabaseAdminConfigurationError();

  if (configurationError) {
    return createErrorResponse(configurationError, 500);
  }

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("operator_audit_logs")
    .select(
      "id, actor_user_id, actor_email, actor_level, action, target_type, target_id, source, summary, details, created_at"
    )
    .in("actor_level", ["관리자Lv", "운영자Lv"])
    .order("created_at", { ascending: false })
    .limit(STAFF_AUDIT_LOG_LIMIT);

  if (error) {
    return createErrorResponse(
      getKoreanErrorMessage(error.message, "수정 기록 로그를 불러오지 못했습니다."),
      500
    );
  }

  const normalizedLogs = ((data as StaffAuditLogRow[] | null) ?? [])
    .filter((row) => !HIDDEN_AUDIT_LOG_ACTIONS.has(row.action))
    .map((row) => ({
      ...row,
      details: getDetailsRecord(row),
    }));

  const userIds = Array.from(
    new Set(
      normalizedLogs.flatMap((log) => {
        const targetUserId = getAuditTargetUserId(log);
        return targetUserId ? [log.actor_user_id, targetUserId] : [log.actor_user_id];
      })
    )
  ).filter(Boolean);

  let userNameMap = new Map<string, string>();

  if (userIds.length > 0) {
    const [authUsersResult, driverSettingsResult] = await Promise.all([
      loadAllAuthUsers(adminClient),
      adminClient
        .from("driver_settings")
        .select("user_id, driver_name")
        .in("user_id", userIds),
    ]);

    if (authUsersResult.error || driverSettingsResult.error) {
      const rawMessage =
        authUsersResult.error?.message ||
        driverSettingsResult.error?.message ||
        "수정 기록 사용자 정보를 불러오지 못했습니다.";

      return createErrorResponse(
        getKoreanErrorMessage(rawMessage, "수정 기록 사용자 정보를 불러오지 못했습니다."),
        500
      );
    }

    userNameMap = createUserNameMap(
      userIds,
      authUsersResult.data ?? [],
      (driverSettingsResult.data as Array<{ user_id: string; driver_name: string | null }>) ?? []
    );
  }

  const responseBody: StaffAuditLogResponse = {
    logs: normalizedLogs.map((log) => ({
      ...log,
      actor_name: userNameMap.get(log.actor_user_id) ?? normalizeText(log.actor_email) ?? log.actor_user_id,
      target_name: getAuditTargetName(log, userNameMap),
      summary_short: getAuditActionSummary(log),
    })),
  };

  return NextResponse.json(responseBody);
}