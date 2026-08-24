import { parseDraftContent } from "@/lib/db/content";
import type { RichTextValue } from "@/lib/editor/richText";
import { isEmptyDoc } from "@/lib/editor/richText";

/**
 * 사용자 작업 보호 (06 §3 결정 로그 5).
 *
 * 재크롤이 사람이 쓴 답변을 덮는 것은 이 시스템에서 일어날 수 있는 **가장 나쁜 일**이다.
 * 그래서 판단을 시각이 아니라 **내용**으로 한다 — 자동 저장은 아무것도 안 써도 updatedAt을
 * 밀어버리고, 반대로 사람이 쓴 답변은 시간과 무관하게 거기 있다.
 *
 * 모르겠으면 "편집됨"이다. 스키마를 통과하지 못한 content를 덮어쓰면 복구할 방법이 없다.
 */
export function isUserEdited(rawContent: unknown): boolean {
  const parsed = parseDraftContent(rawContent);

  // 읽을 수 없는 content = 무엇이 들었는지 모르는 content. 덮지 않는다
  if (!parsed.ok) return true;
  if (parsed.content.kind !== "QT") return true;

  const { questionGroups, summary } = parsed.content;

  if (!isEmptyDoc(summary as RichTextValue | undefined)) return true;

  for (const group of questionGroups ?? []) {
    for (const question of group.questions ?? []) {
      if (!isEmptyDoc(question.answer as RichTextValue | undefined)) return true;
    }
  }

  return false;
}

/**
 * 재크롤이 이 글을 덮어도 되는가 (06 §3).
 *
 * 사람이 손댄 초안 말고 **발행된 글**도 지킨다. 크롤러가 만든 초안을 그날 발행했는데
 * 저녁에 수동 재실행을 누르면 공개된 기록이 빈 답변으로 되돌아간다 — 06 §3 의사코드에는
 * 없지만 같은 이유로 막아야 하는 경우다.
 */
export function shouldKeepPost(post: { status: string; content: unknown }): boolean {
  return post.status !== "DRAFT" || isUserEdited(post.content);
}
