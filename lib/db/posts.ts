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
  /** 최초 발행 시각. 재공개가 이 값을 밀면 목록에서 옛 글이 맨 위로 올라온다(05 §5) */
  publishedAt: Date | null;
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
  publishedAt: true,
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
  publishedAt: Date | null;
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

/**
 * slug로 글을 찾는다 — 공개 지면에서 에디터로 넘어오는 길에만 쓴다(A-03).
 *
 * 상태를 가리지 않는다. 내려둔 글(PRIVATE)을 고치러 오는 것도 같은 길이고, slug는
 * 발행 시점에 확정되므로 초안에는 아직 없다(05 §1.4).
 */
export async function findPostIdBySlug(
  slug: string,
): Promise<{ id: string; type: RecordType } | null> {
  const row = await prisma.post.findUnique({ where: { slug }, select: { id: true, type: true } });
  return row ? { id: row.id, type: row.type as RecordType } : null;
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

/**
 * 비공개로 내린다 (05 §3.4의 반대 방향).
 *
 * status만 바꾼다. 청구기호·slug·publishedAt·searchText는 손대지 않는다 — 다시 공개할 때
 * 같은 주소·같은 번호·같은 날짜로 돌아와야 한다.
 */
export async function unpublishPostRecord(id: string): Promise<void> {
  await prisma.post.update({ where: { id }, data: { status: PostStatus.PRIVATE } });
}

/** A-03 글 관리 한 페이지 (02 §2.4). 초안함과 달리 749편을 다룬다 */
export const ADMIN_PAGE_SIZE = 20;

export type AdminPostQuery = {
  /** 타입 축 — faith의 분류는 타입이다(02 §5) */
  type?: RecordType | null;
  /** 카테고리 축 — TECH 전용 분류다(02 §5.5) */
  categorySlug?: string | null;
  page?: number;
};

/**
 * A-03 글 관리 목록 (02 §2.4).
 *
 * **초안은 넣지 않는다.** 초안은 초안함(A-02)이 맡고, 그쪽은 "이어서 쓸 것"이라는 다른
 * 질문에 답한다. 한 목록이 두 질문에 답하면 749편 사이에서 오늘 쓰던 초안을 찾게 된다.
 *
 * PRIVATE은 남긴다 — 발행했다가 내린 글이고, 여기서 빠지면 어디에서도 보이지 않는다.
 */
export async function listAdminPosts({
  type = null,
  categorySlug = null,
  page = 1,
}: AdminPostQuery = {}) {
  const current = Math.max(Math.trunc(page) || 1, 1);

  const where = {
    status: { not: PostStatus.DRAFT },
    ...(type ? { type: type as PostType } : {}),
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      skip: (current - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        type: true,
        status: true,
        title: true,
        callNumber: true,
        publishedAt: true,
        updatedAt: true,
        category: { select: { name: true } },
      },
    }),
    prisma.post.count({ where }),
  ]);

  return {
    posts: rows.map((row) => ({
      ...row,
      type: row.type as RecordType,
      categoryName: row.category?.name ?? null,
    })),
    page: current,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
    total,
  };
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

export type DeletedPost = {
  id: string;
  type: RecordType;
  categoryId: string | null;
  callNumber: number | null;
  /** 검색엔진에 "이 주소는 사라졌다"를 알리는 데 쓴다(06 §8). 초안이면 null */
  slug: string | null;
};

/**
 * 글 삭제 (02 §2.4 A-03).
 *
 * 청구기호 카운터는 되돌리지 않는다 — **삭제 시 결번을 허용한다**(05 §5). 번호는 이력이지
 * 카운트가 아니므로 재사용하면 옛 링크와 기록이 어긋난다.
 *
 * PostTag는 스키마에서 cascade로 지워지고, Asset·CrawlRun의 postId는 null이 된다.
 * 통계(StatEvent)는 FK가 없어 그대로 남는다 — 글 삭제가 과거 통계를 지우면 안 된다(05 §1.4).
 *
 * 삭제 대상을 먼저 읽어 돌려주는 이유는 호출자가 무효화 태그를 계산해야 하기 때문이다(04 §1.2).
 */
export async function deletePostRecord(id: string): Promise<DeletedPost | null> {
  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, type: true, categoryId: true, callNumber: true, slug: true },
  });

  if (!post) return null;

  await prisma.post.delete({ where: { id } });

  return { ...post, type: post.type as RecordType };
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
