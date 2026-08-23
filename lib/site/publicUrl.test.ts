import { describe, expect, it } from "vitest";

import { absolutePostUrl, absoluteUrl, siteBaseUrl } from "@/lib/site/publicUrl";

/**
 * 피드·sitemap·OG는 남의 프로그램이 읽으므로 절대 주소여야 한다. 도메인이 아직 미확정이라
 * (07 §4) 두 구간을 모두 다뤄야 하고, 그 갈림이 한 곳에만 있어야 한다 — 여기서 고정한다.
 */
const DOMAINS = {
  SITE_HOST_ROOT: "pangil.example",
  SITE_HOST_DEV: "dev.pangil.example",
  SITE_HOST_FAITH: "faith.pangil.example",
};

describe("도메인이 붙은 뒤", () => {
  it("지면별 호스트를 쓰고 경로에서 site 세그먼트를 뗀다", () => {
    expect(absoluteUrl("faith", "/faith/sr-1", { host: "pangil.example", env: DOMAINS })).toBe(
      "https://faith.pangil.example/sr-1",
    );
    expect(absoluteUrl("dev", "/dev", { host: "pangil.example", env: DOMAINS })).toBe(
      "https://dev.pangil.example/",
    );
  });

  it("글 URL도 같은 규칙이다", () => {
    expect(absolutePostUrl("TECH", "next-16", { host: "pangil.example", env: DOMAINS })).toBe(
      "https://dev.pangil.example/next-16",
    );
    expect(absolutePostUrl("QT", "qt-1", { host: "pangil.example", env: DOMAINS })).toBe(
      "https://faith.pangil.example/qt-1",
    );
  });
});

describe("도메인 미확정 구간 (호스트 하나)", () => {
  const env = {};

  it("현재 호스트를 쓰고 경로에 지면을 남긴다 — 미들웨어가 통과시키는 경로다", () => {
    expect(absolutePostUrl("QT", "qt-1", { host: "pangil-blog.vercel.app", env })).toBe(
      "https://pangil-blog.vercel.app/faith/qt-1",
    );
  });

  it("로컬은 http다", () => {
    expect(siteBaseUrl("faith", { host: "localhost:3000", env })).toBe("http://localhost:3000");
  });

  it("호스트를 모르면 env의 사이트 URL로 떨어진다", () => {
    expect(
      siteBaseUrl("dev", { host: null, env: { NEXT_PUBLIC_SITE_URL: "https://example.com" } }),
    ).toBe("https://example.com");
  });
});
