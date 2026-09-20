import "server-only";

import { cacheTag } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { HEATMAP_DAYS, type PublishDay } from "@/lib/record/heatmap";
import { TYPES_BY_SITE } from "@/lib/record/listQuery";
import { feedTag, listTag, type PublicSite } from "@/lib/revalidate/tags";
import { PostStatus } from "@/prisma/generated/enums";

/**
 * 발행 달력 — 하루에 몇 장을 냈는지 (ADR-004 3단계 · H-01 기록 장면).
 *
 * 허브에서 "매일 쌓는다"를 말이 아니라 **눈으로** 보여주는 조각이다. 이 숫자는 손으로 세지
 * 않는다 — 발행할 때마다 늘고, 시간이 지날수록 지면이 저절로 갱신된다(ADR-004의
 * "낡지 않게 하는 장치").
 *
 * 하루 = 칸 하나. 값은 그날 발행한 장수다.
 *
 * **날짜를 DB에서 자른다.** JS로 전부 끌어와 세면 1,100장이 넘어가고, 그중 필요한 것은
 * 날짜와 개수뿐이다. 시간대는 `Asia/Seoul` 고정 — 이 지면을 쓰는 사람이 한 명이고 서울에 있다.
 * UTC로 자르면 한국 새벽에 쓴 글이 전날 칸에 찍힌다(크롤러가 새벽에 돈다).
 */
export async function publishHeatmap(site: PublicSite, today: Date): Promise<PublishDay[]> {
  "use cache";

  cacheTag(listTag(site));
  cacheTag(feedTag(site));

  const types = TYPES_BY_SITE[site];
  const since = new Date(today);
  since.setUTCDate(since.getUTCDate() - HEATMAP_DAYS);

  const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    select
      date_trunc('day', "publishedAt" at time zone 'Asia/Seoul') as day,
      count(*) as count
    from "Post"
    where "status" = ${PostStatus.PUBLISHED}::"PostStatus"
      and "type" = any(${types}::"PostType"[])
      and "publishedAt" is not null
      and "publishedAt" >= ${since}
    group by day
    order by day asc
  `;

  return rows.map((row) => ({
    date: row.day.toISOString().slice(0, 10),
    // count(*)는 bigint로 온다. 하루치라 Number로 안전하다
    count: Number(row.count),
  }));
}
