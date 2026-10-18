import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * 논리 백업 (06 §8 "DB 정기 백업 export" · 프리모템 데이터 소실 방어).
 *
 * pg_dump가 아니라 **행을 그대로 읽어 JSON으로 적는다.** 서버리스 런타임에는 pg_dump가
 * 없고, 무엇보다 우리가 잃으면 안 되는 것은 스키마가 아니라 **글**이다. content JSONB를
 * 원본 그대로 담으므로 스키마가 바뀐 뒤에도 읽을 수 있다.
 *
 * 통계(StatEvent)는 빼둔다 — 로그성이고 커지기만 하며, 잃어도 글이 아니다.
 * 이미지는 Storage에 이미 있으므로 메타데이터만 담는다.
 */

export type DatabaseBackup = {
  kind: "full";
  exportedAt: string;
  /** 복원 시 이 값으로 무엇을 기대할지 판단한다 */
  counts: Record<string, number>;
  posts: unknown[];
  categories: unknown[];
  tags: unknown[];
  postTags: unknown[];
  callNumberCounters: unknown[];
  crawlRuns: unknown[];
  assets: unknown[];
};

export async function dumpDatabase(now = new Date()): Promise<DatabaseBackup> {
  const [posts, categories, tags, postTags, callNumberCounters, crawlRuns, assets] =
    await Promise.all([
      prisma.post.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.category.findMany({ orderBy: { slug: "asc" } }),
      prisma.tag.findMany({ orderBy: { name: "asc" } }),
      prisma.postTag.findMany(),
      prisma.callNumberCounter.findMany(),
      prisma.crawlRun.findMany({ orderBy: { runDate: "asc" } }),
      prisma.asset.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

  return {
    kind: "full",
    exportedAt: now.toISOString(),
    counts: {
      posts: posts.length,
      categories: categories.length,
      tags: tags.length,
      postTags: postTags.length,
      callNumberCounters: callNumberCounters.length,
      crawlRuns: crawlRuns.length,
      assets: assets.length,
    },
    posts,
    categories,
    tags,
    postTags,
    callNumberCounters,
    crawlRuns,
    assets,
  };
}

/**
 * 변경분 백업 — 기준 전체 이후 바뀐 글만 담는다 (2026-10 Egress 회차, `lib/storage/backups`).
 *
 * 무거운 것은 글 본문뿐이라 **글만 줄인다.** 나머지 테이블은 통째로 담아도 작고(태그·자산
 * 메타데이터·크롤 기록), 줄이려 들면 복원이 그만큼 까다로워진다.
 *
 * **복원하는 법** — 기준 전체 한 장 + 이 변경분 한 장:
 * 1. 전체의 `posts`에서 `postIds`에 없는 글을 버린다(그 사이 지운 글)
 * 2. 이 파일의 `posts`로 같은 id를 덮어쓴다(그 사이 바뀌거나 새로 생긴 글)
 * 3. 나머지 테이블은 이 파일의 것을 그대로 쓴다
 */
export type DatabaseDelta = {
  kind: "delta";
  exportedAt: string;
  /** 기준 전체 백업의 날짜 — 이 변경분은 그 파일 위에 덧대야 읽힌다 */
  base: string;
  /** 이 시각 이후 `updatedAt`이 바뀐 글을 담았다 */
  since: string;
  counts: Record<string, number>;
  /** 지금 있는 글 전부의 id — 기준 이후 지워진 글을 가려낸다 */
  postIds: string[];
  posts: unknown[];
  categories: unknown[];
  tags: unknown[];
  postTags: unknown[];
  callNumberCounters: unknown[];
  crawlRuns: unknown[];
  assets: unknown[];
};

export async function dumpChanges(
  base: string,
  since: Date,
  now = new Date(),
): Promise<DatabaseDelta> {
  const [postIds, posts, categories, tags, postTags, callNumberCounters, crawlRuns, assets] =
    await Promise.all([
      prisma.post.findMany({ select: { id: true }, orderBy: { createdAt: "asc" } }),
      prisma.post.findMany({ where: { updatedAt: { gte: since } }, orderBy: { createdAt: "asc" } }),
      prisma.category.findMany({ orderBy: { slug: "asc" } }),
      prisma.tag.findMany({ orderBy: { name: "asc" } }),
      prisma.postTag.findMany(),
      prisma.callNumberCounter.findMany(),
      prisma.crawlRun.findMany({ orderBy: { runDate: "asc" } }),
      prisma.asset.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

  return {
    kind: "delta",
    exportedAt: now.toISOString(),
    base,
    since: since.toISOString(),
    counts: {
      postIds: postIds.length,
      posts: posts.length,
      categories: categories.length,
      tags: tags.length,
      postTags: postTags.length,
      callNumberCounters: callNumberCounters.length,
      crawlRuns: crawlRuns.length,
      assets: assets.length,
    },
    postIds: postIds.map((row) => row.id),
    posts,
    categories,
    tags,
    postTags,
    callNumberCounters,
    crawlRuns,
    assets,
  };
}
