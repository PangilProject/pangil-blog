"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_HOME_PATH, ADMIN_LOGIN_PATH } from "@/lib/auth/adminPaths";
import { signOutAdmin } from "@/lib/auth/adminSession";
import { ADMIN_UI_COOKIE } from "@/lib/auth/adminUiHint";
import { safeNextPath } from "@/lib/auth/nextPath";
import { isAdminEmail } from "@/lib/auth/supabaseEnv";
import { createSupabaseServerClient } from "@/lib/auth/supabaseServer";
import { ownerCookieDomain } from "@/lib/stats/owner";

/**
 * A-00 로그인 (05 §3.2 — Supabase Auth 이메일/비번 단일 관리자 계정).
 * 클라이언트 JS 없이 form action으로만 동작한다.
 */
export async function signIn(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  // 폼에 실려 온 값도 URL에서 온 것이다 — 검사를 거친 것만 쓴다
  const next = safeNextPath(String(formData.get("next") ?? ""));

  // 다시 물어볼 때도 가려던 곳을 잃지 않는다. 여기서 떨어뜨리면 비밀번호를 한 번 틀린
  // 사람은 관리 홈으로 떨어진다
  const retry = (reason: string): never => {
    const params = new URLSearchParams({ error: reason });
    if (next) params.set("next", next);
    redirect(`${ADMIN_LOGIN_PATH}?${params.toString()}`);
  };

  if (!email || !password) {
    retry("empty");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  // 실패 사유(계정 없음/비번 틀림)를 구분해 노출하지 않는다.
  if (error || !isAdminEmail(data.user?.email)) {
    if (!error) await supabase.auth.signOut();
    retry("invalid");
  }

  redirect(next ?? ADMIN_HOME_PATH);
}

export async function signOut(): Promise<void> {
  await signOutAdmin();

  // 관리 UI 힌트도 함께 지운다. 남겨두면 로그아웃한 뒤에도 공개 지면에 `수정`이 보인다.
  // 통계 제외 쿠키(stat_optout)는 그대로 둔다 — 그쪽은 수명이 다르다(내 방문은 계속 빠져야 한다)
  const jar = await cookies();
  jar.set(ADMIN_UI_COOKIE, "", {
    maxAge: 0,
    path: "/",
    domain: ownerCookieDomain(process.env.SITE_HOST_ROOT),
  });

  redirect(ADMIN_LOGIN_PATH);
}
