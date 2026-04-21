"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell, { PageLoadingShell } from "../layout/PageShell";
import ToastViewport from "../ui/ToastViewport";
import { isAdminUser } from "../../lib/admin";
import {
  canAccessCommunityBoard,
  getCommunityBoardAccessScopeLabel,
  getCommunityBoardDefinition,
  type CommunityBoardKey,
} from "../../lib/communityBoards";
import { extractDriverProfileSeed } from "../../lib/driverSettings";
import { supabase } from "../../lib/supabase";
import {
  createToastState,
  getKoreanErrorMessage,
  queuePendingToast,
  type ToastState,
} from "../../lib/toast";
import { getUserLevel } from "../../lib/userLevel";
import type {
  CommunityPostMutationResponse,
  CommunityPostRow,
  CommunityPostsResponse,
  CommunityPostStorageMode,
  UserType,
} from "../../types";

type CommunityBoardPageProps = {
  boardKey: CommunityBoardKey;
};

type EditorMode = "create" | "edit" | null;

type PostFormState = {
  title: string;
  body: string;
};

const EMPTY_POST_FORM: PostFormState = {
  title: "",
  body: "",
};

type BoardPostsRequestResult = {
  response: Response;
  responseBody: CommunityPostsResponse | { error?: string } | null;
};

function formatPostTimestamp(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStorageLabel(storage: CommunityPostStorageMode | null) {
  if (storage === "database") {
    return "DB 저장";
  }

  if (storage === "mixed") {
    return "DB + 로컬 저장";
  }

  if (storage === "file-fallback") {
    return "로컬 저장";
  }

  return "불러오는 중";
}

function getResponseErrorMessage(responseBody: unknown) {
  if (
    responseBody &&
    typeof responseBody === "object" &&
    "error" in responseBody &&
    typeof responseBody.error === "string"
  ) {
    return responseBody.error;
  }

  return undefined;
}

function isCommunityPostsResponse(responseBody: unknown): responseBody is CommunityPostsResponse {
  return Boolean(
    responseBody &&
      typeof responseBody === "object" &&
      "posts" in responseBody &&
      Array.isArray(responseBody.posts) &&
      "storage" in responseBody
  );
}

function isCommunityPostMutationResponse(
  responseBody: unknown
): responseBody is CommunityPostMutationResponse {
  return Boolean(
    responseBody &&
      typeof responseBody === "object" &&
      "post" in responseBody &&
      responseBody.post &&
      typeof responseBody.post === "object" &&
      "id" in responseBody.post &&
      typeof responseBody.post.id === "string"
  );
}

async function getSupabaseAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

async function requestBoardPosts(
  boardKey: CommunityBoardKey,
  accessToken: string
): Promise<BoardPostsRequestResult> {
  const response = await fetch(`/api/community/posts?board=${boardKey}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  const responseBody = (await response.json().catch(() => null)) as
    | CommunityPostsResponse
    | { error?: string }
    | null;

  return {
    response,
    responseBody,
  };
}

export default function CommunityBoardPage({ boardKey }: CommunityBoardPageProps) {
  const router = useRouter();
  const board = getCommunityBoardDefinition(boardKey);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [viewer, setViewer] = useState<UserType | null>(null);
  const [userLevel, setUserLevel] = useState("");
  const [accessScope, setAccessScope] = useState("");
  const [posts, setPosts] = useState<CommunityPostRow[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [formState, setFormState] = useState<PostFormState>(EMPTY_POST_FORM);
  const [keyword, setKeyword] = useState("");
  const [storage, setStorage] = useState<CommunityPostStorageMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null;
  const filteredPosts = posts.filter((post) => {
    const searchTarget = [
      post.title,
      post.body,
      post.author_name,
      post.author_email,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchTarget.includes(keyword.trim().toLowerCase());
  });
  const canManageSelectedPost =
    Boolean(selectedPost && authUser) &&
    (selectedPost?.author_user_id === authUser?.id || isAdminUser(authUser));

  const showToast = (tone: ToastState["tone"], title: string, message?: string) => {
    setToast(createToastState({ tone, title, message }));
  };

  const applyPosts = (nextPosts: CommunityPostRow[], preferredPostId?: string | null) => {
    setPosts(nextPosts);
    setSelectedPostId((current) => {
      if (preferredPostId && nextPosts.some((post) => post.id === preferredPostId)) {
        return preferredPostId;
      }

      if (current && nextPosts.some((post) => post.id === current)) {
        return current;
      }

      return nextPosts[0]?.id ?? null;
    });
  };

  const loadPosts = async (preferredPostId?: string | null) => {
    if (!board) {
      return;
    }

    const accessToken = await getSupabaseAccessToken();

    if (!accessToken) {
      queuePendingToast({
        tone: "error",
        title: "로그인이 필요합니다",
        message: "게시판을 사용하려면 다시 로그인해주세요.",
      });
      router.replace("/");
      return;
    }

    const { response, responseBody } = await requestBoardPosts(board.key, accessToken);
  const postsResponse = isCommunityPostsResponse(responseBody) ? responseBody : null;

    if (!response.ok) {
      showToast(
        "error",
        "게시글을 불러오지 못했습니다",
        getKoreanErrorMessage(
          getResponseErrorMessage(responseBody),
          "게시글을 불러오지 못했습니다."
        )
      );
      return;
    }

    applyPosts(postsResponse?.posts ?? [], preferredPostId);
    setStorage(postsResponse?.storage ?? null);
  };

  useEffect(() => {
    let isDisposed = false;

    const init = async () => {
      if (!board) {
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;

      if (!currentUser) {
        queuePendingToast({
          tone: "error",
          title: "로그인이 필요합니다",
          message: `${board.title}은 로그인한 계정만 사용할 수 있습니다.`,
        });
        router.replace("/");
        return;
      }

      if (!canAccessCommunityBoard(board, currentUser)) {
        queuePendingToast({
          tone: "error",
          title: "게시판 권한이 없습니다",
          message: `${board.title} 접근 권한을 다시 확인해주세요.`,
        });
        router.replace("/dashboard");
        return;
      }

      const profileSeed = extractDriverProfileSeed(currentUser);

      if (!isDisposed) {
        setAuthUser(currentUser);
        setViewer({
          id: currentUser.id,
          email: currentUser.email,
          driver_name: profileSeed.driverName,
          phone_number: profileSeed.phoneNumber,
        });
        setUserLevel(getUserLevel(currentUser));
        setAccessScope(getCommunityBoardAccessScopeLabel(board, currentUser));
      }

      const accessToken = await getSupabaseAccessToken();

      if (!accessToken) {
        queuePendingToast({
          tone: "error",
          title: "로그인이 필요합니다",
          message: `${board.title}은 로그인한 계정만 사용할 수 있습니다.`,
        });
        router.replace("/");
        return;
      }

      const { response, responseBody } = await requestBoardPosts(board.key, accessToken);
      const postsResponse = isCommunityPostsResponse(responseBody) ? responseBody : null;

      if (response.ok) {
        if (!isDisposed) {
          applyPosts(postsResponse?.posts ?? []);
          setStorage(postsResponse?.storage ?? null);
        }
      } else if (!isDisposed) {
        showToast(
          "error",
          "게시글을 불러오지 못했습니다",
          getKoreanErrorMessage(
            getResponseErrorMessage(responseBody),
            "게시글을 불러오지 못했습니다."
          )
        );
      }

      if (!isDisposed) {
        setLoading(false);
      }
    };

    void init();

    return () => {
      isDisposed = true;
    };
  }, [board, router]);

  if (!board) {
    return <PageLoadingShell message="게시판 정보를 확인 중..." />;
  }

  if (loading) {
    return <PageLoadingShell message={`${board.title} 불러오는 중...`} />;
  }

  const handleCreateStart = () => {
    setEditorMode("create");
    setFormState(EMPTY_POST_FORM);
  };

  const handleEditStart = () => {
    if (!selectedPost) {
      return;
    }

    setEditorMode("edit");
    setFormState({
      title: selectedPost.title,
      body: selectedPost.body,
    });
  };

  const handleEditorCancel = () => {
    setEditorMode(null);
    setFormState(EMPTY_POST_FORM);
  };

  const handleSubmit = async () => {
    if (!board) {
      return;
    }

    if (!formState.title.trim() || !formState.body.trim()) {
      showToast("error", "입력값 확인", "제목과 내용을 모두 입력해주세요.");
      return;
    }

    const accessToken = await getSupabaseAccessToken();

    if (!accessToken) {
      queuePendingToast({
        tone: "error",
        title: "세션이 만료되었습니다",
        message: "다시 로그인한 뒤 게시글을 저장해주세요.",
      });
      router.replace("/");
      return;
    }

    setSubmitting(true);

    const isEditMode = editorMode === "edit" && Boolean(selectedPost);
    const endpoint = isEditMode ? `/api/community/posts/${selectedPost?.id}` : "/api/community/posts";
    const method = isEditMode ? "PATCH" : "POST";
    const body = isEditMode
      ? {
          title: formState.title,
          body: formState.body,
        }
      : {
          board_key: board.key,
          title: formState.title,
          body: formState.body,
        };

    const response = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const responseBody = (await response.json().catch(() => null)) as
      | CommunityPostMutationResponse
      | { error?: string }
      | null;
    const mutationResponse = isCommunityPostMutationResponse(responseBody)
      ? responseBody
      : null;

    setSubmitting(false);

    if (!response.ok) {
      showToast(
        "error",
        isEditMode ? "게시글 수정 실패" : "게시글 등록 실패",
        getKoreanErrorMessage(
          getResponseErrorMessage(responseBody),
          "게시글 저장 중 문제가 발생했습니다."
        )
      );
      return;
    }

    setEditorMode(null);
    setFormState(EMPTY_POST_FORM);
    await loadPosts(mutationResponse?.post.id ?? null);
    showToast(
      "success",
      isEditMode ? "게시글을 수정했습니다" : "게시글을 등록했습니다"
    );
  };

  const handleDelete = async () => {
    if (!selectedPost) {
      return;
    }

    if (typeof window !== "undefined") {
      const confirmed = window.confirm("선택한 게시글을 삭제할까요?");

      if (!confirmed) {
        return;
      }
    }

    const accessToken = await getSupabaseAccessToken();

    if (!accessToken) {
      queuePendingToast({
        tone: "error",
        title: "세션이 만료되었습니다",
        message: "다시 로그인한 뒤 게시글을 삭제해주세요.",
      });
      router.replace("/");
      return;
    }

    setDeleting(true);

    const response = await fetch(`/api/community/posts/${selectedPost.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const responseBody = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    setDeleting(false);

    if (!response.ok) {
      showToast(
        "error",
        "게시글 삭제 실패",
        getKoreanErrorMessage(
          getResponseErrorMessage(responseBody),
          "게시글을 삭제하지 못했습니다."
        )
      );
      return;
    }

    setEditorMode(null);
    setFormState(EMPTY_POST_FORM);
    await loadPosts();
    showToast("success", "게시글을 삭제했습니다");
  };

  return (
    <PageShell contentClassName="flex w-full max-w-[34rem] flex-col gap-4 sm:max-w-3xl xl:max-w-6xl">
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} />

      <section className="retro-panel rounded-[24px] px-4 py-5 sm:rounded-[28px] sm:px-6 sm:py-6">
        <div className="space-y-3">
          <div>
            <p className="theme-kicker text-[11px] sm:text-xs">{board.heroKicker}</p>
            <h1 className="retro-title theme-heading mt-2 text-lg sm:text-xl">{board.title}</h1>
            <p className="theme-copy mt-3 text-sm leading-relaxed">{board.description}</p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
            <span className="theme-chip-subtle px-3 py-1.5">현재 등급: {userLevel}</span>
            <span className="theme-chip-subtle px-3 py-1.5">접근 기준: {accessScope}</span>
            <span className="theme-chip-subtle px-3 py-1.5">
              사용자: {viewer?.driver_name || viewer?.email || "사용자"}
            </span>
            <span className="theme-chip-subtle px-3 py-1.5">저장 방식: {getStorageLabel(storage)}</span>
          </div>
        </div>
      </section>

      <section className="retro-panel rounded-[24px] px-4 py-5 sm:rounded-[28px] sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="theme-kicker text-[11px] sm:text-xs">BOARD POSTS</p>
            <h2 className="retro-title theme-heading mt-2 text-lg sm:text-xl">
              게시글 목록
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="제목, 내용, 작성자 검색"
              className="w-full min-w-[14rem] px-4 py-3 text-sm sm:text-base"
            />
            <button
              type="button"
              onClick={handleCreateStart}
              className="retro-button-solid min-h-[44px] px-4 py-2 text-sm font-semibold"
            >
              새 글 작성
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.95fr)]">
          <div className="overflow-hidden rounded-[22px] border border-[var(--border)] bg-[rgba(8,8,10,0.86)]">
            <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[rgba(255,255,255,0.09)] text-[var(--text-strong)]">
                    <th className="border-b border-r border-[var(--border)] px-4 py-3 text-left font-semibold whitespace-nowrap">
                      No.
                    </th>
                    <th className="border-b border-r border-[var(--border)] px-4 py-3 text-left font-semibold whitespace-nowrap">
                      제목
                    </th>
                    <th className="border-b border-r border-[var(--border)] px-4 py-3 text-left font-semibold whitespace-nowrap">
                      작성자
                    </th>
                    <th className="border-b border-r border-[var(--border)] px-4 py-3 text-left font-semibold whitespace-nowrap">
                      등급
                    </th>
                    <th className="border-b border-[var(--border)] px-4 py-3 text-left font-semibold whitespace-nowrap">
                      최근 수정
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPosts.length > 0 ? (
                    filteredPosts.map((post, index) => {
                      const active = selectedPostId === post.id;

                      return (
                        <tr
                          key={post.id}
                          className={
                            active
                              ? "bg-[rgba(255,255,255,0.11)]"
                              : index % 2 === 0
                                ? "bg-[rgba(255,255,255,0.02)]"
                                : "bg-[rgba(255,255,255,0.05)]"
                          }
                        >
                          <td className="border-b border-r border-[var(--border)] px-4 py-3 align-top whitespace-nowrap text-[var(--text-muted)]">
                            {filteredPosts.length - index}
                          </td>
                          <td className="border-b border-r border-[var(--border)] px-4 py-3 align-top min-w-[20rem] text-[var(--text-strong)]">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPostId(post.id);
                                setEditorMode(null);
                              }}
                              className="w-full text-left"
                            >
                              <span className="font-semibold">{post.title}</span>
                              <span className="mt-1 block text-xs leading-relaxed text-[var(--text-muted)]">
                                {post.body.slice(0, 90)}
                                {post.body.length > 90 ? "..." : ""}
                              </span>
                            </button>
                          </td>
                          <td className="border-b border-r border-[var(--border)] px-4 py-3 align-top whitespace-nowrap">
                            {post.author_name || post.author_email || "작성자"}
                          </td>
                          <td className="border-b border-r border-[var(--border)] px-4 py-3 align-top whitespace-nowrap">
                            {post.author_level}
                          </td>
                          <td className="border-b border-[var(--border)] px-4 py-3 align-top whitespace-nowrap text-[var(--text-muted)]">
                            {formatPostTimestamp(post.updated_at)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="border-b border-[var(--border)] px-4 py-12 text-center text-sm text-[var(--text-muted)]"
                      >
                        {posts.length > 0
                          ? "검색 조건에 맞는 게시글이 없습니다."
                          : "아직 등록된 게시글이 없습니다. 첫 글을 작성해보세요."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="retro-card rounded-[22px] p-4 sm:p-5">
            {editorMode ? (
              <div className="space-y-4">
                <div>
                  <p className="theme-kicker text-[11px] sm:text-xs">
                    {editorMode === "edit" ? "EDIT POST" : "NEW POST"}
                  </p>
                  <h3 className="retro-title theme-heading mt-2 text-base sm:text-lg">
                    {editorMode === "edit" ? "게시글 수정" : "새 게시글 작성"}
                  </h3>
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    value={formState.title}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="제목을 입력하세요"
                    maxLength={120}
                    className="w-full px-4 py-3"
                  />
                  <textarea
                    value={formState.body}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                    placeholder="내용을 입력하세요"
                    rows={10}
                    maxLength={5000}
                    className="w-full px-4 py-3"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={submitting}
                    className="retro-button-solid min-h-[42px] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "저장 중..." : editorMode === "edit" ? "수정 저장" : "글 등록"}
                  </button>
                  <button
                    type="button"
                    onClick={handleEditorCancel}
                    disabled={submitting}
                    className="retro-button min-h-[42px] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : selectedPost ? (
              <div className="space-y-4">
                <div>
                  <p className="theme-kicker text-[11px] sm:text-xs">POST DETAIL</p>
                  <h3 className="retro-title theme-heading mt-2 text-base sm:text-lg">
                    {selectedPost.title}
                  </h3>
                </div>

                <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                  <span className="theme-chip-subtle px-3 py-1.5">
                    작성자: {selectedPost.author_name || selectedPost.author_email || "작성자"}
                  </span>
                  <span className="theme-chip-subtle px-3 py-1.5">
                    등급: {selectedPost.author_level}
                  </span>
                  <span className="theme-chip-subtle px-3 py-1.5">
                    수정: {formatPostTimestamp(selectedPost.updated_at)}
                  </span>
                </div>

                <div className="theme-note-box min-h-[16rem] rounded-[20px] px-4 py-4 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedPost.body}
                </div>

                {canManageSelectedPost ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleEditStart}
                      className="retro-button-solid min-h-[42px] px-4 py-2 text-sm font-semibold"
                    >
                      글 수정
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete()}
                      disabled={deleting}
                      className="retro-button min-h-[42px] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deleting ? "삭제 중..." : "글 삭제"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex h-full min-h-[18rem] flex-col items-start justify-center gap-4">
                <div>
                  <p className="theme-kicker text-[11px] sm:text-xs">EMPTY STATE</p>
                  <h3 className="retro-title theme-heading mt-2 text-base sm:text-lg">
                    아직 선택된 게시글이 없습니다
                  </h3>
                  <p className="theme-copy mt-3 text-sm leading-relaxed">
                    새 글을 작성하거나 목록에서 게시글을 선택하면 이곳에 상세 내용이 표시됩니다.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCreateStart}
                  className="retro-button-solid min-h-[42px] px-4 py-2 text-sm font-semibold"
                >
                  첫 글 작성
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </PageShell>
  );
}