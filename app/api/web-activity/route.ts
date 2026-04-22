import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseServerAuthClient,
  getSupabaseAdminConfigurationError,
} from "../../../lib/supabaseServer";
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

export async function POST(request: Request) {
  const { user, error } = await loadAuthorizedUser(request);

  if (error || !user) {
    return error;
  }

  const configurationError = getSupabaseAdminConfigurationError();

  if (configurationError) {
    return NextResponse.json({ tracked: false, error: configurationError }, { status: 202 });
  }

  const adminClient = createSupabaseAdminClient();
  const trackedAt = new Date().toISOString();
  const { data: updatedUser, error: updateUserError } = await adminClient.auth.admin.updateUserById(
    user.id,
    {
      user_metadata: {
        ...(user.user_metadata ?? {}),
        last_web_activity_at: trackedAt,
      },
    }
  );

  if (updateUserError || !updatedUser.user) {
    return createErrorResponse(
      getKoreanErrorMessage(
        updateUserError?.message,
        "사용자 활동 시간을 저장하지 못했습니다."
      ),
      500
    );
  }

  return NextResponse.json({ tracked: true, trackedAt });
}