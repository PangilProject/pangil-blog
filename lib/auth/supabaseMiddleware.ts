import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

import { hasSupabaseAuthEnv, isAdminEmail, readSupabaseAuthEnv } from "@/lib/auth/supabaseEnv";

/**
 * proxy(구 middleware)에서 세션을 확인하고, 갱신된 인증 쿠키를 응답에 실어 보낸다.
 * 실 보안 경계는 여기 하나가 아니다 — 변경 액션은 lib/actions/withAdmin이 다시 막는다(05 §3.2).
 */
export async function isAdminRequest(
  request: NextRequest,
  response: NextResponse,
): Promise<boolean> {
  // env 미설정(예: Supabase 프로젝트 생성 전)에는 관리 영역을 열지 않는다 — fail closed.
  if (!hasSupabaseAuthEnv()) {
    console.error("Supabase Auth 환경변수가 없어 /admin 접근을 차단했습니다 (.env.example 참조).");
    return false;
  }

  const { url, anonKey } = readSupabaseAuthEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;

  return isAdminEmail(data.user.email);
}
