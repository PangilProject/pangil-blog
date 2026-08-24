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
