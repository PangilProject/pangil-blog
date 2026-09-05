import "server-only";

import { cacheLife } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import type { RecordType } from "@/lib/record/callNumber";
import { UNIT_BUCKETS, UNIT_WINDOW_DAYS, type Unit } from "@/lib/stats/range";
import { referrerHost } from "@/lib/stats/referrer";

/**
 * 통계 집계 (05 §4 · A-09).
 *
 * **집계는 raw SQL로 한다.** Prisma의 groupBy로는 "KST 날짜별"을 표현할 수 없고(서버는 UTC로
 * 돈다), FILTER 절이나 DISTINCT 집계도 안 된다. 05 §4가 인덱스를 `(site, occurredAt)` 하나로
 * 둔 것도 이 모양의 쿼리를 전제한다 — 기간으로 자르고 그 안에서 훑는다.
 *
 * **날짜 경계는 KST다.** 이 블로그의 "오늘"은 항상 KST이므로(lib/record/kst) 집계도 같아야
 * 한다. 안 그러면 아침 9시 전의 조회가 어제로 잡힌다.
 *
 * 여기서 `visitorHash`로 **여러 날에 걸친 순방문자를 세지 않는다.** 해시는 날마다 실효 솔트가
 * 바뀌므로(05 §4.2) 같은 사람이 날마다 새 사람으로 잡힌다 — 그 숫자는 틀린 것이 아니라
 * 의미가 없다. 그래서 순방문자는 **하루 단위로만** 낸다.
 */

/**
 * KST 오프셋은 SQL에 **리터럴로** 적는다. `interval ${...}`로 쓰면 Prisma가 파라미터로 바꿔
 * `interval $1`이 되고 그건 유효한 SQL이 아니다. 사용자 입력이 아닌 상수라 안전하다.
 */

function since(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export type SeriesPoint = {
  key: string;
  label: string;
  views: number;
  devViews: number;
  faithViews: number;
  /** 순방문자는 **하루 단위에만** 있다. 주·월은 해시가 날마다 바뀌어 셀 수 없다(05 §4.2) */
  visitors: number | null;
};

/**
 * 조회 시계열 (일·주·월).
 *
 * 티스토리 통계처럼 **단위를 갈아 끼운다.** 일별만 있으면 "이번 달이 지난달보다 나은가"를
 * 볼 수 없고, 월별만 있으면 어제 무슨 일이 있었는지 볼 수 없다.
 *
 * 세 쿼리로 갈라 쓴다 — 버킷 식을 파라미터로 넘기려면 SQL을 문자열로 이어야 하고, 그건
 * 이 파일에서 유일한 주입 경로가 된다. 중복 세 줄이 그보다 싸다.
 */
export async function findSeries(unit: Unit): Promise<SeriesPoint[]> {
  if (unit === "week") return weeklySeries();
  if (unit === "month") return monthlySeries();
  return dailySeries();
}

/** 지면별 조회와 순방문자를 한 번에 세는 공용 선택절 */
type RawBucket = {
  key: string;
  views: number;
  devViews: number;
  faithViews: number;
  visitors: number;
};

async function dailySeries(): Promise<SeriesPoint[]> {
  const rows = await prisma.$queryRaw<RawBucket[]>`
    SELECT to_char("occurredAt" + interval '9 hours', 'YYYY-MM-DD') AS key,
           count(*) FILTER (WHERE "eventType"::text = 'PAGEVIEW')::int AS views,
           count(*) FILTER (WHERE "eventType"::text = 'PAGEVIEW'
                              AND "site"::text = 'DEV')::int AS "devViews",
           count(*) FILTER (WHERE "eventType"::text = 'PAGEVIEW'
                              AND "site"::text = 'FAITH')::int AS "faithViews",
           count(DISTINCT "visitorHash")::int AS visitors
    FROM "StatEvent"
    WHERE "occurredAt" >= ${since(UNIT_WINDOW_DAYS.day)}
    GROUP BY 1`;

  return fillDays(rows, UNIT_WINDOW_DAYS.day);
}

async function weeklySeries(): Promise<SeriesPoint[]> {
  const rows = await prisma.$queryRaw<RawBucket[]>`
    SELECT to_char(
             ("occurredAt" + interval '9 hours')::date
               - extract(dow from "occurredAt" + interval '9 hours')::int,
             'YYYY-MM-DD') AS key,
           count(*) FILTER (WHERE "eventType"::text = 'PAGEVIEW')::int AS views,
           count(*) FILTER (WHERE "eventType"::text = 'PAGEVIEW'
                              AND "site"::text = 'DEV')::int AS "devViews",
           count(*) FILTER (WHERE "eventType"::text = 'PAGEVIEW'
                              AND "site"::text = 'FAITH')::int AS "faithViews",
           0::int AS visitors
    FROM "StatEvent"
    WHERE "occurredAt" >= ${since(UNIT_WINDOW_DAYS.week + 7)}
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT ${UNIT_BUCKETS.week}`;

  return rows
    .map((row) => ({
      ...row,
      // 주의 시작일을 적는다. "8/24~"가 "34주차"보다 읽힌다
      label: `${Number(row.key.slice(5, 7))}/${Number(row.key.slice(8, 10))}`,
      visitors: null,
    }))
    .reverse();
}

async function monthlySeries(): Promise<SeriesPoint[]> {
  const rows = await prisma.$queryRaw<RawBucket[]>`
    SELECT to_char("occurredAt" + interval '9 hours', 'YYYY-MM') AS key,
           count(*) FILTER (WHERE "eventType"::text = 'PAGEVIEW')::int AS views,
           count(*) FILTER (WHERE "eventType"::text = 'PAGEVIEW'
                              AND "site"::text = 'DEV')::int AS "devViews",
           count(*) FILTER (WHERE "eventType"::text = 'PAGEVIEW'
                              AND "site"::text = 'FAITH')::int AS "faithViews",
           0::int AS visitors
    FROM "StatEvent"
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT ${UNIT_BUCKETS.month}`;

  return rows
    .map((row) => ({ ...row, label: `${Number(row.key.slice(5, 7))}월`, visitors: null }))
    .reverse();
}

/**
 * 조회가 없는 날도 칸을 남긴다.
 *
 * 빈 날을 빼면 막대가 촘촘히 붙어 **"매일 읽혔다"처럼 보인다.** 그건 그래프가 하는 거짓말 중
 * 가장 흔한 것이다. 주·월은 칸이 12개뿐이라 채우지 않는다(수집 전 기간을 0으로 채우면
 * 그것도 거짓말이다).
 */
function fillDays(rows: RawBucket[], days: number): SeriesPoint[] {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const out: SeriesPoint[] = [];

  for (let ago = days - 1; ago >= 0; ago -= 1) {
    const date = new Date(Date.now() + 9 * 3600_000 - ago * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    const row = byKey.get(key);

    out.push({
      key,
      label: `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`,
      views: row?.views ?? 0,
      devViews: row?.devViews ?? 0,
      faithViews: row?.faithViews ?? 0,
      visitors: row?.visitors ?? 0,
    });
  }

  return out;
}

export type TopPost = {
  id: string;
  title: string | null;
  type: RecordType | null;
  slug: string | null;
  views: number;
};

export async function findTopPosts(days = 30, limit = 10): Promise<TopPost[]> {
  return prisma.$queryRaw<TopPost[]>`
    SELECT s."postId" AS id, p.title, p.type::text AS type, p.slug, count(*)::int AS views
    FROM "StatEvent" s
    -- LEFT JOIN이다. 지워진 글의 조회도 남는다(postId는 FK가 아니다, 05 §1.4) —
    -- 그 행을 빼면 "지난달에 뭐가 읽혔나"가 조용히 줄어든다
    LEFT JOIN "Post" p ON p.id = s."postId"
    WHERE s."eventType"::text = 'PAGEVIEW'
      AND s."postId" IS NOT NULL
      AND s."occurredAt" >= ${since(days)}
    GROUP BY 1, 2, 3, 4
    ORDER BY views DESC
    LIMIT ${limit}`;
}

export type ReferrerStat = { host: string; views: number };

/**
 * 유입 경로. 호스트만 남긴다 — 전체 URL을 늘어놓으면 같은 검색엔진이 쿼리스트링 때문에
 * 열 줄로 갈라진다. 정규화를 SQL이 아니라 여기서 하는 이유는 URL 파싱이기 때문이다.
 */
export async function findReferrers(days = 30, limit = 8): Promise<ReferrerStat[]> {
  const rows = await prisma.$queryRaw<{ referrer: string | null; views: number }[]>`
    SELECT "referrer", count(*)::int AS views
    FROM "StatEvent"
    WHERE "eventType"::text = 'PAGEVIEW' AND "occurredAt" >= ${since(days)}
    GROUP BY 1`;

  return topHosts(rows, limit);
}

/** 지면 전체와 글 하나가 **같은 규칙**으로 유입을 묶어야 한다 — 규칙이 갈리면 숫자가 안 맞는다 */
function topHosts(rows: { referrer: string | null; views: number }[], limit: number) {
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

export type DeviceStat = { device: string; views: number };

export async function findDevices(days = 30): Promise<DeviceStat[]> {
  return prisma.$queryRaw<DeviceStat[]>`
    SELECT "device"::text AS device, count(*)::int AS views
    FROM "StatEvent"
    WHERE "eventType"::text = 'PAGEVIEW' AND "occurredAt" >= ${since(days)}
    GROUP BY 1
    ORDER BY 2 DESC`;
}

export type DwellStat = { id: string; title: string | null; seconds: number; samples: number };

/**
 * 체류 시간. **항상 하한이다** — 창을 닫을 때 LEAVE가 유실될 수 있어서(05 §4.4) 오래 읽고
 * 닫은 사람이 표본에서 빠진다. 표본 3건 미만은 내지 않는다: 한 사람의 한 번이 평균이 되면
 * 그건 평균이 아니다.
 */
export async function findDwellTimes(days = 30, limit = 8): Promise<DwellStat[]> {
  return prisma.$queryRaw<DwellStat[]>`
    SELECT s."postId" AS id, p.title,
           (avg(s."durationMs") / 1000.0)::float AS seconds,
           count(*)::int AS samples
    FROM "StatEvent" s
    LEFT JOIN "Post" p ON p.id = s."postId"
    WHERE s."eventType"::text = 'LEAVE'
      AND s."postId" IS NOT NULL
      AND s."durationMs" IS NOT NULL
      AND s."occurredAt" >= ${since(days)}
    GROUP BY 1, 2
    HAVING count(*) >= 3
    ORDER BY seconds DESC
    LIMIT ${limit}`;
}

export type PeriodTotals = { current: number; previous: number };

/**
 * KPI 여섯 칸 (티스토리 통계의 갈림을 따른다 — 오늘·어제를 나란히 두고 주 단위로 묶는다).
 *
 * **주는 일요일에 시작한다.** Postgres의 `date_trunc('week')`는 월요일 기준이라 쓰지 않고
 * `dow`를 빼서 직접 계산한다. 이 블로그의 한 주가 일요일(설교)에서 시작하기 때문이다
 * (02 §3.1의 요일 카드 구성) — 통계의 주와 작성 루틴의 주가 어긋나면 둘을 나란히 못 본다.
 *
 * `now()`는 timestamptz라 `AT TIME ZONE 'UTC'`로 못 박고 9시간을 더한다. 세션 타임존에
 * 의존하면 서버 설정 하나로 "오늘"이 바뀐다.
 */
export type Kpis = {
  today: number;
  yesterday: number;
  thisWeek: number;
  lastWeek: number;
  month: number;
  total: number;
};

export async function findKpis(): Promise<Kpis> {
  const rows = await prisma.$queryRaw<Kpis[]>`
    WITH days AS (
      SELECT ("occurredAt" + interval '9 hours')::date AS day
      FROM "StatEvent"
      WHERE "eventType"::text = 'PAGEVIEW'
    ),
    anchor AS (
      SELECT d AS today, d - extract(dow from d)::int AS week_start
      FROM (SELECT ((now() AT TIME ZONE 'UTC') + interval '9 hours')::date AS d) AS x
    )
    SELECT
      count(*) FILTER (WHERE day = (SELECT today FROM anchor))::int AS today,
      count(*) FILTER (WHERE day = (SELECT today FROM anchor) - 1)::int AS yesterday,
      count(*) FILTER (WHERE day >= (SELECT week_start FROM anchor))::int AS "thisWeek",
      count(*) FILTER (WHERE day >= (SELECT week_start FROM anchor) - 7
                         AND day <  (SELECT week_start FROM anchor))::int AS "lastWeek",
      count(*) FILTER (WHERE day >  (SELECT today FROM anchor) - 30)::int AS month,
      count(*)::int AS total
    FROM days`;

  return rows[0] ?? { today: 0, yesterday: 0, thisWeek: 0, lastWeek: 0, month: 0, total: 0 };
}

export type AllTimeTotals = { views: number; days: number };

/**
 * 누적 통산. 유입이 적어도 **쌓이는 것이 보여야** 한다(프리모템 #4 — 검색 유입 0이 지속되면
 * 동기가 붕괴한다. 그 대응이 "유입 외 지표 병행 표시"다).
 */
export async function findAllTimeTotals(): Promise<AllTimeTotals> {
  const rows = await prisma.$queryRaw<AllTimeTotals[]>`
    SELECT count(*) FILTER (WHERE "eventType"::text = 'PAGEVIEW')::int AS views,
           count(DISTINCT ("occurredAt" + interval '9 hours')::date)::int AS days
    FROM "StatEvent"`;

  return rows[0] ?? { views: 0, days: 0 };
}

export type VisitorTotals = { today: number; yesterday: number; total: number };

/**
 * 공개 지면 푸터의 방문자 수 (05 §4.2).
 *
 * **누적은 "순방문자의 누적"이 아니라 날마다 센 순방문자의 합이다.** 해시 솔트가 날마다
 * 바뀌므로(05 §4.2) 여러 날에 걸친 같은 사람을 이을 수 없다 — 같은 사람이 사흘 오면 3으로
 * 센다. 그 한계를 감추지 않되 화면에서는 통계 용어로 말하지 않는다(03 §7.3).
 *
 * **어제를 나란히 둔다.** 오늘 숫자만 있으면 그게 많은 건지 적은 건지 알 수 없다 — 아침에는
 * 늘 작아 보이고 밤에는 늘 커 보인다. 비교 대상 하나가 있어야 그 숫자가 뜻을 가진다.
 *
 * `use cache` + 짧은 수명이다. 이 숫자는 **방문자 행동으로** 바뀌므로 발행 태그로 만료시킬
 * 수 없다 — 이벤트 기반 무효화가 닿지 않는 유일한 값이라 시간이 그 자리를 맡는다(04 §1.1의
 * "시간 기반 ISR을 쓰지 않는다"는 콘텐츠에 대한 규칙이다). 지면마다 요청이 들어와도 DB는
 * 몇 분에 한 번만 만진다.
 */
export async function findVisitorTotals(): Promise<VisitorTotals> {
  "use cache";
  cacheLife("minutes");

  const rows = await prisma.$queryRaw<VisitorTotals[]>`
    WITH daily AS (
      SELECT ("occurredAt" + interval '9 hours')::date AS day,
             count(DISTINCT "visitorHash")::int AS visitors
      FROM "StatEvent"
      WHERE "eventType"::text = 'PAGEVIEW'
      GROUP BY 1
    ),
    anchor AS (
      SELECT ((now() AT TIME ZONE 'UTC') + interval '9 hours')::date AS today
    )
    SELECT
      coalesce(sum(visitors) FILTER (WHERE day = (SELECT today FROM anchor)), 0)::int AS today,
      coalesce(sum(visitors) FILTER (WHERE day = (SELECT today FROM anchor) - 1), 0)::int
        AS yesterday,
      coalesce(sum(visitors), 0)::int AS total
    FROM daily`;

  return rows[0] ?? { today: 0, yesterday: 0, total: 0 };
}

export type HourlyStat = { hour: number; views: number };

/** 시간대 분포 (KST). 빈 시간은 0으로 채워 24칸을 항상 돌려준다 — 칸이 비면 눈이 못 읽는다 */
export async function findHourly(days: number): Promise<HourlyStat[]> {
  const rows = await prisma.$queryRaw<HourlyStat[]>`
    SELECT extract(hour from "occurredAt" + interval '9 hours')::int AS hour,
           count(*)::int AS views
    FROM "StatEvent"
    WHERE "eventType"::text = 'PAGEVIEW' AND "occurredAt" >= ${since(days)}
    GROUP BY 1`;

  const byHour = new Map(rows.map((row) => [row.hour, row.views]));
  return Array.from({ length: 24 }, (_, hour) => ({ hour, views: byHour.get(hour) ?? 0 }));
}

export type WeekdayStat = { weekday: number; views: number };

/** 요일 분포 (KST). 0 = 일요일 — lib/record/kst의 Weekday와 같은 규약 */
export async function findWeekdays(days: number): Promise<WeekdayStat[]> {
  const rows = await prisma.$queryRaw<WeekdayStat[]>`
    SELECT extract(dow from "occurredAt" + interval '9 hours')::int AS weekday,
           count(*)::int AS views
    FROM "StatEvent"
    WHERE "eventType"::text = 'PAGEVIEW' AND "occurredAt" >= ${since(days)}
    GROUP BY 1`;

  const byDay = new Map(rows.map((row) => [row.weekday, row.views]));
  return Array.from({ length: 7 }, (_, weekday) => ({ weekday, views: byDay.get(weekday) ?? 0 }));
}

export type RecentEvent = {
  id: string;
  eventType: string;
  path: string;
  device: string;
  durationMs: number | null;
  occurredAt: Date;
  title: string | null;
  type: RecordType | null;
  slug: string | null;
};

/**
 * 최근 흔적. 집계가 아니라 **날것**이다 — 숫자가 작을 때는 평균보다 "방금 누가 뭘 봤다"가
 * 더 실감난다. 20건으로 자른 이유는 이게 로그 뷰어가 아니기 때문이다.
 */
export async function findRecentEvents(limit = 20): Promise<RecentEvent[]> {
  return prisma.$queryRaw<RecentEvent[]>`
    SELECT s.id::text AS id, s."eventType"::text AS "eventType", s.path,
           s.device::text AS device, s."durationMs", s."occurredAt",
           p.title, p.type::text AS type, p.slug
    FROM "StatEvent" s
    LEFT JOIN "Post" p ON p.id = s."postId"
    ORDER BY s.id DESC
    LIMIT ${limit}`;
}

/** 수집이 시작된 시점. 표본이 며칠치인지 화면이 말해줘야 한다 */
export async function findFirstEventAt(): Promise<Date | null> {
  const rows = await prisma.$queryRaw<{ at: Date | null }[]>`
    SELECT min("occurredAt") AS at FROM "StatEvent"`;
  return rows[0]?.at ?? null;
}

/* ── 글 하나 드릴다운 (A-09 상세) ──────────────────────────────────────────
   총합만으로는 "오래된 글이 계속 읽힌다"와 "발행 직후에만 읽혔다"를 구별할 수 없다.
   그 둘은 완전히 다른 신호다 — 앞은 그 주제를 더 쓰라는 뜻이고 뒤는 아니다. */

export type PostStatSummary = {
  views: number;
  firstSeen: Date | null;
  lastSeen: Date | null;
  avgSeconds: number | null;
  dwellSamples: number;
};

export async function findPostStatSummary(postId: string): Promise<PostStatSummary> {
  const rows = await prisma.$queryRaw<PostStatSummary[]>`
    SELECT count(*) FILTER (WHERE "eventType"::text = 'PAGEVIEW')::int AS views,
           min("occurredAt") FILTER (WHERE "eventType"::text = 'PAGEVIEW') AS "firstSeen",
           max("occurredAt") FILTER (WHERE "eventType"::text = 'PAGEVIEW') AS "lastSeen",
           (avg("durationMs") FILTER (WHERE "eventType"::text = 'LEAVE') / 1000.0)::float
             AS "avgSeconds",
           count(*) FILTER (WHERE "eventType"::text = 'LEAVE')::int AS "dwellSamples"
    FROM "StatEvent"
    WHERE "postId" = ${postId}`;

  return (
    rows[0] ?? { views: 0, firstSeen: null, lastSeen: null, avgSeconds: null, dwellSamples: 0 }
  );
}

export type PostDailyStat = { day: string; views: number };

export async function findPostDaily(postId: string, days: number): Promise<PostDailyStat[]> {
  return prisma.$queryRaw<PostDailyStat[]>`
    SELECT to_char("occurredAt" + interval '9 hours', 'YYYY-MM-DD') AS day,
           count(*)::int AS views
    FROM "StatEvent"
    WHERE "postId" = ${postId}
      AND "eventType"::text = 'PAGEVIEW'
      AND "occurredAt" >= ${since(days)}
    GROUP BY 1
    ORDER BY 1 DESC`;
}

export async function findPostReferrers(postId: string, limit = 8): Promise<ReferrerStat[]> {
  const rows = await prisma.$queryRaw<{ referrer: string | null; views: number }[]>`
    SELECT "referrer", count(*)::int AS views
    FROM "StatEvent"
    WHERE "postId" = ${postId} AND "eventType"::text = 'PAGEVIEW'
    GROUP BY 1`;

  return topHosts(rows, limit);
}

export async function findPostDevices(postId: string): Promise<DeviceStat[]> {
  return prisma.$queryRaw<DeviceStat[]>`
    SELECT "device"::text AS device, count(*)::int AS views
    FROM "StatEvent"
    WHERE "postId" = ${postId} AND "eventType"::text = 'PAGEVIEW'
    GROUP BY 1
    ORDER BY 2 DESC`;
}
