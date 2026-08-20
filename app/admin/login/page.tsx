import { signIn } from "@/lib/actions/auth";
import { hasSupabaseAuthEnv } from "@/lib/auth/supabaseEnv";

// A-00 로그인. 화면 조판은 M1 디자인 시스템에서 입힌다.
export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { error } = await searchParams;

  if (!hasSupabaseAuthEnv()) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-col gap-4 p-8">
        <h1 className="text-lg">관리자 로그인</h1>
        <p role="alert">
          Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)가 설정되지
          않았습니다. .env.example을 참고해 채워 주세요.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-4 p-8">
      <h1 className="text-lg">관리자 로그인</h1>
      <form action={signIn} className="flex flex-col gap-3">
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
      {error ? <p role="alert">로그인하지 못했습니다. 이메일과 비밀번호를 확인해 주세요.</p> : null}
    </main>
  );
}
