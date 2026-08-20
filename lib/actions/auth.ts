"use server";

import { redirect } from "next/navigation";

import { ADMIN_HOME_PATH, ADMIN_LOGIN_PATH } from "@/lib/auth/adminPaths";
import { signOutAdmin } from "@/lib/auth/adminSession";
import { isAdminEmail } from "@/lib/auth/supabaseEnv";
import { createSupabaseServerClient } from "@/lib/auth/supabaseServer";

/**
 * A-00 로그인 (05 §3.2 — Supabase Auth 이메일/비번 단일 관리자 계정).
 * 클라이언트 JS 없이 form action으로만 동작한다.
 */
export async function signIn(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(`${ADMIN_LOGIN_PATH}?error=empty`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  // 실패 사유(계정 없음/비번 틀림)를 구분해 노출하지 않는다.
  if (error || !isAdminEmail(data.user?.email)) {
    if (!error) await supabase.auth.signOut();
    redirect(`${ADMIN_LOGIN_PATH}?error=invalid`);
  }

  redirect(ADMIN_HOME_PATH);
}

export async function signOut(): Promise<void> {
  await signOutAdmin();
  redirect(ADMIN_LOGIN_PATH);
}
