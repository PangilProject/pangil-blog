import type { NextRequest } from "next/server";

import { findFeedItems } from "@/lib/db/publicLists";
import { renderSitemap } from "@/lib/feed/xml";
import { absolutePostUrl, absoluteUrl } from "@/lib/site/publicUrl";
import { resolveSite, siteHostsFromEnv } from "@/lib/site/resolveSite";

/**
 * sitemap (04 §1.2 S-02 · 07 M6 검색엔진 제출).
 *
 * 지면별이다 — 검색엔진은 호스트 단위로 sitemap을 읽고, dev와 faith는 별개의 사이트로 취급되는
 * 편이 맞다(01 §3.2 "두 얼굴을 섞지 않는다").
 *
 * 목록·태그 지면은 넣지 않는다. 필터 조합이 늘면 색인 가치가 낮은 URL이 불어나고, 홈에서 글로
 * 가는 링크가 이미 있다. 홈과 글 상세만 싣는다.
 */
export async function GET(request: NextRequest) {
  const host = request.headers.get("host");
  const site = resolveSite({
    host,
    siteParam: request.nextUrl.searchParams.get("site"),
    hosts: siteHostsFromEnv(process.env),
  });

  const targetSite = site === "hub" ? "faith" : site;
  const items = await findFeedItems(targetSite);

  const xml = renderSitemap([
    { url: absoluteUrl(targetSite, `/${targetSite}`, { host }), lastModified: items[0]?.updatedAt },
    ...items.map((item) => ({
      url: absolutePostUrl(item.type, item.slug, { host }),
      lastModified: item.updatedAt,
    })),
  ]);

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
