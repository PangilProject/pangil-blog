import { ADMIN_LOGIN_PATH } from "@/lib/auth/adminPaths";

/**
 * 로그인 후 돌아갈 곳 (A-00 · 05 §3.2).
 *
 * 공개 지면의 `수정`을 누른 사람은 로그인 화면을 지나 **그 글의 에디터로** 도착해야 한다.
 * 그러려면 가려던 경로를 로그인 왕복 동안 들고 다녀야 하고, 그 값은 URL에서 온다 —
 * 즉 **사용자가 고칠 수 있는 값**이다. 그래서 검사가 필요하다.
 *
 * 이 함수가 열린 리다이렉트를 막는 유일한 관문이다. 통과 조건:
 * - `/admin/`으로 시작한다. 로그인 후 갈 곳은 관리 영역뿐이다
 * - `//`나 `/\`로 시작하지 않는다 — 그건 다른 호스트로 나가는 주소다(`//evil.com`)
 * - 로그인 화면 자신이 아니다. 로그인하고 다시 로그인 화면으로 보내면 갇힌다
 *
 * 통과하지 못하면 null이고, 부르는 쪽은 관리 홈으로 보낸다.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value === "") return null;

  // 백슬래시는 브라우저가 슬래시로 고쳐 읽는다 — `/\evil.com`이 `//evil.com`이 된다
  if (value.includes("\\")) return null;
  if (!value.startsWith("/admin/")) return null;
  if (value.startsWith("//")) return null;

  const [pathname] = value.split("?");
  if (pathname === ADMIN_LOGIN_PATH) return null;

  return value;
}
