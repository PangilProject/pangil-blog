import { describe, expect, it } from "vitest";

import { escapeXml, renderRss, renderSitemap } from "@/lib/feed/xml";

/**
 * 피드는 남의 프로그램이 읽는다. 제목에 `&` 하나가 들어가면 문서 전체가 깨지고 리더는 그
 * 사이트를 조용히 버린다 — 이스케이프가 이 모듈의 존재 이유다.
 */
describe("escapeXml", () => {
  it("XML을 깨뜨리는 문자를 모두 바꾼다", () => {
    expect(escapeXml(`R&D <b> "인용" 'x'`)).toBe(
      "R&amp;D &lt;b&gt; &quot;인용&quot; &apos;x&apos;",
    );
  });

  it("한글은 그대로 둔다", () => {
    expect(escapeXml("믿음의 기록")).toBe("믿음의 기록");
  });
});

describe("renderRss", () => {
  const entry = {
    title: "주님이 & 네 악을",
    url: "https://faith.example/qt-1",
    summary: "요약" as string | null,
    publishedAt: new Date("2026-08-23T00:00:00Z"),
  };

  const input = {
    title: "믿음의 기록",
    description: "매일의 묵상",
    siteUrl: "https://faith.example",
    feedUrl: "https://faith.example/rss.xml",
    entries: [entry],
  };

  it("항목의 제목·링크·요약·발행일을 싣는다", () => {
    const xml = renderRss(input);

    expect(xml).toContain("<title>주님이 &amp; 네 악을</title>");
    expect(xml).toContain("<link>https://faith.example/qt-1</link>");
    expect(xml).toContain("<description>요약</description>");
    expect(xml).toContain("<pubDate>Sun, 23 Aug 2026 00:00:00 GMT</pubDate>");
  });

  it("guid는 글 URL이다 — slug는 발행 후 바뀌지 않는다(05 §3.4)", () => {
    expect(renderRss(input)).toContain(
      '<guid isPermaLink="true">https://faith.example/qt-1</guid>',
    );
  });

  it("요약이 없으면 description 요소를 넣지 않는다 — 빈 요소는 리더가 싫어한다", () => {
    const xml = renderRss({
      ...input,
      entries: [{ ...entry, summary: null }],
    });

    expect(xml).not.toContain("<description></description>");
  });

  it("글이 없어도 유효한 문서다", () => {
    const xml = renderRss({ ...input, entries: [] });

    expect(xml).toContain("<channel>");
    expect(xml).toContain("</rss>");
    expect(xml).not.toContain("<item>");
  });
});

describe("renderSitemap", () => {
  it("URL과 마지막 수정일을 싣는다", () => {
    const xml = renderSitemap([
      { url: "https://dev.example/", lastModified: new Date("2026-08-23T12:00:00Z") },
      { url: "https://dev.example/next-16" },
    ]);

    expect(xml).toContain("<loc>https://dev.example/</loc>");
    expect(xml).toContain("<lastmod>2026-08-23</lastmod>");
    expect(xml).toContain("<loc>https://dev.example/next-16</loc>");
  });

  it("비어도 유효한 문서다", () => {
    expect(renderSitemap([])).toContain("</urlset>");
  });
});
