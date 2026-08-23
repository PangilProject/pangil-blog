import "server-only";

import type { User } from "@supabase/supabase-js";
import { connection } from "next/server";

import { isAdminEmail } from "@/lib/auth/supabaseEnv";
import { createSupabaseServerClient } from "@/lib/auth/supabaseServer";

/**
 * 로그인한 관리자. 미인증이거나 허용 계정이 아니면 null.
 *
 * 첫 줄이 `connection()`이다 — 세션은 요청이 있어야 알 수 있다. 이게 없으면 빌드의 프리렌더
 * 패스가 관리 페이지 본문을 실행하고(레이아웃과 페이지는 나란히 렌더된다), 시크릿이 없는
 * 환경에서 빌드가 깨진다. 실제로 CI가 그렇게 깨졌다.
 */
export async function getAdminUser(): Promise<User | null> {
  await connection();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;
  return isAdminEmail(data.user.email) ? data.user : null;
}

export async function signOutAdmin(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
