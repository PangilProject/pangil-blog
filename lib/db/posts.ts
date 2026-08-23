import "server-only";

import type { DraftContent, PostContent } from "@/lib/content/schema";
import { ensureCallNumber } from "@/lib/db/callNumber";
import { type ContentParseResult, parseDraftContent } from "@/lib/db/content";
import { prisma } from "@/lib/db/prisma";
import type { RecordType } from "@/lib/record/callNumber";
import { deriveSlug, findAvailableSlug } from "@/lib/record/slug";
import { PostStatus, type PostType } from "@/prisma/generated/enums";

/**
 * posts 리포지토리 — Json 경계의 안쪽 (ADR-002).
 *
 * 이 파일 밖으로 Prisma의 Json 원시 타입이 나가지 않는다. 밖으로 나가는 것은 항상
 * Zod를 통과한 값이거나, 통과하지 못했다는 사실(ContentParseResult)이다.
 */

/** 에디터가 필요한 만큼만 읽는다 */
export type EditablePost = {
  id: string;
  type: RecordType;
  status: PostStatus;
  title: string;
  slug: string | null;
  callNumber: number | null;
  categoryId: string | null;
  excerpt: string | null;
  thumbnailUrl: string | null;
  updatedAt: Date;
  content: ContentParseResult<DraftContent>;
};

const EDITABLE_SELECT = {
  id: true,
  type: true,
  status: true,
  title: true,
  slug: true,
  callNumber: true,
  categoryId: true,
  excerpt: true,
  thumbnailUrl: true,
  updatedAt: true,
  content: true,
} as const;

function toEditablePost(row: {
  id: string;
  type: PostType;
  status: PostStatus;
  title: string;
  slug: string | null;
  callNumber: number | null;
  categoryId: string | null;
  excerpt: string | null;
  thumbnailUrl: string | null;
  updatedAt: Date;
  content: unknown;
}): EditablePost {
  return {
    ...row,
    type: row.type as RecordType,
    content: parseDraftContent(row.content),
  };
}

export async function findEditablePost(id: string): Promise<EditablePost | null> {
  const row = await prisma.post.findUnique({ where: { id }, select: EDITABLE_SELECT });
  return row ? toEditablePost(row) : null;
}

/** A-02 초안함 (02 §2.4) — 최근 수정 순 */
export async function listDrafts(limit = 50) {
  const rows = await prisma.post.findMany({
    where: { status: PostStatus.DRAFT },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, type: true, title: true, updatedAt: true },
  });

  return rows.map((row) => ({ ...row, type: row.type as RecordType }));
}

/** A-03 글 관리 (02 §2.4) — 상태 무관 최신순 */
export async function listAdminPosts(limit = 100) {
  const rows = await prisma.post.findMany({
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take: limit,
    select: {
      id: true,
      type: true,
      status: true,
      title: true,
      callNumber: true,
      publishedAt: true,
      updatedAt: true,
    },
  });

  return rows.map((row) => ({ ...row, type: row.type as RecordType }));
}

export type CreateDraftInput = {
  type: RecordType;
  title: string;
  content: DraftContent;
};

export async function createDraft({ type, title, content }: CreateDraftInput) {
  return prisma.post.create({
    data: { type: type as PostType, title, content, status: PostStatus.DRAFT },
    select: { id: true, updatedAt: true },
  });
}

export type SaveDraftInput = {
  id: string;
  title?: string;
  content: DraftContent;
  /** TECH 전용 메타 */
  categoryId?: string | null;
  excerpt?: string | null;
  thumbnailUrl?: string | null;
};

/**
 * 자동 저장의 쓰기 지점 (04 §2.2 upsertDraft).
 * DRAFT뿐 아니라 발행된 글의 수정 저장도 같은 경로를 쓴다 — 수정 저장 = 즉시 공개 반영이고,
 * 무효화는 호출하는 Server Action이 담당한다.
 */
export async function saveDraft({ id, ...rest }: SaveDraftInput) {
  return prisma.post.update({
    where: { id },
    data: rest,
    select: { id: true, updatedAt: true, status: true },
  });
}

export type PublishResult = {
  id: string;
  slug: string;
  callNumber: number;
  status: PostStatus;
  publishedAt: Date;
};

export type PublishInput = {
  id: string;
  type: RecordType;
  title: string;
  /** PublishSchema를 통과한 content (05 §3.4) */
  content: PostContent;
  existingCallNumber: number | null;
  existingSlug: string | null;
  existingPublishedAt: Date | null;
  searchText: string;
};

/**
 * 발행 트랜잭션 (05 §3.4 · §5).
 *
 * 청구기호 부여와 상태 전환이 한 트랜잭션 안에 있어야 결번·중복번호가 생기지 않는다.
 * status를 PUBLISHED로 바꾸는 코드 경로는 이것뿐이고, 크롤러 토큰으로는 도달할 수 없다.
 */
export async function publishPostRecord({
  id,
  type,
  title,
  content,
  existingCallNumber,
  existingSlug,
  existingPublishedAt,
  searchText,
}: PublishInput): Promise<PublishResult> {
  return prisma.$transaction(async (tx) => {
    const callNumber = await ensureCallNumber(tx, type, existingCallNumber);

    // 이미 slug가 있으면 유지한다 — 발행된 URL은 바뀌면 안 된다
    const slug =
      existingSlug ??
      (await findAvailableSlug(deriveSlug({ type, callNumber, title }), async (candidate) => {
        const taken = await tx.post.findFirst({
          where: { slug: candidate, NOT: { id } },
          select: { id: true },
        });
        return taken !== null;
      }));

    // 최초 발행 시각만 기록한다. 재공개가 날짜를 밀면 이력이 어긋난다
    const publishedAt = existingPublishedAt ?? new Date();

    const updated = await tx.post.update({
      where: { id },
      data: {
        status: PostStatus.PUBLISHED,
        title,
        content,
        callNumber,
        slug,
        publishedAt,
        searchText,
      },
      select: { id: true, slug: true, callNumber: true, status: true, publishedAt: true },
    });

    // 스키마상 nullable이지만 이 트랜잭션이 방금 채웠다
    if (updated.slug === null || updated.callNumber === null || updated.publishedAt === null) {
      throw new Error("발행 트랜잭션이 slug·청구기호·발행 시각을 남기지 못했습니다.");
    }

    return {
      id: updated.id,
      slug: updated.slug,
      callNumber: updated.callNumber,
      status: updated.status,
      publishedAt: updated.publishedAt,
    };
  });
}

/** 태그 이름 목록 — 무효화 태그 계산에 쓴다(04 §1.2) */
export async function findPostTagNames(postId: string): Promise<string[]> {
  const rows = await prisma.postTag.findMany({
    where: { postId },
    select: { tag: { select: { name: true } } },
  });

  return rows.map((row) => row.tag.name);
}

/** TECH 카테고리 slug — dev 목록 facet 무효화에 쓴다 */
export async function findCategorySlug(categoryId: string | null): Promise<string | null> {
  if (!categoryId) return null;

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { slug: true },
  });

  return category?.slug ?? null;
}
