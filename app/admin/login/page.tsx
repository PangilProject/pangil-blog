import { SignInButton } from "@/components/admin/SignInButton";
import { signIn } from "@/lib/actions/auth";
import { loginErrorMessage } from "@/lib/auth/loginError";
import { safeNextPath } from "@/lib/auth/nextPath";
import { hasSupabaseAuthEnv } from "@/lib/auth/supabaseEnv";

/**
 * A-00 로그인.
 *
 * 조판은 M1 디자인 시스템 그대로다(03 §5.3) — 종이 바탕에 각진 명판 하나. **M1 이후 이
 * 화면만 조판이 안 입혀진 채 남아 있었다.** 관리 네비와 같은 제목(`기록 관리`)을 쓰는 것은
 * 장식이 아니라 "여기가 그 관리 화면이다"를 말하는 일이다.
 *
 * 동작은 서버 액션 하나다. 클라이언트로 옮긴 것은 **제출 중임을 말하는 글자**뿐이고
 * (`SignInButton`), JS 없이도 로그인은 그대로 된다.
 */

/**
 * 이 지면은 `searchParams`를 읽는다 — 요청이 있어야 무엇을 그릴지 정해진다. 그래서 즉시
 * 전환용 껍데기를 미리 만들 수 없고, Next가 개발 중에 그 사실을 인사이트로 알린다.
 * 공개 목록도 같은 이유로 같은 선언을 갖고 있다(04 ADR-003).
 */
export const instant = false;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 py-12">
      <div className="flex w-full max-w-[320px] flex-col gap-5 border border-edge bg-card px-7 py-8">
        <h1 className="font-serif text-[17px]">
          기록 <em className="font-typewriter text-[11px] text-faint not-italic">관리</em>
        </h1>
        {children}
      </div>
    </main>
  );
}

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { error, next: intended } = await searchParams;
  const next = safeNextPath(typeof intended === "string" ? intended : null);
  const message = loginErrorMessage(typeof error === "string" ? error : null);

  if (!hasSupabaseAuthEnv()) {
    return (
      <Shell>
        <p role="alert" className="font-typewriter text-[11.5px] leading-body text-(--accent)">
          Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)가 설정되지
          않았어요. .env.example을 참고해 채워 주세요.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <form action={signIn} className="flex flex-col gap-4">
        {/* 로그인 뒤 가려던 글의 에디터로 보낸다. 값은 서버에서 다시 검사한다 */}
        {next && <input type="hidden" name="next" value={next} />}

        <Field id="email" label="이메일">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            // 들어오자마자 적을 수 있게 한다. 이 화면에 다른 할 일이 없다
            // biome-ignore lint/a11y/noAutofocus: 칸이 하나뿐인 지면이다
            autoFocus
            className="w-full border-edge border-b bg-transparent pb-1.5 font-typewriter text-[12.5px] text-ink outline-none focus:border-ink"
          />
        </Field>

        <Field id="password" label="비밀번호">
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full border-edge border-b bg-transparent pb-1.5 font-typewriter text-[12.5px] text-ink outline-none focus:border-ink"
          />
        </Field>

        <SignInButton />
      </form>

      {message && (
        <p role="alert" className="font-typewriter text-[11.5px] leading-body text-(--accent)">
          {message}
        </p>
      )}
    </Shell>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-typewriter text-[10.5px] tracking-[0.14em] text-faint">
        {label}
      </label>
      {children}
    </div>
  );
}
