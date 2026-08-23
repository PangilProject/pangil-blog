import "server-only";

import { cacheTag } from "next/cache";

import type { PostContent } from "@/lib/content/schema";
import { type ContentParseResult, parsePublishContent } from "@/lib/db/content";
import { prisma } from "@/lib/db/prisma";
import type { RecordType } from "@/lib/record/callNumber";
import { type PublicSite, postTag } from "@/lib/revalidate/tags";
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
    updatedAt: row.updatedAt,
    excerpt: row.excerpt,
    thumbnailUrl: row.thumbnailUrl,
    categoryName: row.category?.name ?? null,
    categorySlug: row.category?.slug ?? null,
    tags: row.tags.map((entry) => entry.tag.name),
    content: parsePublishContent(row.content),
  };
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
    siteLabel: type === "TECH" ? "개발의 기록" : "믿음의 기록",
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
