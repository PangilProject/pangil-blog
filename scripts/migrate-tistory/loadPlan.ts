import type { PostContent } from "@/lib/content/schema";
import type { RecordType } from "@/lib/record/callNumber";
import { tiptapToPlainText } from "@/lib/render/plainText";
import type { PreparedPost } from "@/scripts/migrate-tistory/pipeline";

/**
 * 적재 순서와 파생 값 (05 §6.4).
 *
 * DB를 만지지 않는 부분만 여기 둔다 — 청구기호 소급은 이 이관에서 되돌릴 수 없는 결정이고
 * (번호는 부여 후 불변, 05 §5), 그래서 테스트로 고정해야 한다.
 */

export type CallNumberPlan = Map<number, number>;

/**
 * **타입별 원본 작성일 오름차순으로** 1..N (§6.4-1·2).
 *
 * 옮기는 순서(파일명 = 티스토리 글 ID)가 아니라 쓴 순서를 따른다. 번호가 곧 이 기록물의
 * 연대기이기 때문이다. 티스토리 ID는 대체로 시간순이지만 어긋난 글이 있다.
 *
 * 초안으로 들어가는 글은 번호를 받지 않는다 — 발행할 때 카운터에서 이어받는다.
 */
export function assignCallNumbers(
  posts: PreparedPost[],
  startFrom: Map<RecordType, number> = new Map(),
): CallNumberPlan {
  const byType = new Map<RecordType, PreparedPost[]>();

  for (const post of posts) {
    const list = byType.get(post.type) ?? [];
    list.push(post);
    byType.set(post.type, list);
  }

  const numbers: CallNumberPlan = new Map();

  for (const [type, list] of byType) {
    const ordered = [...list].sort(
      (a, b) => a.publishedAt.getTime() - b.publishedAt.getTime() || a.legacyId - b.legacyId,
    );
    let next = (startFrom.get(type) ?? 0) + 1;

    for (const post of ordered) {
      if (!post.publishable) continue;
      numbers.set(post.legacyId, next);
      next += 1;
    }
  }

  return numbers;
}

/** TECH 목록 카드의 한 줄 (02 §2.2). 나머지 타입은 카드에 요약을 쓰지 않는다 */
export function deriveExcerpt(content: PostContent): string | null {
  if (content.kind !== "TECH") return null;

  const text = tiptapToPlainText(content.body).trim();
  if (text === "") return null;

  return text.length > 140 ? `${text.slice(0, 139)}…` : text;
}
