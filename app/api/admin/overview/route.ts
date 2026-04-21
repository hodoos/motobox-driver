import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isAdminUser } from "../../../../lib/admin";
import { extractDriverProfileSeed } from "../../../../lib/driverSettings";
import {
  createSupabaseAdminClient,
  createSupabaseServerAuthClient,
  getSupabaseAdminConfigurationError,
} from "../../../../lib/supabaseServer";
import { getKoreanErrorMessage } from "../../../../lib/toast";
import type {
  AdminDriverSettingsRow,
  AdminOverviewResponse,
  DailyReportRow,
} from "../../../../types";

export const dynamic = "force-dynamic";

function getAccessToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorization.slice(7).trim() || null;
}

function isDateKey(value: string | null): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
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

function mergeDriverRows(
  driverSettingsRows: AdminDriverSettingsRow[],
  reports: DailyReportRow[],
  authUsers: User[]
) {
  const driverSettingsMap = new Map<string, AdminDriverSettingsRow>();
  const authUserMap = new Map<string, User>();
  const userIds = new Set<string>();

  driverSettingsRows.forEach((row) => {
    driverSettingsMap.set(row.user_id, row);
    userIds.add(row.user_id);
  });

  reports.forEach((report) => {
    userIds.add(report.user_id);
  });

  authUsers.forEach((authUser) => {
    authUserMap.set(authUser.id, authUser);

    const profileSeed = extractDriverProfileSeed(authUser);

    if (profileSeed.driverName || profileSeed.phoneNumber) {
      userIds.add(authUser.id);
    }
  });

  return Array.from(userIds)
    .map((userId) => {
      const storedRow = driverSettingsMap.get(userId);
      const authUser = authUserMap.get(userId);
      const profileSeed = authUser ? extractDriverProfileSeed(authUser) : {};
      const driverName = storedRow?.driver_name?.trim() || profileSeed.driverName?.trim() || null;
      const phoneNumber = storedRow?.phone_number?.trim() || profileSeed.phoneNumber?.trim() || null;

      return {
        user_id: userId,
        driver_name: driverName,
        phone_number: phoneNumber,
        unit_price: storedRow?.unit_price ?? null,
      } satisfies AdminDriverSettingsRow;
    })
    .sort((left, right) => {
      const leftName = left.driver_name || "";
      const rightName = right.driver_name || "";
      const nameComparison = leftName.localeCompare(rightName, "ko");

      if (nameComparison !== 0) {
        return nameComparison;
      }

      return left.user_id.localeCompare(right.user_id);
    });
}

function createErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return createErrorResponse("로그인이 필요합니다.", 401);
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!isDateKey(startDate) || !isDateKey(endDate)) {
    return createErrorResponse("조회 기간 형식이 올바르지 않습니다.", 400);
  }

  if (startDate > endDate) {
    return createErrorResponse("조회 시작일이 종료일보다 늦을 수 없습니다.", 400);
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

  if (!isAdminUser(user)) {
    return createErrorResponse("권한이 있는 계정만 관리자 페이지에 접근할 수 있습니다.", 403);
  }

  const configurationError = getSupabaseAdminConfigurationError();

  if (configurationError) {
    return createErrorResponse(configurationError, 500);
  }

  const adminClient = createSupabaseAdminClient();
  const [settingsResult, reportsResult, usersResult] = await Promise.all([
    adminClient
      .from("driver_settings")
      .select("user_id, driver_name, phone_number, unit_price")
      .order("driver_name", { ascending: true }),
    adminClient
      .from("daily_reports")
      .select("*")
      .gte("report_date", startDate)
      .lte("report_date", endDate)
      .order("report_date", { ascending: false }),
    loadAllAuthUsers(adminClient),
  ]);

  if (settingsResult.error || reportsResult.error || usersResult.error) {
    const rawMessage =
      settingsResult.error?.message ||
      reportsResult.error?.message ||
      usersResult.error?.message ||
      "관리자 데이터를 불러오지 못했습니다.";

    return createErrorResponse(
      getKoreanErrorMessage(rawMessage, "관리자 데이터를 불러오지 못했습니다."),
      500
    );
  }

  const driverSettingsRows = mergeDriverRows(
    (settingsResult.data as AdminDriverSettingsRow[]) ?? [],
    (reportsResult.data as DailyReportRow[]) ?? [],
    usersResult.data ?? []
  );

  const responseBody: AdminOverviewResponse = {
    driverSettingsRows,
    reports: (reportsResult.data as DailyReportRow[]) ?? [],
  };

  return NextResponse.json(responseBody);
}