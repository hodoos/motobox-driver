import { NextResponse } from "next/server";
import { canAccessCommunityBoard, getCommunityBoardDefinition } from "../../../../lib/communityBoards";
import {
  canUserAccessMenuItem,
  canUserWriteMenuItem,
} from "../../../../lib/menuVisibility";
import { readMenuVisibilitySettings } from "../../../../lib/menuVisibilitySettings";
import {
  createStoredCommunityPost,
  listCommunityPosts,
  normalizeCreateCommunityPostInput,
} from "../../../../lib/communityPostStorage";
import {
  createSupabaseAdminClient,
  createSupabaseServerAuthClient,
  getSupabaseAdminConfigurationError,
} from "../../../../lib/supabaseServer";
import { getKoreanErrorMessage } from "../../../../lib/toast";
import type { CommunityPostsResponse, CommunityPostMutationResponse } from "../../../../types";

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

export async function GET(request: Request) {
  const { user, error } = await getAuthorizedUser(request);

  if (error || !user) {
    return error;
  }

  const { searchParams } = new URL(request.url);
  const boardKey = searchParams.get("board")?.trim() || "";
  const board = getCommunityBoardDefinition(boardKey);

  if (!board) {
    return createErrorResponse("게시판 정보를 확인하지 못했습니다.", 400);
  }

  if (!canAccessCommunityBoard(board, user)) {
    return createErrorResponse("현재 계정은 이 게시판에 접근할 수 없습니다.", 403);
  }

  const { settings, error: settingsError } = await loadMenuVisibilitySettings();

  if (settingsError || !settings) {
    return settingsError;
  }

  if (!canUserAccessMenuItem(settings, board.key, user)) {
    return createErrorResponse("현재 계정은 이 게시판에 접근할 수 없습니다.", 403);
  }

  const adminClient = getOptionalAdminClient();
  const { posts, storage } = await listCommunityPosts(adminClient, board.key);

  const responseBody: CommunityPostsResponse = {
    board_key: board.key,
    posts,
    storage,
  };

  return NextResponse.json(responseBody);
}

export async function POST(request: Request) {
  const { user, error } = await getAuthorizedUser(request);

  if (error || !user) {
    return error;
  }

  const payload = normalizeCreateCommunityPostInput(await request.json().catch(() => null));

  if (!payload) {
    return createErrorResponse("게시글 제목과 내용을 다시 확인해주세요.", 400);
  }

  const board = getCommunityBoardDefinition(payload.boardKey);

  if (!board) {
    return createErrorResponse("게시판 정보를 확인하지 못했습니다.", 400);
  }

  if (!canAccessCommunityBoard(board, user)) {
    return createErrorResponse("현재 계정은 이 게시판에 글을 작성할 수 없습니다.", 403);
  }

  const { settings, error: settingsError } = await loadMenuVisibilitySettings();

  if (settingsError || !settings) {
    return settingsError;
  }

  if (!canUserWriteMenuItem(settings, board.key, user)) {
    return createErrorResponse("현재 계정은 이 게시판에 글을 작성할 수 없습니다.", 403);
  }

  const adminClient = getOptionalAdminClient();
  const { post, storage } = await createStoredCommunityPost(adminClient, user, payload);

  const responseBody: CommunityPostMutationResponse = {
    post,
    storage,
  };

  return NextResponse.json(responseBody, { status: 201 });
}