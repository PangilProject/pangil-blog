import "server-only";

import { prisma } from "@/lib/db/prisma";
import { kstDateAsUtcMidnight, startOfKstDay } from "@/lib/record/kst";
import { referrerHost } from "@/lib/stats/referrer";
import { CrawlStatus, PostStatus } from "@/prisma/generated/enums";

/**
 * 주간 요약 집계 (06 §8 백로그 3·10 흡수).
 *
 * statSummary와 같은 규칙을 쓴다 — KST 경계(`+ interval '9 hours'`), `NOT "isOwner"`,
 * 집계는 raw SQL. 두 곳이 다르게 세면 슬랙 숫자와 대시보드 숫자가 어긋나고, 그러면
 * **둘 다 못 믿는다.**
 *
 * **방문자는 "날마다 센 순방문자의 합"이다.** `visitorHash`는 날마다 실효 솔트가 바뀌므로
 * (05 §4.2) 7일을 가로질러 같은 사람을 이을 수 없다 — 매일 오는 한 사람은 7로 센다. 이건
 * findVisitorTotals의 누적과 **같은 정의**라 관리 화면 숫자와 어긋나지 않는다. 각주가
 * 필요한 값이지만 이 요약을 읽는 사람은 그 각주를 아는 한 사람뿐이다(공개 지면이 방문자
 * 대신 조회를 적는 이유가 그 각주다 — components/public/ViewCount.tsx).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** 지난 7일과 그 앞 7일. 경계는 KST 자정이라 "어제까지"가 날짜와 어긋나지 않는다 */
function windows(now: Date) {
  const end = startOfKstDay(now);
  return {
    end,
    start: new Date(end.getTime() - 7 * DAY_MS),
    prev: new Date(end.getTime() - 14 * DAY_MS),
  };
}

/**
 * CrawlRun.runDate 전용 경계.
 *
 * `runDate`는 `@db.Date`라 **KST 날짜의 자정을 UTC 자정으로 적는** 관례를 쓴다(kst.ts).
 * `startOfKstDay`가 주는 값은 그 KST 자정의 실제 UTC 시각(= UTC 15:00)이라 **다른 값
 * 공간**이다. 섞어 비교하면 창이 아홉 시간 밀려 경계의 하루가 들락거린다.
 */
function crawlWindow(now: Date) {
  const end = kstDateAsUtcMidnight(now);
  return { end, start: new Date(end.getTime() - 7 * DAY_MS) };
}

export type WeeklyViews = {
  views: number;
  prevViews: number;
  /** 날마다 센 순방문자의 합. 7일에 걸친 순방문자가 아니다 */
  visitors: number;
  prevVisitors: number;
};

async function findViews(now: Date): Promise<WeeklyViews> {
  const { start, prev, end } = windows(now);

  const [totals] = await prisma.$queryRaw<{ views: number; prevViews: number }[]>`
    SELECT count(*) FILTER (WHERE "occurredAt" >= ${start})::int AS views,
           count(*) FILTER (WHERE "occurredAt" < ${start})::int AS "prevViews"
    FROM "StatEvent"
    WHERE "eventType"::text = 'PAGEVIEW' AND NOT "isOwner"
      AND "occurredAt" >= ${prev} AND "occurredAt" < ${end}`;

  // 하루씩 센 뒤 더한다. DISTINCT를 두 주에 한 번 걸면 주를 가로질러 같은 사람을 이어버린다.
  // 창 경계가 KST 자정이라 하루 칸은 언제나 한쪽 주에만 온전히 들어간다
  const [visitors] = await prisma.$queryRaw<{ visitors: number; prevVisitors: number }[]>`
    WITH daily AS (
      SELECT ("occurredAt" + interval '9 hours')::date AS day,
             count(DISTINCT "visitorHash")::int AS visitors
      FROM "StatEvent"
      WHERE "eventType"::text = 'PAGEVIEW' AND NOT "isOwner"
        AND "occurredAt" >= ${prev} AND "occurredAt" < ${end}
      GROUP BY 1
    ),
    split AS (SELECT (${start}::timestamptz + interval '9 hours')::date AS from_day)
    SELECT coalesce(sum(visitors)
             FILTER (WHERE day >= (SELECT from_day FROM split)), 0)::int AS visitors,
           coalesce(sum(visitors)
             FILTER (WHERE day < (SELECT from_day FROM split)), 0)::int AS "prevVisitors"
    FROM daily`;

  return {
    views: totals?.views ?? 0,
    prevViews: totals?.prevViews ?? 0,
    visitors: visitors?.visitors ?? 0,
    prevVisitors: visitors?.prevVisitors ?? 0,
  };
}

export type WeeklyPost = { title: string | null; views: number };

/**
 * 지난 7일 많이 읽힌 글.
 *
 * statSummary의 findTopPosts를 쓰지 않는다 — 그쪽은 `now`가 아니라 `Date.now()`를 기준으로
 * 창을 잡아서, 이 요약이 쓰는 KST 자정 경계와 하루가 어긋난다.
 */
async function findTopPosts(now: Date, limit: number): Promise<WeeklyPost[]> {
  const { start, end } = windows(now);

  return prisma.$queryRaw<WeeklyPost[]>`
    SELECT p.title, count(*)::int AS views
    FROM "StatEvent" s
    -- 지워진 글의 조회도 남긴다(postId는 FK가 아니다, 05 §1.4)
    LEFT JOIN "Post" p ON p.id = s."postId"
    WHERE s."eventType"::text = 'PAGEVIEW' AND NOT s."isOwner"
      AND s."postId" IS NOT NULL
      AND s."occurredAt" >= ${start} AND s."occurredAt" < ${end}
    GROUP BY 1
    ORDER BY views DESC
    LIMIT ${limit}`;
}

/** 지난 7일 발행 편수. "며칠 썼나"가 아니라 "몇 편 냈나"다 — 하루에 둘을 쓴 날이 있다 */
async function countPublished(now: Date): Promise<number> {
  const { start, end } = windows(now);

  return prisma.post.count({
    where: { status: PostStatus.PUBLISHED, publishedAt: { gte: start, lt: end } },
  });
}

export type WeeklyReferrer = { host: string; views: number };

/**
 * 지난 7일 유입 경로.
 *
 * 호스트로 묶는 일은 SQL이 아니라 여기서 한다 — URL 파싱이고, 지면 전체·글 하나·이 요약이
 * **같은 규칙**으로 묶어야 숫자가 서로 맞는다(statSummary.topHosts와 같은 이유).
 */
async function findReferrers(now: Date, limit: number): Promise<WeeklyReferrer[]> {
  const { start, end } = windows(now);

  const rows = await prisma.$queryRaw<{ referrer: string | null; views: number }[]>`
    SELECT "referrer", count(*)::int AS views
    FROM "StatEvent"
    WHERE "eventType"::text = 'PAGEVIEW' AND NOT "isOwner"
      AND "occurredAt" >= ${start} AND "occurredAt" < ${end}
    GROUP BY 1`;

  const byHost = new Map<string, number>();
  for (const row of rows) {
    const host = referrerHost(row.referrer);
    byHost.set(host, (byHost.get(host) ?? 0) + row.views);
  }

  return [...byHost]
    .map(([host, views]) => ({ host, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

export type CrawlTally = { success: number; total: number };

/** 지난 7일 크롤 실적 (백로그 10 — 가동률 가시화). SKIPPED는 큐티가 없는 날이라 분모에서 뺀다 */
async function tallyCrawls(now: Date): Promise<CrawlTally> {
  const { start, end } = crawlWindow(now);

  const rows = await prisma.crawlRun.groupBy({
    by: ["status"],
    where: { runDate: { gte: start, lt: end } },
    _count: { _all: true },
  });

  const count = (status: CrawlStatus) =>
    rows.find((row) => row.status === status)?._count._all ?? 0;

  const success = count(CrawlStatus.SUCCESS);
  return { success, total: success + count(CrawlStatus.FAILED) };
}

export type WeeklyStats = WeeklyViews & {
  topPosts: WeeklyPost[];
  referrers: WeeklyReferrer[];
  published: number;
  crawls: CrawlTally;
};

export async function findWeeklyStats(now: Date, topLimit = 3): Promise<WeeklyStats> {
  // 다섯 집계는 서로 독립이다. 순서대로 기다릴 이유가 없다
  const [views, topPosts, referrers, published, crawls] = await Promise.all([
    findViews(now),
    findTopPosts(now, topLimit),
    findReferrers(now, topLimit),
    countPublished(now),
    tallyCrawls(now),
  ]);

  return { ...views, topPosts, referrers, published, crawls };
}
