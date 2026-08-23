import "server-only";

import { cacheTag } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import type { RecordType } from "@/lib/record/callNumber";
import {
  type ListQuery,
  listCacheTags,
  listWhere,
  PAGE_SIZE,
  TYPES_BY_SITE,
} from "@/lib/record/listQuery";
import { feedTag, listTag, type PublicSite } from "@/lib/revalidate/tags";
import { PostStatus } from "@/prisma/generated/enums";

export type { ListQuery } from "@/lib/record/listQuery";
export { PAGE_SIZE } from "@/lib/record/listQuery";

/**
 * 공개 목록 조회 (02 §2.2·§2.3 · 04 §1.2).
 *
 * 목록·타입별·태그별·카테고리별·검색이 **한 함수**를 공유한다. 조건만 다르고 나머지(정렬,
 * 페이지네이션, PUBLISHED 강제, 카드에 필요한 필드)는 같기 때문이다 — 다섯 벌로 두면 그중
 * 하나에서 PRIVATE 글이 새거나 정렬이 어긋난다.
 *
 * 정렬은 **순수 최신순**이다(02 §2.3 확정, 2026-08-18 결정 로그). 작성 순서가 요일·상황에 따라
 * 유동적이라 상단 고정·그룹핑을 두지 않는다.
 */

export type ListCard = {
  id: string;
  type: RecordType;
  title: string;
  slug: string;
  callNumber: number | null;
  publishedAt: Date | null;
  excerpt: string | null;
  thumbnailUrl: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  /** faith 카드의 부제 — 말씀 범위 */
  scriptureRef: string | null;
  tags: string[];
};

export type ListPage = {
  cards: ListCard[];
  total: number;
  /** 1부터 */
  page: number;
  pageCount: number;
};

const CARD_SELECT = {
  id: true,
  type: true,
  title: true,
  slug: true,
  callNumber: true,
  publishedAt: true,
  excerpt: true,
  thumbnailUrl: true,
  content: true,
  category: { select: { name: true, slug: true } },
  tags: { select: { tag: { select: { name: true } } } },
} as const;

/**
 * 카드 부제로 쓸 말씀 범위. content 전체를 스키마로 통과시키지 않는 유일한 자리다 —
 * 목록은 수십 건이고 카드에 필요한 건 한 줄뿐이다. 없으면 없는 대로 그린다(ADR-002 근거 6).
 */
function scriptureRefOf(content: unknown): string | null {
  if (!content || typeof content !== "object") return null;
  const value = (content as { scriptureRef?: unknown }).scriptureRef;
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export async function findPublishedPosts(query: ListQuery): Promise<ListPage> {
  "use cache";

  for (const tag of listCacheTags(query)) cacheTag(tag);

  const page = Math.max(1, query.page ?? 1);
  const where = listWhere(query);

  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where,
      // 순수 최신순. 발행 시각이 같으면 만든 순서로 가른다
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: CARD_SELECT,
    }),
    prisma.post.count({ where }),
  ]);

  return {
    cards: rows.map((row) => ({
      id: row.id,
      type: row.type as RecordType,
      title: row.title,
      slug: row.slug ?? "",
      callNumber: row.callNumber,
      publishedAt: row.publishedAt,
      excerpt: row.excerpt,
      thumbnailUrl: row.thumbnailUrl,
      categoryName: row.category?.name ?? null,
      categorySlug: row.category?.slug ?? null,
      scriptureRef: scriptureRefOf(row.content),
      tags: row.tags.map((entry) => entry.tag.name),
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export type RecordCounts = { thisMonth: number; total: number };

/**
 * "이번 달 N장 · 통산 N장" (03 §5.1) — 통계 UI 없이 동기를 만드는 자리.
 * 달 경계는 KST다(lib/record/kst와 같은 규칙).
 */
export async function countPublishedPosts(
  site: PublicSite,
  monthStart: Date,
): Promise<RecordCounts> {
  "use cache";

  cacheTag(listTag(site));
  cacheTag(feedTag(site));

  const where = { status: PostStatus.PUBLISHED, type: { in: TYPES_BY_SITE[site] } };

  const [thisMonth, total] = await Promise.all([
    prisma.post.count({ where: { ...where, publishedAt: { gte: monthStart } } }),
    prisma.post.count({ where }),
  ]);

  return { thisMonth, total };
}

/** dev 카테고리 필터에 쓸 목록 — 글이 있는 카테고리만 (빈 칸막이를 만들지 않는다) */
export async function findUsedCategories(): Promise<{ name: string; slug: string }[]> {
  "use cache";

  cacheTag(listTag("dev"));

  const rows = await prisma.category.findMany({
    where: { posts: { some: { status: PostStatus.PUBLISHED } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true, slug: true },
  });

  return rows;
}
