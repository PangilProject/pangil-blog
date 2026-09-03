import { signIn } from "@/lib/actions/auth";
import { safeNextPath } from "@/lib/auth/nextPath";
import { hasSupabaseAuthEnv } from "@/lib/auth/supabaseEnv";

// A-00 로그인. 화면 조판은 M1 디자인 시스템에서 입힌다.

/**
 * 이 지면은 `searchParams`를 읽는다 — 요청이 있어야 무엇을 그릴지 정해진다. 그래서 즉시
 * 전환용 껍데기를 미리 만들 수 없고, Next가 개발 중에 그 사실을 인사이트로 알린다.
 * 공개 목록도 같은 이유로 같은 선언을 갖고 있다(04 ADR-003).
 */
export const instant = false;
export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { error, next: intended } = await searchParams;
  const next = safeNextPath(typeof intended === "string" ? intended : null);

  if (!hasSupabaseAuthEnv()) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-col gap-4 p-8">
        <h1 className="text-lg">관리자 로그인</h1>
        <p role="alert">
          Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)가 설정되지
          않았어요. .env.example을 참고해 채워 주세요.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-4 p-8">
      <h1 className="text-lg">관리자 로그인</h1>
      <form action={signIn} className="flex flex-col gap-3">
        {/* 로그인 뒤 가려던 글의 에디터로 보낸다. 값은 서버에서 다시 검사한다 */}
        {next && <input type="hidden" name="next" value={next} />}
        <label className="flex flex-col gap-1" htmlFor="email">
          이메일
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            className="border px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1" htmlFor="password">
          비밀번호
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="border px-2 py-1"
          />
        </label>
        <button type="submit" className="border px-3 py-2">
          로그인
        </button>
      </form>
      {error ? <p role="alert">로그인하지 못했어요. 이메일과 비밀번호를 확인해 주세요.</p> : null}
    </main>
  );
}
