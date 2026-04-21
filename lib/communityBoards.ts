import type { User } from "@supabase/supabase-js";
import { isLegacyAdminUser } from "./admin";
import { hasMinimumUserLevel, type UserLevel } from "./userLevel";

export type CommunityBoardAccessLevel = "authenticated" | UserLevel;

export type CommunityBoardDefinition = {
  key: "jobs" | "free-talk" | "notice" | "tips" | "affiliate";
  path: string;
  menuLabel: string;
  title: string;
  description: string;
  heroKicker: string;
  sectionTitle: "커뮤니티" | "제휴 전용";
  accessLevel: CommunityBoardAccessLevel;
};

export const COMMUNITY_BOARD_DEFINITIONS = [
  {
    key: "jobs",
    path: "/community/jobs",
    menuLabel: "구인 구직",
    title: "구인 구직",
    description: "채용 공고, 기사 모집, 일자리 제안과 지원 정보를 올리는 공간입니다.",
    heroKicker: "JOBS",
    sectionTitle: "커뮤니티",
    accessLevel: "authenticated",
  },
  {
    key: "free-talk",
    path: "/community/free-talk",
    menuLabel: "자유",
    title: "자유 소통",
    description: "업무 일상, 현장 이야기, 질문과 답변을 자유롭게 남기는 공간입니다.",
    heroKicker: "FREE TALK",
    sectionTitle: "커뮤니티",
    accessLevel: "authenticated",
  },
  {
    key: "notice",
    path: "/community/notice",
    menuLabel: "구현중..",
    title: "구현중..",
    description: "현재 구현 중입니다.",
    heroKicker: "COMING SOON",
    sectionTitle: "커뮤니티",
    accessLevel: "authenticated",
  },
  {
    key: "tips",
    path: "/community/tips",
    menuLabel: "구현중..",
    title: "구현중..",
    description: "현재 구현 중입니다.",
    heroKicker: "COMING SOON",
    sectionTitle: "커뮤니티",
    accessLevel: "authenticated",
  },
  {
    key: "affiliate",
    path: "/affiliate",
    menuLabel: "제휴 게시판",
    title: "제휴 게시판",
    description: "제휴 등급 사용자와 상위 권한 계정이 확인하는 전용 게시판입니다.",
    heroKicker: "AFFILIATE ONLY",
    sectionTitle: "제휴 전용",
    accessLevel: "Lv3-제휴",
  },
] as const satisfies readonly CommunityBoardDefinition[];

export type CommunityBoardKey = (typeof COMMUNITY_BOARD_DEFINITIONS)[number]["key"];

export function getCommunityBoardDefinition(boardKey: string) {
  return COMMUNITY_BOARD_DEFINITIONS.find((board) => board.key === boardKey) ?? null;
}

export function getCommunityBoardDefinitionByPath(pathname: string) {
  return COMMUNITY_BOARD_DEFINITIONS.find((board) => board.path === pathname) ?? null;
}

export function canAccessCommunityBoard(
  board: Pick<CommunityBoardDefinition, "accessLevel">,
  user?: Pick<User, "app_metadata" | "user_metadata"> | null
) {
  if (!user) {
    return false;
  }

  if (board.accessLevel === "authenticated") {
    return true;
  }

  return isLegacyAdminUser(user) || hasMinimumUserLevel(user, board.accessLevel);
}

export function getCommunityBoardAccessScopeLabel(
  board: Pick<CommunityBoardDefinition, "accessLevel">,
  user?: Pick<User, "app_metadata" | "user_metadata"> | null
) {
  if (board.accessLevel === "authenticated") {
    return "로그인 계정";
  }

  if (user && isLegacyAdminUser(user) && !hasMinimumUserLevel(user, board.accessLevel)) {
    return "레거시 관리자 권한";
  }

  return `${board.accessLevel} 이상`;
}