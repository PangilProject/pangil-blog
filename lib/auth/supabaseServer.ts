import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { readSupabaseAuthEnv } from "@/lib/auth/supabaseEnv";

/**
 * Server Component / Server Action 용 Supabase 클라이언트.
 * "server-only"로 클라이언트 번들 유입을 차단한다(05 §3.1 supabase-js 클라이언트 금지).
 */
export async function createSupabaseServerClient() {
  const { url, anonKey } = readSupabaseAuthEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component에서는 쿠키를 쓸 수 없다. 세션 갱신은 middleware가 담당한다.
        }
      },
    },
  });
}
