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
 *
 * **비어 있으면 "로그인한 아무나"가 관리자가 된다.** 그때 실제 문은 이 함수가 아니라
 * **Supabase에서 가입이 막혀 있는가**이고, 그건 코드가 아니라 설정이라 여기서 확인할 수 없다.
 * 그래서 값이 없으면 **로그에 남긴다** — 조용히 열려 있는 것과 닫혀 있는 것을 구분하려면
 * 어딘가에는 흔적이 있어야 한다(전수조사 개발 2-1).
 *
 * 던지지 않는 이유: 값이 빠진 순간 관리자가 자기 도구에서 잠긴다. 그 대가가 더 크다.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  const allowed = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!allowed) {
    console.warn("[auth] ADMIN_EMAIL이 비어 있습니다 — 로그인한 사용자를 모두 관리자로 봅니다");
    return Boolean(email);
  }

  return Boolean(email) && email?.trim().toLowerCase() === allowed;
}
