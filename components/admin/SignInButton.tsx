"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

/**
 * 로그인 버튼 (A-00).
 *
 * **눌렀는지 모르겠다는 말이 이 버튼의 이유다.** 로그인은 Supabase에 왕복하고 그다음
 * 리다이렉트까지 가므로 눈에 띄게 걸리는데, 그동안 화면이 아무 말도 안 했다. 발행 버튼과
 * 같은 결함이었다(02 §3.4 — 신뢰의 시각화).
 *
 * **JS 없이도 로그인은 된다.** 폼은 서버 액션에 그대로 제출되고, 이 조각이 하는 일은
 * 제출 중임을 글자로 말하는 것까지다 — 진행 표시를 위해 동작을 클라이언트로 옮기지 않는다.
 */
export function SignInButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending} className="mt-1 w-full">
      {pending ? "들어가는 중…" : "로그인"}
    </Button>
  );
}
