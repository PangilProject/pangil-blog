import type { RecordType } from "@/lib/record/callNumber";
import { siteOf } from "@/lib/revalidate/tags";

/**
 * 공개 지면 경로. slug가 전역 unique이므로(05 §1.4) 타입 세그먼트를 두지 않는다.
 *
 * 클라이언트에서도 쓴다(발행 직후 이동) — 그래서 server-only 모듈이 아니다.
 *
 * 지금은 **내부 라우트 경로**를 돌려준다(`/faith/sr-1`). 호스트가 하나인 환경에서는 미들웨어가
 * 이 경로를 그대로 통과시킨다(sitePrefixOf). 도메인 3개를 붙이는 시점에는 정규 URL이
 * `faith.○/sr-1`이 되므로, 그때 이 함수가 호스트를 함께 판단해야 한다 — 도메인 확정이
 * 출시 게이트에 걸려 있어(07 §4) 그 시점에 함께 정한다.
 */
export function publicPostPath(type: RecordType, slug: string): string {
  return `/${siteOf(type)}/${slug}`;
}
