import "server-only";

import type { User } from "@supabase/supabase-js";

import { isAdminEmail } from "@/lib/auth/supabaseEnv";
import { createSupabaseServerClient } from "@/lib/auth/supabaseServer";

/** 로그인한 관리자. 미인증이거나 허용 계정이 아니면 null */
export async function getAdminUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;
  return isAdminEmail(data.user.email) ? data.user : null;
}

export async function signOutAdmin(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
