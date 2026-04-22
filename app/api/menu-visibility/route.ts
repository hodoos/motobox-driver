import { NextResponse } from "next/server";
import { isAdminUser } from "../../../lib/admin";
import {
  normalizeMenuVisibilityPatch,
} from "../../../lib/menuVisibility";
import {
  readMenuVisibilitySettings,
  writeMenuVisibilitySettings,
} from "../../../lib/menuVisibilitySettings";
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

export async function GET() {
  try {
    return NextResponse.json(await readMenuVisibilitySettings());
  } catch (readError) {
    return createErrorResponse(
      getKoreanErrorMessage(
        readError instanceof Error ? readError.message : undefined,
        "메뉴 표시 설정을 불러오지 못했습니다."
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
    return createErrorResponse("관리자 권한이 있는 계정만 메뉴 표시 설정을 변경할 수 있습니다.", 403);
  }

  const body = await request.json().catch(() => null);
  const nextSettings = normalizeMenuVisibilityPatch(
    typeof body === "object" && body !== null && "settings" in body
      ? (body as { settings?: unknown }).settings
      : body
  );

  if (Object.keys(nextSettings).length === 0) {
    return createErrorResponse("변경할 메뉴 표시 설정이 없습니다.", 400);
  }

  try {
    return NextResponse.json(await writeMenuVisibilitySettings(nextSettings));
  } catch (writeError) {
    return createErrorResponse(
      getKoreanErrorMessage(
        writeError instanceof Error ? writeError.message : undefined,
        "메뉴 표시 설정을 저장하지 못했습니다."
      ),
      500
    );
  }
}