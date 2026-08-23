/**
 * 피드·사이트맵 XML 조립 (04 §1.2 S-01/02 · 07 M3).
 *
 * 라이브러리를 쓰지 않는다. 필요한 것은 요소 대여섯 개짜리 문서 두 종이고, 그걸 위해 의존성을
 * 늘리면 락파일만 무거워진다(프리모템 #6의 정신).
 *
 * **이스케이프가 이 파일의 존재 이유다.** 제목에 `&`나 `<`가 하나 들어가면 피드 전체가
 * 깨진 XML이 되고, 리더는 그 사이트를 조용히 버린다.
 */

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type FeedEntry = {
  title: string;
  url: string;
  /** 요약만 싣는다 — 본문 전문을 넣으면 지면으로 오지 않는다(07 M3) */
  summary: string | null;
  publishedAt: Date | null;
};

export type FeedInput = {
  title: string;
  description: string;
  /** 지면 홈 URL */
  siteUrl: string;
  /** 이 피드 자신의 URL */
  feedUrl: string;
  entries: FeedEntry[];
  /** 마지막 갱신 시각. 없으면 첫 항목의 발행 시각 */
  updatedAt?: Date | null;
};

function rfc822(date: Date): string {
  return date.toUTCString();
}

export function renderRss({
  title,
  description,
  siteUrl,
  feedUrl,
  entries,
  updatedAt,
}: FeedInput): string {
  const lastBuild = updatedAt ?? entries[0]?.publishedAt ?? null;

  const items = entries
    .map((entry) =>
      [
        "    <item>",
        `      <title>${escapeXml(entry.title)}</title>`,
        `      <link>${escapeXml(entry.url)}</link>`,
        // guid는 URL을 쓴다. slug는 발행 후 바뀌지 않으므로(05 §3.4) 안정적인 식별자다
        `      <guid isPermaLink="true">${escapeXml(entry.url)}</guid>`,
        entry.summary ? `      <description>${escapeXml(entry.summary)}</description>` : null,
        entry.publishedAt ? `      <pubDate>${rfc822(entry.publishedAt)}</pubDate>` : null,
        "    </item>",
      ]
        .filter((line) => line !== null)
        .join("\n"),
    )
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    "    <language>ko</language>",
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    lastBuild ? `    <lastBuildDate>${rfc822(lastBuild)}</lastBuildDate>` : null,
    items || null,
    "  </channel>",
    "</rss>",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export type SitemapEntry = {
  url: string;
  lastModified?: Date | null;
};

export function renderSitemap(entries: SitemapEntry[]): string {
  const urls = entries
    .map((entry) =>
      [
        "  <url>",
        `    <loc>${escapeXml(entry.url)}</loc>`,
        entry.lastModified
          ? `    <lastmod>${entry.lastModified.toISOString().slice(0, 10)}</lastmod>`
          : null,
        "  </url>",
      ]
        .filter((line) => line !== null)
        .join("\n"),
    )
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls || null,
    "</urlset>",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");
}
