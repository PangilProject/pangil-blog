import type { DraftContent, PostContent } from "@/lib/content/schema";
import { DraftSchema, PublishSchema } from "@/lib/content/schema";

/**
 * Json 경계 (ADR-002 "리포지토리 경계 밖으로 Prisma Json 원시 타입을 노출하지 않는다").
 *
 * DB에서 나온 값은 여기서 safeParse를 거쳐 타입 붙은 값이 되고, 실패는 삼키지 않고
 * 결과로 돌려준다. 04 §2.4의 3중 검증 중 "렌더링 전" 지점이 이 함수를 쓰며, 실패 시
 * 호출자가 raw 폴백 렌더 + 알림을 선택한다.
 */

export type ContentParseResult<T> =
  | { ok: true; content: T }
  | { ok: false; issues: string[]; raw: unknown };

function toIssues(error: { issues: { path: (string | number | symbol)[]; message: string }[] }) {
  return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
}

/** 에디터가 읽는 경로 — 초안은 미완성이 정상이다 */
export function parseDraftContent(raw: unknown): ContentParseResult<DraftContent> {
  const result = DraftSchema.safeParse(raw);
  if (result.success) return { ok: true, content: result.data as DraftContent };
  return { ok: false, issues: toIssues(result.error), raw };
}

/** 발행 게이트가 읽는 경로 — 구조가 갖춰져야 한다(05 §3.4) */
export function parsePublishContent(raw: unknown): ContentParseResult<PostContent> {
  const result = PublishSchema.safeParse(raw);
  if (result.success) return { ok: true, content: result.data };
  return { ok: false, issues: toIssues(result.error), raw };
}
