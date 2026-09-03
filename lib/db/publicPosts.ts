import "server-only";

import { cacheTag } from "next/cache";

import type { PostContent } from "@/lib/content/schema";
import { type ContentParseResult, parsePublishContent } from "@/lib/db/content";
import { prisma } from "@/lib/db/prisma";
import type { RecordType } from "@/lib/record/callNumber";
import { listTag, type PublicSite, postTag, siteOf } from "@/lib/revalidate/tags";
import { blogBrandName } from "@/lib/site/brand";
import { PostStatus, type PostType } from "@/prisma/generated/enums";

/**
 * 공개 지면의 조회 경계 (04 §1.2 · ADR-003).
 *
 * `use cache`로 감싸고 `cacheTag`를 붙인다 — 발행·수정·삭제가 그 태그를 만료시킨다.
 * 캐시 밖으로 나가는 것은 Zod를 통과한 값이거나, 통과하지 못했다는 사실이다(ADR-002).
 *
 * **PUBLISHED만 조회한다.** PRIVATE·DRAFT는 공개 지면에서 없는 것과 같다(04 §1.2 —
 * PRIVATE 전환은 단순 404). 상태 조건을 라우트가 아니라 이 함수에 두는 이유는, 라우트가
 * 늘어날 때마다 조건을 다시 적으면 한 곳에서 빠뜨리기 때문이다.
 */

export type PublicPost = {
  id: string;
  type: RecordType;
  title: string;
  slug: string;
  callNumber: number | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  excerpt: string | null;
  thumbnailUrl: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  tags: string[];
  content: ContentParseResult<PostContent>;
};

const DETAIL_SELECT = {
  id: true,
  type: true,
  title: true,
  slug: true,
  callNumber: true,
  publishedAt: true,
  // 목록과 같은 동순위 규칙(publishedAt, createdAt)으로 이웃을 고르려면 필요하다
  createdAt: true,
  updatedAt: true,
  excerpt: true,
  thumbnailUrl: true,
  content: true,
  category: { select: { name: true, slug: true } },
  tags: { select: { tag: { select: { name: true } } } },
} as const;

/** 그 지면에 속한 타입만 (dev = TECH, faith = 나머지) — siteOf의 역함수다 */
const TYPES_BY_SITE: Record<PublicSite, PostType[]> = {
  dev: ["TECH"],
  faith: ["QT", "SERMON", "PRAISE"],
};

export async function findPublishedPostBySlug(
  site: PublicSite,
  slug: string,
): Promise<PublicPost | null> {
  "use cache";

  const row = await prisma.post.findFirst({
    where: { slug, status: PostStatus.PUBLISHED, type: { in: TYPES_BY_SITE[site] } },
    select: DETAIL_SELECT,
  });

  if (!row) return null;

  // 글 하나의 태그. 발행·수정·삭제가 이 태그를 만료시킨다(04 §1.2)
  cacheTag(postTag(row.id));

  const type = row.type as RecordType;

  return {
    id: row.id,
    type,
    title: row.title,
    // where 조건이 PUBLISHED라 slug는 채워져 있다
    slug: row.slug ?? slug,
    callNumber: row.callNumber,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    excerpt: row.excerpt,
    thumbnailUrl: row.thumbnailUrl,
    categoryName: row.category?.name ?? null,
    categorySlug: row.category?.slug ?? null,
    tags: row.tags.map((entry) => entry.tag.name),
    content: parsePublishContent(row.content),
  };
}

/**
 * 이전글·다음글 (F-03).
 *
 * **어느 축의 앞뒤인지가 이 기능의 전부다.** 목록 상단 탭이 나누는 그 축을 쓴다 —
 * faith는 타입(큐티·설교·찬양, 02 §5), dev는 카테고리(TECH 전용 분류, 02 §5.5).
 * 그래서 설교를 읽던 사람은 설교로, FE 글을 읽던 사람은 FE로 이어진다.
 *
 * 축을 인자로 받는 이유는 faith에 언젠가 타입과 별개의 카테고리가 생길 수 있기 때문이다
 * (A-08 카테고리 관리). 그때 이 함수가 아니라 부르는 쪽만 바뀐다.
 *
 * 들어온 문맥(검색·태그)은 쓰지 않는다. 정적으로 렌더되는 지면이라 어디서 왔는지를 알 수
 * 없고, URL에 실어 보내면 그 조합마다 캐시가 갈라진다(04 §1.2).
 *
 * 동순위 규칙은 목록과 같다(publishedAt, createdAt). 같은 날 두 편을 올린 날이 있고,
 * 규칙이 갈리면 목록에서 옆에 있던 글이 이전글에서는 건너뛰어진다.
 */
export type PostNeighbor = { title: string; slug: string; type: RecordType };

export type NeighborAxis =
  | { kind: "type"; type: RecordType }
  | { kind: "category"; categorySlug: string }
  /** 축이 없는 글(카테고리 없는 기술 글) — 지면 전체에서 잇는다 */
  | { kind: "site" };

export async function findNeighbors(
  site: PublicSite,
  axis: NeighborAxis,
  current: { id: string; publishedAt: Date | null; createdAt: Date },
): Promise<{ previous: PostNeighbor | null; next: PostNeighbor | null }> {
  "use cache";

  // 발행 시각이 없는 글은 이웃을 셀 기준이 없다. PUBLISHED에는 늘 있지만 타입은 null을 허용한다
  if (!current.publishedAt) return { previous: null, next: null };

  const published = current.publishedAt;

  const axisWhere =
    axis.kind === "type"
      ? { type: axis.type as PostType }
      : axis.kind === "category"
        ? { category: { slug: axis.categorySlug } }
        : { type: { in: TYPES_BY_SITE[site] } };

  const base = {
    status: PostStatus.PUBLISHED,
    type: { in: TYPES_BY_SITE[site] },
    id: { not: current.id },
    ...axisWhere,
  };

  const select = { title: true, slug: true, type: true } as const;

  const [previous, next] = await Promise.all([
    prisma.post.findFirst({
      where: {
        ...base,
        OR: [
          { publishedAt: { lt: published } },
          { publishedAt: published, createdAt: { lt: current.createdAt } },
        ],
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select,
    }),
    prisma.post.findFirst({
      where: {
        ...base,
        OR: [
          { publishedAt: { gt: published } },
          { publishedAt: published, createdAt: { gt: current.createdAt } },
        ],
      },
      orderBy: [{ publishedAt: "asc" }, { createdAt: "asc" }],
      select,
    }),
  ]);

  // 새 글이 발행되면 이 지면의 목록 태그가 만료된다 — 이웃도 그때 함께 다시 계산된다
  cacheTag(postTag(current.id), listTag(site));

  const toNeighbor = (row: typeof previous): PostNeighbor | null =>
    row?.slug ? { title: row.title, slug: row.slug, type: row.type as RecordType } : null;

  return { previous: toNeighbor(previous), next: toNeighbor(next) };
}

export type OgCard = {
  type: RecordType;
  title: string;
  /** 말씀 범위(faith) 또는 요약 한 줄(dev) */
  subtitle: string | null;
  callNumber: number | null;
  categoryName: string | null;
  /** "2026년 8월 23일" */
  publishedAt: string | null;
  siteLabel: string;
  typeLabel: string;
};

const OG_TYPE_LABELS: Record<RecordType, string> = {
  QT: "큐티",
  SERMON: "설교",
  PRAISE: "찬양",
  TECH: "기술",
};

/**
 * OG 카드에 필요한 것만 (04 §3.5).
 *
 * 상세 조회를 재사용하지 않는 이유는 content 전체를 스키마로 통과시킬 필요가 없기 때문이다 —
 * 카드에 들어가는 건 제목·부제 한 줄·청구기호뿐이다. 이미지 생성은 자주 불리므로 가볍게 둔다.
 */
export async function findOgCard(id: string): Promise<OgCard | null> {
  "use cache";

  const row = await prisma.post.findFirst({
    where: { id, status: PostStatus.PUBLISHED },
    select: {
      type: true,
      title: true,
      callNumber: true,
      excerpt: true,
      publishedAt: true,
      content: true,
      category: { select: { name: true } },
    },
  });

  if (!row) return null;

  cacheTag(postTag(id));

  const type = row.type as RecordType;
  const scriptureRef = (row.content as { scriptureRef?: unknown } | null)?.scriptureRef;

  return {
    type,
    title: row.title,
    subtitle:
      typeof scriptureRef === "string" && scriptureRef.trim() !== ""
        ? scriptureRef
        : (row.excerpt ?? null),
    callNumber: row.callNumber,
    categoryName: row.category?.name ?? null,
    publishedAt: row.publishedAt
      ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" }).format(
          row.publishedAt,
        )
      : null,
    siteLabel: blogBrandName(siteOf(type)),
    typeLabel: OG_TYPE_LABELS[type],
  };
}

export type ExportPost = {
  id: string;
  type: RecordType;
  title: string;
  slug: string;
  callNumber: number | null;
  publishedAt: Date | null;
  updatedAt: Date;
  excerpt: string | null;
  categorySlug: string | null;
  tags: string[];
  content: ContentParseResult<PostContent>;
};

/**
 * 마크다운 export용 전량 조회 (07 M3 · §3 lock-in 방어).
 *
 * 발행된 글만 내보낸다 — 초안은 아직 글이 아니다. 캐시하지 않는다: 손으로 한 번 누르는
 * 내보내기이고, 그 순간의 진실이 필요하다.
 */
export async function findPostsForExport(): Promise<ExportPost[]> {
  const rows = await prisma.post.findMany({
    where: { status: PostStatus.PUBLISHED },
    orderBy: [{ publishedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      type: true,
      title: true,
      slug: true,
      callNumber: true,
      publishedAt: true,
      updatedAt: true,
      excerpt: true,
      content: true,
      category: { select: { slug: true } },
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type as RecordType,
    title: row.title,
    slug: row.slug ?? row.id,
    callNumber: row.callNumber,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    excerpt: row.excerpt,
    categorySlug: row.category?.slug ?? null,
    tags: row.tags.map((entry) => entry.tag.name),
    content: parsePublishContent(row.content),
  }));
}
