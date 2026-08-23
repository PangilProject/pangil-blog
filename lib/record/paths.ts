import type { RecordType } from "@/lib/record/callNumber";
import { siteOf } from "@/lib/revalidate/tags";

/**
 * 공개 지면 경로. slug가 전역 unique이므로(05 §1.4) 타입 세그먼트를 두지 않는다.
 *
 * 클라이언트에서도 쓴다(발행 직후 이동) — 그래서 server-only 모듈이 아니다.
 */
export function publicPostPath(type: RecordType, slug: string): string {
  return `/${siteOf(type)}/${slug}`;
}
