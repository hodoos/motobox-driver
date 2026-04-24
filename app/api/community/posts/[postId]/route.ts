import { NextResponse } from "next/server";
import { isAdminUser } from "../../../../../lib/admin";
import { canAccessCommunityBoard, getCommunityBoardDefinition } from "../../../../../lib/communityBoards";
import {
  canUserAccessMenuItem,
  canUserWriteMenuItem,
} from "../../../../../lib/menuVisibility";
import { readMenuVisibilitySettings } from "../../../../../lib/menuVisibilitySettings";
import {
  canManageCommunityPost,
  deleteStoredCommunityPost,
  getStoredCommunityPost,
  normalizeUpdateCommunityPostInput,
  updateStoredCommunityPost,
} from "../../../../../lib/communityPostStorage";
import {
  createSupabaseAdminClient,
  createSupabaseServerAuthClient,
  getSupabaseAdminConfigurationError,
} from "../../../../../lib/supabaseServer";
import { getKoreanErrorMessage } from "../../../../../lib/toast";
import type { CommunityPostMutationResponse } from "../../../../../types";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    postId: string;
  }>;
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

function getOptionalAdminClient() {
  return getSupabaseAdminConfigurationError() ? null : createSupabaseAdminClient();
}

async function loadMenuVisibilitySettings() {
  try {
    return {
      settings: (await readMenuVisibilitySettings()).settings,
      error: null,
    };
  } catch (readError) {
    return {
      settings: null,
      error: createErrorResponse(
        getKoreanErrorMessage(
          readError instanceof Error ? readError.message : undefined,
          "메뉴 접근 설정을 불러오지 못했습니다."
        ),
        500
      ),
    };
  }
}

async function getAuthorizedUser(request: Request) {
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

export async function PATCH(request: Request, context: RouteContext) {
  const { user, error } = await getAuthorizedUser(request);

  if (error || !user) {
    return error;
  }

  const payload = normalizeUpdateCommunityPostInput(await request.json().catch(() => null));

  if (!payload) {
    return createErrorResponse("게시글 제목과 내용을 다시 확인해주세요.", 400);
  }

  const { postId } = await context.params;
  const adminClient = getOptionalAdminClient();
  const storedPostResult = await getStoredCommunityPost(adminClient, postId);

  if (!storedPostResult.post || !storedPostResult.storage) {
    return createErrorResponse("게시글을 찾지 못했습니다.", 404);
  }

  const board = getCommunityBoardDefinition(storedPostResult.post.board_key);

  if (!board || !canAccessCommunityBoard(board, user)) {
    return createErrorResponse("현재 계정은 이 게시판에 접근할 수 없습니다.", 403);
  }

  const { settings, error: settingsError } = await loadMenuVisibilitySettings();

  if (settingsError || !settings) {
    return settingsError;
  }

  if (!canUserAccessMenuItem(settings, board.key, user)) {
    return createErrorResponse("현재 계정은 이 게시판에 접근할 수 없습니다.", 403);
  }

  if (!isAdminUser(user) && !canUserWriteMenuItem(settings, board.key, user)) {
    return createErrorResponse("현재 계정은 이 게시판의 게시글을 수정할 수 없습니다.", 403);
  }

  if (!canManageCommunityPost(user, storedPostResult.post)) {
    return createErrorResponse("작성자 또는 관리자만 게시글을 수정할 수 있습니다.", 403);
  }

  const { post, storage } = await updateStoredCommunityPost(
    adminClient,
    storedPostResult.post,
    storedPostResult.storage,
    payload
  );

  const responseBody: CommunityPostMutationResponse = {
    post,
    storage,
  };

  return NextResponse.json(responseBody);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { user, error } = await getAuthorizedUser(request);

  if (error || !user) {
    return error;
  }

  const { postId } = await context.params;
  const adminClient = getOptionalAdminClient();
  const storedPostResult = await getStoredCommunityPost(adminClient, postId);

  if (!storedPostResult.post || !storedPostResult.storage) {
    return createErrorResponse("게시글을 찾지 못했습니다.", 404);
  }

  const board = getCommunityBoardDefinition(storedPostResult.post.board_key);

  if (!board || !canAccessCommunityBoard(board, user)) {
    return createErrorResponse("현재 계정은 이 게시판에 접근할 수 없습니다.", 403);
  }

  const { settings, error: settingsError } = await loadMenuVisibilitySettings();

  if (settingsError || !settings) {
    return settingsError;
  }

  if (!canUserAccessMenuItem(settings, board.key, user)) {
    return createErrorResponse("현재 계정은 이 게시판에 접근할 수 없습니다.", 403);
  }

  if (!isAdminUser(user) && !canUserWriteMenuItem(settings, board.key, user)) {
    return createErrorResponse("현재 계정은 이 게시판의 게시글을 삭제할 수 없습니다.", 403);
  }

  if (!canManageCommunityPost(user, storedPostResult.post)) {
    return createErrorResponse("작성자 또는 관리자만 게시글을 삭제할 수 있습니다.", 403);
  }

  const result = await deleteStoredCommunityPost(
    adminClient,
    storedPostResult.post,
    storedPostResult.storage
  );

  return NextResponse.json(result);
}