"use server";

import { updateTag } from "next/cache";

import { withAdmin } from "@/lib/actions/withAdmin";
import { DraftSchema, matchesPostType } from "@/lib/content/schema";
import { parsePublishContent } from "@/lib/db/content";
import {
  createDraft,
  deletePostRecord,
  findCategorySlug,
  findEditablePost,
  findPostTagNames,
  publishPostRecord,
  saveDraft,
} from "@/lib/db/posts";
import { setPostTags } from "@/lib/db/tags";
import type { RecordType } from "@/lib/record/callNumber";
import { extractSearchText } from "@/lib/render/searchText";
import { postRevalidationTags } from "@/lib/revalidate/tags";

/**
 * 변경 Server Action (05 §3.2).
 *
 * 전부 withAdmin을 첫 줄에서 통과한다. Server Action은 별도 POST 엔드포인트로 직접 호출될
 * 수 있어서 middleware만으론 부족하다.
 *
 * 상태 전환 규칙:
 * - upsertDraft: 자동 저장. 무엇이든 저장하고 status는 건드리지 않는다
 * - publishPost: status를 PUBLISHED로 바꾸는 유일한 경로(05 §3.4). PublishSchema 통과 +
 *   청구기호 트랜잭션 + 무효화가 한 묶음이다
 */

export type UpsertDraftInput = {
  /** 없으면 새 초안을 만든다 */
  id?: string;
  type: RecordType;
  title: string;
  content: unknown;
  categoryId?: string | null;
  excerpt?: string | null;
  thumbnailUrl?: string | null;
  /** TECH 전용. 넘기지 않으면 기존 태그를 건드리지 않는다 */
  tags?: string[];
};

export type UpsertDraftResult =
  | { ok: true; id: string; savedAt: Date }
  | { ok: false; reason: "invalid-content" | "type-mismatch"; issues?: string[] };

export const upsertDraft = withAdmin(
  async (_user, input: UpsertDraftInput): Promise<UpsertDraftResult> => {
    const parsed = DraftSchema.safeParse(input.content);
    if (!parsed.success) {
      return {
        ok: false,
        reason: "invalid-content",
        issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      };
    }

    if (!matchesPostType(input.type, parsed.data)) {
      return { ok: false, reason: "type-mismatch" };
    }

    if (!input.id) {
      const created = await createDraft({
        type: input.type,
        title: input.title,
        content: parsed.data,
      });

      if (input.tags) await setPostTags(created.id, input.type, input.tags);

      return { ok: true, id: created.id, savedAt: created.updatedAt };
    }

    const saved = await saveDraft({
      id: input.id,
      title: input.title,
      content: parsed.data,
      categoryId: input.categoryId,
      excerpt: input.excerpt,
      thumbnailUrl: input.thumbnailUrl,
    });

    // 태그를 안 넘긴 에디터(QT·설교·찬양)의 저장이 기존 태그를 지우지 않는다
    if (input.tags) await setPostTags(input.id, input.type, input.tags);

    // 발행된 글의 수정 저장은 즉시 공개 반영이다(04 §1.2 "별도 반영 버튼 없음")
    if (saved.status === "PUBLISHED") {
      await revalidatePost(input.id, input.type, input.categoryId ?? null);
    }

    return { ok: true, id: saved.id, savedAt: saved.updatedAt };
  },
);

export type PublishPostResult =
  | { ok: true; id: string; slug: string; callNumber: number }
  | { ok: false; reason: "not-found" | "invalid-content" | "type-mismatch"; issues?: string[] };

export const publishPost = withAdmin(async (_user, postId: string): Promise<PublishPostResult> => {
  const post = await findEditablePost(postId);
  if (!post) return { ok: false, reason: "not-found" };

  // 초안 스키마가 아니라 발행 스키마를 통과해야 한다 — 여기가 게이트다
  const parsed = parsePublishContent(post.content.ok ? post.content.content : null);
  if (!parsed.ok) return { ok: false, reason: "invalid-content", issues: parsed.issues };
  if (!matchesPostType(post.type, parsed.content)) return { ok: false, reason: "type-mismatch" };

  const published = await publishPostRecord({
    id: post.id,
    type: post.type,
    title: post.title,
    content: parsed.content,
    existingCallNumber: post.callNumber,
    existingSlug: post.slug,
    existingPublishedAt: null,
    // 검색용 평문은 발행 시 채운다(05 §4A)
    searchText: extractSearchText(post.title, parsed.content),
  });

  await revalidatePost(post.id, post.type, post.categoryId);

  return {
    ok: true,
    id: published.id,
    slug: published.slug,
    callNumber: published.callNumber,
  };
});

export type DeletePostResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * 글 삭제 (02 §2.4 A-03).
 *
 * 되돌릴 수 없으므로 화면에서 두 번 눌러야 한다(components/admin/DeletePostButton).
 * 청구기호는 결번으로 남는다(05 §5) — 번호는 이력이지 카운트가 아니다.
 */
export const deletePost = withAdmin(async (_user, postId: string): Promise<DeletePostResult> => {
  const deleted = await deletePostRecord(postId);
  if (!deleted) return { ok: false, reason: "not-found" };

  // 지워진 글의 지면도 갱신해야 한다 — 목록에 남아 있으면 404로 가는 링크가 된다
  await revalidatePost(deleted.id, deleted.type, deleted.categoryId);

  return { ok: true };
});

/**
 * 무효화 (04 §1.2).
 *
 * M2에는 아직 캐시되는 공개 페이지가 없어 실효가 없지만, 태그 목록을 발행 경로에 붙여두어야
 * M3에서 지면을 만들 때 빠뜨리지 않는다.
 *
 * **`updateTag`를 쓴다**(ADR-003). `revalidateTag`는 stale-while-revalidate라 낡은 내용을 먼저
 * 보여주는데, 02 §3.2가 "발행 직후 공개 페이지로 이동"을 확정했으므로 그건 곧 신뢰 문제다 —
 * 방금 쓴 글을 보러 갔는데 옛 내용이 보이면 그게 결함이다. 실제로 코드 블록 언어를 고쳐 저장한
 * 뒤에도 지면이 그대로였다.
 *
 * updateTag는 Server Action 전용이고 이 파일의 모든 경로가 Server Action이다.
 */
async function revalidatePost(postId: string, type: RecordType, categoryId: string | null) {
  const [tagNames, categorySlug] = await Promise.all([
    findPostTagNames(postId),
    findCategorySlug(categoryId),
  ]);

  for (const tag of postRevalidationTags({ id: postId, type, categorySlug, tagNames })) {
    updateTag(tag);
  }
}
