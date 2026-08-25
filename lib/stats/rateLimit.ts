import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * 통계 비콘 rate limit (05 §4.3).
 *
 * `/api/stat`은 인증이 없다. 그래서 누가 루프로 POST하면 StatEvent 테이블이 무한히 자란다 —
 * 막으려는 대상은 악의만이 아니다. 내 비콘 코드가 버그로 무한 발화해도 같은 일이 난다.
 *
 * **왜 외부 Redis인가.** Vercel 함수는 요청마다 다른 인스턴스일 수 있어 함수 안의 카운터가
 * 다음 요청에 보이지 않는다. 그리고 Postgres로 세면 *지키려는 그 DB*를 매 요청 때린다.
 * 이 Upstash 프리미티브는 Backlog 1순위 자체 댓글의 honeypot·rate limit에서 재사용된다
 * (00 §5.2) — 단일 목적 의존성이 아니다.
 *
 * 사람 한 명이 만드는 이벤트는 글 하나당 2개(PAGEVIEW·LEAVE)다. 분당 60은 정상 독서로는
 * 닿지 않는 선이고, 여기서 노리는 것은 정밀한 차단이 아니라 **폭주의 상한**이다.
 */

const WINDOW = "60 s";
const LIMIT = 60;

/** 모듈 스코프에 한 번만 만든다. 요청마다 새로 만들면 연결이 새는 쪽이 비용이다 */
let limiter: Ratelimit | null = null;
let warned = false;

function getLimiter(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;
  if (!limiter) {
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      // 슬라이딩 윈도우: 고정 창의 경계에서 순간 2배가 통과하는 문제가 없다
      limiter: Ratelimit.slidingWindow(LIMIT, WINDOW),
      prefix: "stat",
      // 카운터 증가를 응답 이후로 미룬다 — 방문자가 상한 검사를 기다리지 않는다
      analytics: false,
    });
  }
  return limiter;
}

/**
 * 상한을 넘었는가.
 *
 * **env가 없으면 통과시킨다** — 크롤러 토큰 검증과 반대다(그쪽은 fail closed). 두 곳의
 * 비대칭이 의도적이다: 크롤러 경로는 막지 못하면 남이 초안을 만들 수 있고, 여기서 막지 못하면
 * 통계 행이 늘어날 뿐이다. 반대로 여기서 fail closed면 env 하나 빠진 것으로 **통계 전체가
 * 조용히 죽는다** — 죽은 줄도 모르는 계측이 부풀려진 계측보다 나쁘다. 대신 시끄럽게 남긴다.
 */
export async function isRateLimited(key: string): Promise<boolean> {
  const instance = getLimiter();

  if (!instance) {
    if (!warned) {
      warned = true;
      console.error(
        "UPSTASH_REDIS_REST_URL/TOKEN이 없어 통계 rate limit 없이 수집합니다 (.env.example 참조).",
      );
    }
    return false;
  }

  try {
    const { success } = await instance.limit(key);
    return !success;
  } catch (error) {
    // Upstash가 죽었다고 통계를 멈추지 않는다. 이 경로는 실패해도 손해가 작은 쪽이다
    console.error("통계 rate limit 확인 실패 — 통과시킵니다", error);
    return false;
  }
}
