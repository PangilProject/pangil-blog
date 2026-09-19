import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { RecordType } from "@/lib/record/callNumber";
import {
  countKstDays,
  kstDateAsUtcMidnight,
  startOfKstDay,
  startOfKstMonth,
  startOfKstWeek,
} from "@/lib/record/kst";
import { TYPES_BY_SITE } from "@/lib/record/listQuery";
import type { TodayCrawl, TodayPost } from "@/lib/record/todayCard";
import { PostStatus, type PostType } from "@/prisma/generated/enums";

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

export type WritingPace = {
  /** 이번 주에 **발행한 날**의 수. 하루에 몇 편을 쓰든 1이다 */
  daysThisWeek: number;
  /** 이번 달 발행 장수 */
  postsThisMonth: number;
};

/**
 * 얼마나 쓰고 있나 (A-01 · 00 §4.1 ①작성 마찰).
 *
 * **묵상 지면만 센다.** 오늘의 카드가 묻는 것이 큐티·설교·찬양이고, 그 셋이 매일의 루틴이다.
 * 기술 글은 비정기라(허브 카드가 그렇게 적는다) 같은 분모로 셀 수 없다.
 *
 * **날을 세지 장수를 세지 않는다.** 매일 몫이라는 기대치(`todayCard`)에 답하는 숫자는
 * "며칠 썼나"이지 "몇 편 썼나"가 아니다 — 하루에 세 편을 몰아 써도 그날은 하루다.
 *
 * `use cache`를 쓰지 않는다. 관리 화면은 요청마다 지금을 봐야 하고(ADR-003), 이 숫자는
 * 방금 발행한 글을 곧바로 반영해야 한다 — 캐시에 굳으면 쓴 다음에도 안 올라간다.
 */
export async function findWritingPace(now: Date): Promise<WritingPace> {
  const [thisWeek, postsThisMonth] = await Promise.all([
    prisma.post.findMany({
      where: {
        // 목록·사이드바가 쓰는 그 목록이다. 베껴 두면 한쪽만 고쳐지는 날이 온다
        type: { in: TYPES_BY_SITE.faith },
        status: PostStatus.PUBLISHED,
        publishedAt: { gte: startOfKstWeek(now) },
      },
      select: { publishedAt: true },
    }),
    prisma.post.count({
      where: {
        // 목록·사이드바가 쓰는 그 목록이다. 베껴 두면 한쪽만 고쳐지는 날이 온다
        type: { in: TYPES_BY_SITE.faith },
        status: PostStatus.PUBLISHED,
        publishedAt: { gte: startOfKstMonth(now) },
      },
    }),
  ]);

  return { daysThisWeek: countKstDays(thisWeek.map((row) => row.publishedAt)), postsThisMonth };
}
