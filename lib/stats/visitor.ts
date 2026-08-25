import "server-only";

import { createHash } from "node:crypto";

import { kstDateKey } from "@/lib/record/kst";

/**
 * 방문자 식별·기기 판정·봇 필터 (05 §4.1 · §4.2).
 *
 * 여기 있는 것은 전부 **서버가 ip·ua에서 파생하는 값**이다. 클라이언트가 보내온 것을 그대로
 * 쓰지 않는다 — 그러면 세는 주체가 세어지는 쪽이 된다.
 */

/**
 * 무상태 일일 로테이션 해시 (05 §4.2).
 *
 * `sha256(salt : dateKST : ip : ua)`. 솔트는 고정이고 **날짜가 매일 실효 솔트를 바꾼다** —
 * 그래서 같은 사람이라도 어제와 오늘의 해시가 다르고, 날짜를 넘는 추적이 불가능하다.
 * 쿠키를 심지 않으므로 동의 배너도 필요 없고, 저장할 솔트 테이블도 없다.
 *
 * ip가 없으면(프록시 헤더 부재) ua만으로 해시한다 — 정밀도는 떨어지지만 이벤트를 버리는 편이
 * 더 나쁘다. 어차피 유일 방문자 수는 근사값이다.
 */
export function visitorHash({
  salt,
  now,
  ip,
  userAgent,
}: {
  salt: string;
  now: Date;
  ip: string | null;
  userAgent: string | null;
}): string {
  return createHash("sha256")
    .update([salt, kstDateKey(now), ip ?? "", userAgent ?? ""].join(":"))
    .digest("hex");
}

/**
 * 03 §5의 지면은 모바일·데스크탑 두 갈래만 다룬다. 태블릿을 따로 세지 않는 것은
 * 그 구분으로 무엇을 할지 정해두지 않았기 때문이다 — 쓰지 않을 정밀도는 정밀도가 아니다.
 */
export function deviceOf(userAgent: string | null): "MOBILE" | "DESKTOP" {
  if (!userAgent) return "DESKTOP";
  return /android|iphone|ipad|ipod|mobile|silk|kindle|opera mini/i.test(userAgent)
    ? "MOBILE"
    : "DESKTOP";
}

/**
 * 렌더링 봇 차단 (05 §4.1).
 *
 * 비콘은 JS가 돌 때만 발화하므로 **비렌더 크롤러는 이미 자연 배제**된다. 남는 것은 실제로
 * 페이지를 렌더하는 쪽 — 검색엔진의 렌더링 봇, 링크 미리보기, 헤드리스 브라우저다.
 *
 * 목록을 늘리는 데 힘을 쏟지 않는다. 놓친 봇 몇은 통계를 조금 부풀릴 뿐이고, 여기서 중요한
 * 것은 "구글봇이 내 조회수를 만들지 않는다"는 굵은 선이다.
 */
const BOT_PATTERN =
  /bot|crawler|spider|crawling|slurp|bingpreview|headless|phantomjs|puppeteer|playwright|lighthouse|pagespeed|monitor|preview|facebookexternalhit|whatsapp|telegram|kakaotalk-scrap|yeti/i;

export function isBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return true; // ua 없는 요청은 사람의 브라우저가 아니다
  return BOT_PATTERN.test(userAgent);
}

/**
 * Vercel은 실제 클라이언트 IP를 `x-forwarded-for` 맨 앞에 넣는다. 뒤쪽 값은 프록시 체인이라
 * 신뢰할 수 없고, 헤더 자체도 위조될 수 있다 — 그래서 이 값은 **해시의 재료**로만 쓰고
 * 차단·허용 판단에는 쓰지 않는다.
 */
export function clientIpOf(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || null;
}
