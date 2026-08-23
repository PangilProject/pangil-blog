import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { RecordType } from "@/lib/record/callNumber";
import { kstDateAsUtcMidnight, startOfKstDay } from "@/lib/record/kst";
import type { TodayCrawl, TodayPost } from "@/lib/record/todayCard";
import type { PostType } from "@/prisma/generated/enums";

/**
 * A-01 오늘의 작성 카드용 조회 (02 §3.1).
 *
 * "오늘 기록"의 기준은 **KST 자정 이후에 만들어진 글**이다. 크롤러가 새벽에 만든 초안도,
 * 밤에 손으로 시작한 글도 같은 기준에 들어온다. 발행 시각이 아니라 생성 시각으로 보는 이유는
 * 카드가 "오늘 쓸 것"을 가리키기 때문이다 — 아직 발행 안 한 글이 카드의 주인이다.
 *
 * 같은 타입을 하루에 두 번 쓴 날은 마지막에 만든 것을 카드에 올린다(그 편이 이어쓰기다).
 */
export async function findTodayPosts(
  types: RecordType[],
  now: Date,
): Promise<Map<RecordType, TodayPost>> {
  const rows = await prisma.post.findMany({
    where: {
      type: { in: types as PostType[] },
      createdAt: { gte: startOfKstDay(now) },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, status: true, title: true, createdAt: true, updatedAt: true },
  });

  const byType = new Map<RecordType, TodayPost>();
  for (const row of rows) {
    byType.set(row.type as RecordType, {
      id: row.id,
      status: row.status,
      title: row.title,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  return byType;
}

/** 오늘의 크롤 실행 (06 §2 — runDate가 멱등 키다). M4 이전에는 항상 null이다 */
export async function findTodayCrawl(now: Date): Promise<TodayCrawl | null> {
  const run = await prisma.crawlRun.findUnique({
    where: { runDate: kstDateAsUtcMidnight(now) },
    select: { status: true, postId: true, finishedAt: true },
  });

  return run ? { status: run.status, postId: run.postId } : null;
}
