import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * 크롤러·크론 경로의 Bearer 검증 (06 §1.1 · §5).
 *
 * 이 토큰들은 service role key가 아니다 — 도달할 수 있는 코드가 DRAFT 생성뿐이라(05 §3.3)
 * 유출 피해가 "초안이 하나 생긴다"로 제한된다. 그래도 비교는 상수 시간으로 한다.
 *
 * **토큰이 설정되지 않았으면 통과시키지 않는다.** env 누락을 "인증 없음"으로 해석하면
 * 배포 실수 하나가 공개 엔드포인트가 된다.
 */
export function authorizeBearer(request: Request, expected: string | undefined): boolean {
  if (!expected) return false;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const given = Buffer.from(header.slice("Bearer ".length));
  const want = Buffer.from(expected);

  // 길이가 다르면 timingSafeEqual이 던진다. 길이 자체는 비밀이 아니다
  if (given.length !== want.length) return false;

  return timingSafeEqual(given, want);
}
