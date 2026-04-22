import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type {
  CommunityPostRow,
  CommunityPostStorageMode,
} from "../types";
import { isAdminUser } from "./admin";
import {
  getCommunityBoardDefinition,
  type CommunityBoardKey,
} from "./communityBoards";
import { extractDriverProfileSeed } from "./driverSettings";
import { getUserLevel } from "./userLevel";

const COMMUNITY_POSTS_DIRECTORY = path.join(process.cwd(), "logs");
const COMMUNITY_POSTS_FILE_PATH = path.join(COMMUNITY_POSTS_DIRECTORY, "community-posts.json");
const COMMUNITY_POST_COLUMNS =
  "id, board_key, title, body, author_user_id, author_email, author_name, author_level, created_at, updated_at";

export type CreateCommunityPostInput = {
  boardKey: CommunityBoardKey;
  title: string;
  body: string;
};

export type UpdateCommunityPostInput = {
  title: string;
  body: string;
};

type MutableActor = Pick<User, "id" | "email" | "app_metadata" | "user_metadata">;

type StoredCommunityPostResult = {
  post: CommunityPostRow | null;
  storage: Exclude<CommunityPostStorageMode, "mixed"> | null;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCommunityBoardKey(value: string): value is CommunityBoardKey {
  return Boolean(getCommunityBoardDefinition(value));
}

function normalizeBoardKey(value: unknown): CommunityBoardKey | null {
  const boardKey = normalizeText(value);
  return isCommunityBoardKey(boardKey) ? boardKey : null;
}

function normalizeTitle(value: unknown) {
  const title = normalizeText(value);

  if (!title || title.length > 120) {
    return null;
  }

  return title;
}

function normalizeBody(value: unknown) {
  const body = typeof value === "string" ? value.trim() : "";

  if (!body || body.length > 5000) {
    return null;
  }

  return body;
}

function normalizeOptionalText(value: unknown) {
  const text = normalizeText(value);
  return text || null;
}

function normalizeIsoDate(value: unknown) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeCommunityPostRow(value: unknown): CommunityPostRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeText(value.id);
  const boardKey = normalizeBoardKey(value.board_key);
  const title = normalizeTitle(value.title);
  const body = normalizeBody(value.body);
  const authorUserId = normalizeText(value.author_user_id);
  const authorLevel = normalizeText(value.author_level);
  const createdAt = normalizeIsoDate(value.created_at);
  const updatedAt = normalizeIsoDate(value.updated_at);

  if (!id || !boardKey || !title || !body || !authorUserId || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    board_key: boardKey,
    title,
    body,
    author_user_id: authorUserId,
    author_email: normalizeOptionalText(value.author_email),
    author_name: normalizeOptionalText(value.author_name),
    author_level: authorLevel as CommunityPostRow["author_level"],
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function sortCommunityPosts(posts: CommunityPostRow[]) {
  return [...posts].sort((left, right) => {
    const updatedAtDelta =
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();

    if (updatedAtDelta !== 0) {
      return updatedAtDelta;
    }

    return right.id.localeCompare(left.id);
  });
}

function dedupeCommunityPosts(posts: CommunityPostRow[]) {
  const postMap = new Map<string, CommunityPostRow>();

  posts.forEach((post) => {
    postMap.set(post.id, post);
  });

  return sortCommunityPosts(Array.from(postMap.values()));
}

function updateLatestCommunityPostMap(
  latestCommunityPostMap: Map<string, string>,
  userId: unknown,
  updatedAt: unknown
) {
  const normalizedUserId = normalizeText(userId);
  const normalizedUpdatedAt = normalizeIsoDate(updatedAt);

  if (!normalizedUserId || !normalizedUpdatedAt) {
    return;
  }

  const currentUpdatedAt = latestCommunityPostMap.get(normalizedUserId);

  if (
    !currentUpdatedAt ||
    new Date(normalizedUpdatedAt).getTime() > new Date(currentUpdatedAt).getTime()
  ) {
    latestCommunityPostMap.set(normalizedUserId, normalizedUpdatedAt);
  }
}

function createCommunityPostRecord(
  actor: MutableActor,
  input: CreateCommunityPostInput
): CommunityPostRow {
  const profileSeed = extractDriverProfileSeed(actor);
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    board_key: input.boardKey,
    title: input.title,
    body: input.body,
    author_user_id: actor.id,
    author_email: normalizeOptionalText(actor.email),
    author_name: normalizeOptionalText(profileSeed.driverName),
    author_level: getUserLevel(actor),
    created_at: now,
    updated_at: now,
  };
}

async function readCommunityPostFile() {
  try {
    const raw = await readFile(COMMUNITY_POSTS_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [] as CommunityPostRow[];
    }

    return parsed
      .map((value) => normalizeCommunityPostRow(value))
      .filter((value): value is CommunityPostRow => Boolean(value));
  } catch {
    return [] as CommunityPostRow[];
  }
}

async function writeCommunityPostFile(posts: CommunityPostRow[]) {
  await mkdir(COMMUNITY_POSTS_DIRECTORY, { recursive: true });
  await writeFile(COMMUNITY_POSTS_FILE_PATH, JSON.stringify(posts, null, 2), "utf8");
}

export async function getLatestCommunityPostUpdateMap(adminClient: SupabaseClient | null) {
  const latestCommunityPostMap = new Map<string, string>();

  if (adminClient) {
    const { data } = await adminClient
      .from("community_posts")
      .select("author_user_id, updated_at")
      .order("updated_at", { ascending: false });

    if (Array.isArray(data)) {
      data.forEach((value) => {
        if (!isRecord(value)) {
          return;
        }

        updateLatestCommunityPostMap(
          latestCommunityPostMap,
          value.author_user_id,
          value.updated_at
        );
      });
    }
  }

  const filePosts = await readCommunityPostFile();
  filePosts.forEach((post) => {
    updateLatestCommunityPostMap(
      latestCommunityPostMap,
      post.author_user_id,
      post.updated_at
    );
  });

  return latestCommunityPostMap;
}

async function listCommunityPostsFromDatabase(
  adminClient: SupabaseClient | null,
  boardKey: CommunityBoardKey
) {
  if (!adminClient) {
    return {
      posts: [] as CommunityPostRow[],
      available: false,
    };
  }

  const { data, error } = await adminClient
    .from("community_posts")
    .select(COMMUNITY_POST_COLUMNS)
    .eq("board_key", boardKey)
    .order("updated_at", { ascending: false });

  if (error || !Array.isArray(data)) {
    return {
      posts: [] as CommunityPostRow[],
      available: false,
    };
  }

  return {
    posts: data
      .map((value) => normalizeCommunityPostRow(value))
      .filter((value): value is CommunityPostRow => Boolean(value)),
    available: true,
  };
}

async function getCommunityPostFromDatabase(
  adminClient: SupabaseClient | null,
  postId: string
): Promise<StoredCommunityPostResult> {
  if (!adminClient) {
    return { post: null, storage: null };
  }

  const { data, error } = await adminClient
    .from("community_posts")
    .select(COMMUNITY_POST_COLUMNS)
    .eq("id", postId)
    .maybeSingle();

  if (error || !data) {
    return {
      post: null,
      storage: null,
    };
  }

  return {
    post: normalizeCommunityPostRow(data),
    storage: "database",
  };
}

export function normalizeCreateCommunityPostInput(value: unknown): CreateCommunityPostInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const boardKey = normalizeBoardKey(value.board_key);
  const title = normalizeTitle(value.title);
  const body = normalizeBody(value.body);

  if (!boardKey || !title || !body) {
    return null;
  }

  return {
    boardKey,
    title,
    body,
  };
}

export function normalizeUpdateCommunityPostInput(value: unknown): UpdateCommunityPostInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const title = normalizeTitle(value.title);
  const body = normalizeBody(value.body);

  if (!title || !body) {
    return null;
  }

  return {
    title,
    body,
  };
}

export function canManageCommunityPost(
  actor: Pick<User, "id" | "app_metadata" | "user_metadata"> | null | undefined,
  post: Pick<CommunityPostRow, "author_user_id">
) {
  if (!actor) {
    return false;
  }

  return actor.id === post.author_user_id || isAdminUser(actor);
}

export async function listCommunityPosts(
  adminClient: SupabaseClient | null,
  boardKey: CommunityBoardKey
) {
  const databaseResult = await listCommunityPostsFromDatabase(adminClient, boardKey);
  const filePosts = (await readCommunityPostFile()).filter((post) => post.board_key === boardKey);
  const posts = dedupeCommunityPosts([...databaseResult.posts, ...filePosts]);

  return {
    posts,
    storage: databaseResult.available
      ? (filePosts.length > 0 ? "mixed" : "database")
      : "file-fallback",
  } satisfies {
    posts: CommunityPostRow[];
    storage: CommunityPostStorageMode;
  };
}

export async function getStoredCommunityPost(
  adminClient: SupabaseClient | null,
  postId: string
): Promise<StoredCommunityPostResult> {
  const normalizedPostId = normalizeText(postId);

  if (!normalizedPostId) {
    return {
      post: null,
      storage: null,
    };
  }

  const databaseResult = await getCommunityPostFromDatabase(adminClient, normalizedPostId);

  if (databaseResult.post) {
    return databaseResult;
  }

  const filePosts = await readCommunityPostFile();
  const filePost = filePosts.find((post) => post.id === normalizedPostId) ?? null;

  return {
    post: filePost,
    storage: filePost ? "file-fallback" : null,
  };
}

export async function createStoredCommunityPost(
  adminClient: SupabaseClient | null,
  actor: MutableActor,
  input: CreateCommunityPostInput
) {
  const nextPost = createCommunityPostRecord(actor, input);

  if (adminClient) {
    const { data, error } = await adminClient
      .from("community_posts")
      .insert(nextPost)
      .select(COMMUNITY_POST_COLUMNS)
      .single();

    if (!error && data) {
      const normalizedRow = normalizeCommunityPostRow(data);

      if (normalizedRow) {
        return {
          post: normalizedRow,
          storage: "database",
        } as const;
      }
    }
  }

  const storedPosts = await readCommunityPostFile();
  storedPosts.unshift(nextPost);
  await writeCommunityPostFile(sortCommunityPosts(storedPosts));

  return {
    post: nextPost,
    storage: "file-fallback",
  } as const;
}

export async function updateStoredCommunityPost(
  adminClient: SupabaseClient | null,
  existingPost: CommunityPostRow,
  storage: Exclude<CommunityPostStorageMode, "mixed">,
  input: UpdateCommunityPostInput
) {
  const nextUpdatedAt = new Date().toISOString();

  if (storage === "database" && adminClient) {
    const { data, error } = await adminClient
      .from("community_posts")
      .update({
        title: input.title,
        body: input.body,
        updated_at: nextUpdatedAt,
      })
      .eq("id", existingPost.id)
      .select(COMMUNITY_POST_COLUMNS)
      .single();

    if (error) {
      throw new Error(error.message || "게시글을 수정하지 못했습니다.");
    }

    const normalizedRow = normalizeCommunityPostRow(data);

    if (!normalizedRow) {
      throw new Error("게시글 수정 결과를 확인하지 못했습니다.");
    }

    return {
      post: normalizedRow,
      storage: "database",
    } as const;
  }

  const storedPosts = await readCommunityPostFile();
  const nextPosts = storedPosts.map((post) =>
    post.id === existingPost.id
      ? {
          ...post,
          title: input.title,
          body: input.body,
          updated_at: nextUpdatedAt,
        }
      : post
  );
  const nextPost = nextPosts.find((post) => post.id === existingPost.id) ?? null;

  if (!nextPost) {
    throw new Error("수정할 게시글을 찾지 못했습니다.");
  }

  await writeCommunityPostFile(sortCommunityPosts(nextPosts));

  return {
    post: nextPost,
    storage: "file-fallback",
  } as const;
}

export async function deleteStoredCommunityPost(
  adminClient: SupabaseClient | null,
  existingPost: CommunityPostRow,
  storage: Exclude<CommunityPostStorageMode, "mixed">
) {
  if (storage === "database" && adminClient) {
    const { error } = await adminClient.from("community_posts").delete().eq("id", existingPost.id);

    if (error) {
      throw new Error(error.message || "게시글을 삭제하지 못했습니다.");
    }

    return {
      deleted: true,
      storage: "database",
    } as const;
  }

  const storedPosts = await readCommunityPostFile();
  const nextPosts = storedPosts.filter((post) => post.id !== existingPost.id);

  if (nextPosts.length === storedPosts.length) {
    throw new Error("삭제할 게시글을 찾지 못했습니다.");
  }

  await writeCommunityPostFile(nextPosts);

  return {
    deleted: true,
    storage: "file-fallback",
  } as const;
}