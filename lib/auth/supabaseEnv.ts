/**
 * Supabase Auth 접속값. 값은 .env(로컬) / Vercel 환경변수에만 둔다 — 하드코딩 금지.
 *
 * 이 프로젝트에서 supabase-js는 **인증(세션 쿠키) 전용**이며 브라우저에서 쓰지 않는다.
 * 공개 데이터 읽기는 서버 Prisma 정적 렌더가 전담한다(05 §3.1).
 */
export type SupabaseAuthEnv = {
  url: string;
  anonKey: string;
};

/** Supabase 접속값이 갖춰졌는지. 미설정 상태에서도 500 대신 로그인 화면으로 떨어지게 한다. */
export function hasSupabaseAuthEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function readSupabaseAuthEnv(): SupabaseAuthEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다 (.env.example 참조).",
    );
  }

  return { url, anonKey };
}

/**
 * 단일 관리자 계정(A-00, 05 §3.2)이므로 로그인한 사용자가 곧 관리자다.
 * ADMIN_EMAIL을 설정하면 그 주소만 관리자로 인정한다(계정 오생성 방어).
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  const allowed = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!allowed) return Boolean(email);
  return Boolean(email) && email?.trim().toLowerCase() === allowed;
}
