import "server-only";

import { cacheTag } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { FAITH_TYPES, TYPE_LABELS } from "@/lib/record/axis";
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

export type FeedItem = {
  id: string;
  type: RecordType;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
};

/**
 * 피드·sitemap용 전체 목록 (07 M3 · 04 §1.2 S-01/02).
 *
 * **요약과 링크만 싣는다**(07 M3 확정) — 본문 전문을 피드에 넣으면 리더에서 다 읽히고 지면으로
 * 오지 않는다. 조판이 이 블로그의 절반이므로 그건 손해다.
 *
 * 페이지네이션이 없다. sitemap은 전부 실어야 하고 RSS는 최근 것만 자르므로 호출자가 자른다.
 */
export async function findFeedItems(site: PublicSite, limit?: number): Promise<FeedItem[]> {
  "use cache";

  cacheTag(feedTag(site));
  cacheTag(listTag(site));

  const rows = await prisma.post.findMany({
    where: { status: PostStatus.PUBLISHED, type: { in: TYPES_BY_SITE[site] } },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    ...(limit ? { take: limit } : {}),
    select: {
      id: true,
      type: true,
      title: true,
      slug: true,
      excerpt: true,
      publishedAt: true,
      updatedAt: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type as RecordType,
    title: row.title,
    slug: row.slug ?? "",
    excerpt: row.excerpt,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
  }));
}

export type AxisCount = {
  /** faith는 타입 코드(`QT`), dev는 카테고리 주소(`frontend`) */
  key: string;
  name: string;
  count: number;
};

/**
 * 사이드바의 분류 목록 (03 §5.1 사이드바 · 02 §5).
 *
 * **지면마다 축이 다르다**(lib/record/axis): faith는 타입, dev는 카테고리 행. 그래서 조회도
 * 갈리지만 화면이 받는 모양은 하나여야 한다 — 사이드바를 두 벌로 두면 그중 하나만 낡는다.
 *
 * faith의 셋은 **글이 없어도 남긴다.** 그건 데이터가 아니라 이 지면의 구성이라, 찬양을 한
 * 주 쉬었다고 칸이 사라지면 목록의 뼈대가 흔들린다. dev의 카테고리는 반대다 — 행이므로
 * 비어 있으면 그냥 아직 안 쓴 분류이고, 빈 칸막이는 "이 칸은 아직 비어 있어요"를 부르는
 * 자리만 만든다.
 */
export async function findAxisCounts(site: PublicSite): Promise<AxisCount[]> {
  "use cache";

  cacheTag(listTag(site));

  if (site === "dev") {
    const rows = await prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        name: true,
        slug: true,
        _count: { select: { posts: { where: { status: PostStatus.PUBLISHED } } } },
      },
    });

    return rows
      .map((row) => ({ key: row.slug, name: row.name, count: row._count.posts }))
      .filter((row) => row.count > 0);
  }

  const rows = await prisma.post.groupBy({
    by: ["type"],
    where: { status: PostStatus.PUBLISHED, type: { in: TYPES_BY_SITE.faith } },
    _count: { _all: true },
  });

  const byType = new Map(rows.map((row) => [row.type as RecordType, row._count._all]));

  return FAITH_TYPES.map((type) => ({
    key: type,
    name: TYPE_LABELS[type],
    count: byType.get(type) ?? 0,
  }));
}
