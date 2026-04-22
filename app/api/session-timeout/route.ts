import { NextResponse } from "next/server";
import { isAdminUser } from "../../../lib/admin";
import {
  getSessionTimeoutValidationMessage,
  parseSessionTimeoutMinutes,
} from "../../../lib/sessionTimeoutConfig";
import {
  readSessionTimeoutSettings,
  writeSessionTimeoutSettings,
} from "../../../lib/sessionTimeoutSettings";
import { createSupabaseServerAuthClient } from "../../../lib/supabaseServer";
import { getKoreanErrorMessage } from "../../../lib/toast";

export const dynamic = "force-dynamic";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function loadAuthorizedUser(request: Request) {
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

  return {
    user,
    error: null,
  };
}

export async function GET(request: Request) {
  const { error } = await loadAuthorizedUser(request);

  if (error) {
    return error;
  }

  try {
    return NextResponse.json(await readSessionTimeoutSettings());
  } catch (readError) {
    return createErrorResponse(
      getKoreanErrorMessage(
        readError instanceof Error ? readError.message : undefined,
        "세션 타임아웃 설정을 불러오지 못했습니다."
      ),
      500
    );
  }
}

export async function PATCH(request: Request) {
  const { user, error } = await loadAuthorizedUser(request);

  if (error || !user) {
    return error;
  }

  if (!isAdminUser(user)) {
    return createErrorResponse("관리자 권한이 있는 계정만 세션 타임아웃 시간을 변경할 수 있습니다.", 403);
  }

  const body = await request.json().catch(() => null);
  const rawTimeoutMinutes = isRecord(body)
    ? body.timeoutMinutes ?? body.timeout_minutes ?? body.minutes
    : null;
  const validationMessage = getSessionTimeoutValidationMessage(rawTimeoutMinutes);

  if (validationMessage) {
    return createErrorResponse(validationMessage, 400);
  }

  const timeoutMinutes = parseSessionTimeoutMinutes(rawTimeoutMinutes);

  if (timeoutMinutes === null) {
    return createErrorResponse("세션 타임아웃 시간이 올바르지 않습니다.", 400);
  }

  try {
    return NextResponse.json(await writeSessionTimeoutSettings(timeoutMinutes));
  } catch (writeError) {
    return createErrorResponse(
      getKoreanErrorMessage(
        writeError instanceof Error ? writeError.message : undefined,
        "세션 타임아웃 설정을 저장하지 못했습니다."
      ),
      500
    );
  }
}