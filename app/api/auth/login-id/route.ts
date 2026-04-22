import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  extractUserProfileSeed,
  getLoginIdValidationMessage,
  isSupportedLoginId,
  normalizeLoginId,
} from "../../../../lib/loginId";
import {
  createSupabaseAdminClient,
  createSupabaseServerAuthClient,
  getSupabaseAdminConfigurationError,
} from "../../../../lib/supabaseServer";
import { getKoreanErrorMessage } from "../../../../lib/toast";

export const dynamic = "force-dynamic";

function createErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAccessToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorization.slice(7).trim() || null;
}

async function findAuthUser(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  predicate: (user: User) => boolean
) {
  let page: number | null = 1;

  while (page) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      return { user: null, error };
    }

    const matchedUser = (data.users ?? []).find(predicate) ?? null;

    if (matchedUser) {
      return { user: matchedUser, error: null };
    }

    page = data.nextPage ?? null;
  }

  return { user: null, error: null };
}

async function findAuthUserByLoginId(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  loginId: string
) {
  return findAuthUser(
    adminClient,
    (user) => extractUserProfileSeed(user).loginId === loginId
  );
}

async function findAuthUserByEmail(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  email: string
) {
  const normalizedEmail = normalizeText(email).toLowerCase();

  return findAuthUser(
    adminClient,
    (user) => normalizeText(user.email).toLowerCase() === normalizedEmail
  );
}

function getAdminClient() {
  const configurationError = getSupabaseAdminConfigurationError();

  if (configurationError) {
    return {
      adminClient: null,
      error: createErrorResponse(configurationError, 500),
    };
  }

  return {
    adminClient: createSupabaseAdminClient(),
    error: null,
  };
}

export async function GET(request: Request) {
  const { adminClient, error } = getAdminClient();

  if (error || !adminClient) {
    return error;
  }

  const { searchParams } = new URL(request.url);
  const loginId = normalizeLoginId(searchParams.get("value"));
  const validationMessage = getLoginIdValidationMessage(loginId);

  if (validationMessage) {
    return createErrorResponse(validationMessage, 400);
  }

  const { user, error: lookupError } = await findAuthUserByLoginId(adminClient, loginId);

  if (lookupError) {
    return createErrorResponse(
      getKoreanErrorMessage(lookupError.message, "ID 중복 여부를 확인하지 못했습니다."),
      500
    );
  }

  return NextResponse.json({
    available: !user,
    normalizedLoginId: loginId,
  });
}

export async function POST(request: Request) {
  const { adminClient, error } = getAdminClient();

  if (error || !adminClient) {
    return error;
  }

  const body = await request.json().catch(() => null);
  const identifier = normalizeText(isRecord(body) ? body.identifier : "");

  if (!identifier) {
    return createErrorResponse("ID를 입력해주세요.", 400);
  }

  if (identifier.includes("@")) {
    const { user, error: lookupError } = await findAuthUserByEmail(adminClient, identifier);

    if (lookupError) {
      return createErrorResponse(
        getKoreanErrorMessage(lookupError.message, "로그인 정보를 확인하지 못했습니다."),
        500
      );
    }

    if (!user || !user.email) {
      return createErrorResponse("로그인 정보를 다시 확인해주세요.", 401);
    }

    if (extractUserProfileSeed(user).loginId) {
      return createErrorResponse("ID가 설정된 계정은 ID로 로그인해주세요.", 409);
    }

    return NextResponse.json({
      email: user.email,
      loginMode: "legacy-email",
    });
  }

  const normalizedLoginId = normalizeLoginId(identifier);
  if (!isSupportedLoginId(normalizedLoginId)) {
    return createErrorResponse("로그인 정보를 다시 확인해주세요.", 400);
  }

  const { user, error: lookupError } = await findAuthUserByLoginId(
    adminClient,
    normalizedLoginId
  );

  if (lookupError) {
    return createErrorResponse(
      getKoreanErrorMessage(lookupError.message, "로그인 정보를 확인하지 못했습니다."),
      500
    );
  }

  if (!user || !user.email) {
    return createErrorResponse("로그인 정보를 다시 확인해주세요.", 401);
  }

  return NextResponse.json({
    email: user.email,
    loginMode: "login-id",
    normalizedLoginId,
  });
}

export async function PATCH(request: Request) {
  const { adminClient, error } = getAdminClient();

  if (error || !adminClient) {
    return error;
  }

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

  const body = await request.json().catch(() => null);
  const loginId = normalizeLoginId(
    isRecord(body) ? (body.loginId ?? body.login_id) : ""
  );
  const currentLoginId = extractUserProfileSeed(user).loginId;

  if (currentLoginId) {
    if (currentLoginId === loginId) {
      return NextResponse.json({
        loginId: currentLoginId,
        userId: user.id,
      });
    }

    return createErrorResponse("한번 설정한 ID는 변경할 수 없습니다.", 409);
  }

  const validationMessage = getLoginIdValidationMessage(loginId);

  if (validationMessage) {
    return createErrorResponse(validationMessage, 400);
  }

  const { user: existingUser, error: lookupError } = await findAuthUserByLoginId(
    adminClient,
    loginId
  );

  if (lookupError) {
    return createErrorResponse(
      getKoreanErrorMessage(lookupError.message, "ID 중복 여부를 확인하지 못했습니다."),
      500
    );
  }

  if (existingUser && existingUser.id !== user.id) {
    return createErrorResponse("이미 사용 중인 ID입니다.", 409);
  }

  const { data, error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...user.user_metadata,
      login_id: loginId,
    },
  });

  if (updateError) {
    return createErrorResponse(
      getKoreanErrorMessage(updateError.message, "ID를 저장하지 못했습니다."),
      500
    );
  }

  return NextResponse.json({
    loginId,
    userId: data.user?.id ?? user.id,
  });
}