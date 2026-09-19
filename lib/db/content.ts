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

/**
 * 카드 부제로 쓸 말씀 범위 한 줄.
 *
 * **content 전체를 스키마로 통과시키지 않는 예외다**(ADR-002 근거 6) — 목록은 수십 건이고
 * 카드에 필요한 건 한 줄뿐이다. 없으면 없는 대로 그린다.
 *
 * **예외는 셀 수 있어야 한다.** 이 규칙이 두 벌이던 동안 한쪽 주석은 스스로를 "유일한 자리"라고
 * 적고 있었고, 다른 쪽(OG 카드)은 근거 없이 같은 캐스트를 하고 있었다. content 구조가 바뀌면
 * 그쪽만 조용히 틀린 값을 냈을 것이다(전수조사 개발 1-5).
 */
export function scriptureRefOf(content: unknown): string | null {
  if (!content || typeof content !== "object") return null;

  const value = (content as { scriptureRef?: unknown }).scriptureRef;
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
