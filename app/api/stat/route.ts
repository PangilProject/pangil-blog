import type { NextRequest } from "next/server";

import { recordStatEvent } from "@/lib/db/statEvents";
import { siteHostsFromEnv } from "@/lib/site/resolveSite";
import { STAT_OPT_OUT_COOKIE } from "@/lib/stats/optOut";
import { isAllowedOrigin } from "@/lib/stats/origin";
import { isRateLimited } from "@/lib/stats/rateLimit";
import { StatPayloadSchema } from "@/lib/stats/statSchema";
import { clientIpOf, deviceOf, isBotUserAgent, visitorHash } from "@/lib/stats/visitor";

/**
 * 통계 수집 비콘 (05 §4).
 *
 * **모든 응답이 204다.** 성공도, 봇이라 버린 것도, 상한을 넘은 것도 똑같이 204를 준다.
 * 이유가 둘이다 — (1) `sendBeacon`은 응답을 읽지 않으므로 본문에 뭘 담아도 아무도 안 본다.
 * (2) 응답이 갈리면 그게 곧 탐지 신호다: "봇 판정을 받았는지" 알려주면 우회할 재료가 된다.
 *
 * 여기에 **무효화 호출을 넣지 마라.** 조회 하나가 지면 캐시를 날리면 통계가 사이트를 느리게
 * 만든다. 이 라우트는 append 하나로 끝난다.
 */

const NO_CONTENT = new Response(null, { status: 204 });

export async function POST(request: NextRequest) {
  const headers = request.headers;

  // 남의 페이지에 심긴 스크립트와 curl을 먼저 자른다 — 가장 싼 검사가 먼저다
  if (!isAllowedOrigin(headers.get("origin"), siteHostsFromEnv(process.env))) return NO_CONTENT;

  const userAgent = headers.get("user-agent");
  if (isBotUserAgent(userAgent)) return NO_CONTENT;

  // 관리자 본인 방문 제외 (07 M6 DoD). 비콘도 스스로 입을 닫지만 서버에서 한 번 더 본다 —
  // 캐시된 옛 HTML이 남아 있는 동안에도 내 조회가 새지 않아야 한다
  if (request.cookies.get(STAT_OPT_OUT_COOKIE)?.value === "1") return NO_CONTENT;

  const ip = clientIpOf(headers);

  // 상한 키는 IP다. 없으면 ua로 뭉갠다 — 정밀도보다 상한의 존재가 중요하다
  if (await isRateLimited(ip ?? `ua:${userAgent ?? "unknown"}`)) return NO_CONTENT;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NO_CONTENT;
  }

  const parsed = StatPayloadSchema.safeParse(body);
  if (!parsed.success) return NO_CONTENT;

  const salt = process.env.STAT_SALT;
  if (!salt) {
    // 솔트 없이 해시하면 ip·ua를 평문으로 되짚을 수 있는 값이 테이블에 쌓인다.
    // 익명성이 설계의 일부이므로(05 §4.2) 이건 통과시키지 않는다
    console.error("STAT_SALT가 없어 통계를 수집하지 않았습니다 (.env.example 참조).");
    return NO_CONTENT;
  }

  try {
    await recordStatEvent({
      payload: parsed.data,
      visitorHash: visitorHash({ salt, now: new Date(), ip, userAgent }),
      device: deviceOf(userAgent),
    });
  } catch (error) {
    // 통계 실패가 방문자에게 보이는 일은 없어야 한다
    console.error("통계 기록 실패", error);
  }

  return NO_CONTENT;
}
