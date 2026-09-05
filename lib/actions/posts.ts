"use server";

import { updateTag } from "next/cache";
import { headers } from "next/headers";

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
  unpublishPostRecord,
} from "@/lib/db/posts";
import { setPostTags } from "@/lib/db/tags";
import type { RecordType } from "@/lib/record/callNumber";
import { extractSearchText } from "@/lib/render/searchText";
import { postRevalidationTags, siteOf } from "@/lib/revalidate/tags";
import { submitToSearchEngines } from "@/lib/seo/submit";
import { absolutePostUrl, absoluteUrl } from "@/lib/site/publicUrl";
import { PostStatus } from "@/prisma/generated/enums";

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
  /**
   * `url`은 **도착지**다. 발행 화면은 루트 호스트의 `/admin`이고 글은 `faith.○`에 서므로,
   * 도메인이 붙은 뒤로는 지면 이동이 교차 출처다 — 경로만으로는 갈 수 없다. 그리고
   * 화면에서는 `SITE_HOST_*`를 읽을 수 없으니(NEXT_PUBLIC_이 아니다) 서버가 적어 보낸다
   */
  | { ok: true; id: string; slug: string; callNumber: number; url: string }
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
    // 최초 발행 시각을 넘긴다. 비공개로 내렸다가 다시 공개할 때 이 값이 없으면 발행일이
    // 오늘로 밀려, 옛 글이 목록 맨 위로 올라온다(05 §5 — 번호와 날짜는 이력이다)
    existingPublishedAt: post.publishedAt,
    // 검색용 평문은 발행 시 채운다(05 §4A)
    searchText: extractSearchText(post.title, parsed.content),
  });

  await revalidatePost(post.id, post.type, post.categoryId);
  await announce(post.type, published.slug);

  return {
    ok: true,
    id: published.id,
    slug: published.slug,
    callNumber: published.callNumber,
    url: absolutePostUrl(post.type, published.slug, { host: (await headers()).get("host") }),
  };
});

export type DiscardDraftResult = { ok: true } | { ok: false; reason: "not-found" | "published" };

/**
 * 빈 초안 버리기 — 서식(글의 종류)을 바꿀 때 쓴다 (02 §2.4).
 *
 * 서식은 저장 계약을 가르므로 내용이 있는 뒤에는 바꿀 수 없다. 아직 아무것도 안 적은
 * 초안이라면 그건 변경이 아니라 **처음 고르는 것**이고, 그때 남아 있던 빈 초안은 지운다 —
 * 초안함에 빈 껍데기가 쌓이면 "이어서 쓸 것"이라는 초안함의 질문이 흐려진다.
 *
 * **발행된 글은 지우지 않는다.** 비어 있는지는 화면이 판단하지만(폼 값을 아는 쪽이다),
 * "초안만"이라는 보장은 서버가 한다 — 화면의 판단이 틀려도 발행된 글이 사라지면 안 된다.
 */
export const discardDraft = withAdmin(
  async (_user, postId: string): Promise<DiscardDraftResult> => {
    const post = await findEditablePost(postId);
    if (!post) return { ok: false, reason: "not-found" };
    if (post.status !== PostStatus.DRAFT) return { ok: false, reason: "published" };

    await deletePostRecord(postId);
    // 초안은 공개 지면에 없다. 무효화할 것도, 검색엔진에 알릴 것도 없다
    return { ok: true };
  },
);

export type UnpublishPostResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "not-published" };

/**
 * 발행 취소 — 비공개로 내린다 (02 §2.4 A-03 · 04 §1.2).
 *
 * **PRIVATE은 공개 지면에서 없는 것과 같다**(조회 함수가 PUBLISHED만 본다). 404를 주고
 * 410은 쓰지 않는다 — 다시 공개할 글이기 때문이다.
 *
 * 청구기호·slug·최초 발행 시각은 그대로 둔다. 번호와 날짜는 카운트가 아니라 이력이고
 * (05 §5), 다시 공개할 때 같은 주소로 돌아와야 한다.
 *
 * **다시 공개하는 경로는 여기가 아니라 `publishPost`다.** status를 PUBLISHED로 바꾸는 길은
 * 발행 게이트 하나여야 한다(05 §3.4) — 여기서 되돌리면 스키마를 통과하지 않은 content가
 * 공개될 수 있다.
 */
export const unpublishPost = withAdmin(
  async (_user, postId: string): Promise<UnpublishPostResult> => {
    const post = await findEditablePost(postId);
    if (!post) return { ok: false, reason: "not-found" };

    // 초안은 내릴 것이 없다. 이 경로가 초안을 건드리면 초안함과 글 관리가 서로 다른 말을 한다
    if (post.status !== PostStatus.PUBLISHED) return { ok: false, reason: "not-published" };

    await unpublishPostRecord(postId);
    await revalidatePost(post.id, post.type, post.categoryId);

    // 검색엔진에도 알린다. 안 알리면 검색 결과에 404로 가는 링크가 한동안 남는다 —
    // 삭제와 같은 이유다
    if (post.slug) await announce(post.type, post.slug);

    return { ok: true };
  },
);

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

  // 삭제도 알린다. IndexNow는 사라진 페이지 통보를 규격에 포함한다 — 안 알리면 검색 결과에
  // 404로 가는 링크가 한동안 남는다
  if (deleted.slug) await announce(deleted.type, deleted.slug);

  return { ok: true };
});

/**
 * 검색엔진 통보 (06 §8).
 *
 * 글 주소와 **지면 홈**을 함께 보낸다. 목록이 바뀐 것도 색인되어야 하고, 삭제된 글은 그 글
 * 주소만 보내면 "없어졌다"만 알리고 "어디로 가야 하는지"는 못 알린다.
 *
 * 이 함수는 실패해도 조용하다(lib/seo/submit) — 발행은 이미 끝났다.
 */
async function announce(type: RecordType, slug: string) {
  const host = (await headers()).get("host");
  const site = siteOf(type);

  await submitToSearchEngines(site, [
    absolutePostUrl(type, slug, { host }),
    absoluteUrl(site, `/${site}`, { host }),
  ]);
}

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
