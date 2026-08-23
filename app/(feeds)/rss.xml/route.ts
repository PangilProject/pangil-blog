import type { NextRequest } from "next/server";

import { findFeedItems } from "@/lib/db/publicLists";
import { renderRss } from "@/lib/feed/xml";
import { absolutePostUrl, absoluteUrl } from "@/lib/site/publicUrl";
import { resolveSite, siteHostsFromEnv } from "@/lib/site/resolveSite";

/**
 * RSS (04 §1.2 S-01 · 07 M3 "RSS(요약+링크)").
 *
 * **지면별 피드다.** 호스트로 지면을 가른다 — 묵상 글을 읽으려고 구독한 사람에게 기술 글이
 * 섞여 오면 그건 다른 매체다. 도메인 미확정 구간에서는 `?site=`로 고른다(08 §3).
 *
 * 확장자가 있는 경로라 미들웨어 matcher를 타지 않는다. 그래서 여기서 직접 호스트를 본다.
 */
const FEED_LIMIT = 30;

const TITLES = {
  faith: "믿음의 기록",
  dev: "개발의 기록",
  hub: "기록",
} as const;

const DESCRIPTIONS = {
  faith: "매일의 묵상 — 큐티·설교·찬양",
  dev: "만들며 남기는 기술 기록",
  hub: "기록",
} as const;

export async function GET(request: NextRequest) {
  const host = request.headers.get("host");
  const site = resolveSite({
    host,
    siteParam: request.nextUrl.searchParams.get("site"),
    hosts: siteHostsFromEnv(process.env),
  });

  // 허브에는 글이 없다(01 §3.3 정적 한 페이지) — 묵상 피드로 보낸다
  const feedSite = site === "hub" ? "faith" : site;
  const items = await findFeedItems(feedSite, FEED_LIMIT);

  const xml = renderRss({
    title: TITLES[feedSite],
    description: DESCRIPTIONS[feedSite],
    siteUrl: absoluteUrl(feedSite, `/${feedSite}`, { host }),
    feedUrl: absoluteUrl(feedSite, `/${feedSite}/rss.xml`, { host }),
    entries: items.map((item) => ({
      title: item.title,
      url: absolutePostUrl(item.type, item.slug, { host }),
      summary: item.excerpt,
      publishedAt: item.publishedAt,
    })),
  });

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      // 무효화는 태그가 한다(04 §1.2). 리더가 자주 물어도 DB를 다시 훑지 않는다
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
