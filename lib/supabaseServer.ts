import { createClient } from "@supabase/supabase-js";

type SupabaseAdminKeyKind = "missing" | "publishable" | "secret" | "jwt" | "other";

function getSupabasePublicConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase public environment variables are not configured.");
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
}

export function isSupabaseAdminConfigured() {
  const keyKind = getSupabaseAdminKeyKind();
  return keyKind === "secret" || keyKind === "jwt";
}

export function getSupabaseAdminKeyKind(): SupabaseAdminKeyKind {
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  if (!supabaseServiceRoleKey) {
    return "missing";
  }

  if (supabaseServiceRoleKey.startsWith("sb_publishable_")) {
    return "publishable";
  }

  if (supabaseServiceRoleKey.startsWith("sb_secret_")) {
    return "secret";
  }

  if (supabaseServiceRoleKey.startsWith("eyJ")) {
    return "jwt";
  }

  return "other";
}

export function getSupabaseAdminConfigurationError() {
  const keyKind = getSupabaseAdminKeyKind();

  if (keyKind === "missing") {
    return "서버 관리자 키가 설정되지 않았습니다. 로컬은 .env.local, 배포는 호스팅 환경 변수에 SUPABASE_SERVICE_ROLE_KEY를 추가해주세요.";
  }

  if (keyKind === "publishable") {
    return "현재 SUPABASE_SERVICE_ROLE_KEY에 publishable 키가 들어 있습니다. service_role 키 또는 sb_secret 키로 바꿔주세요.";
  }

  if (keyKind === "other") {
    return "현재 SUPABASE_SERVICE_ROLE_KEY 형식을 확인할 수 없습니다. service_role 키 또는 sb_secret 키를 넣어주세요.";
  }

  return null;
}

export function createSupabaseServerAuthClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicConfig();

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createSupabaseAdminClient() {
  const { supabaseUrl } = getSupabasePublicConfig();
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const configurationError = getSupabaseAdminConfigurationError();

  if (!supabaseServiceRoleKey || configurationError) {
    throw new Error(configurationError || "SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}