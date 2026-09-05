import { describe, expect, it } from "vitest";

import {
  absolutePostUrl,
  absoluteUrl,
  postHref,
  siteBaseUrl,
  siteHref,
} from "@/lib/site/publicUrl";

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

/**
 * 화면 링크. 도메인이 붙는 순간 여기가 어긋나면 지면 전체가 404가 된다 —
 * `/faith/sr-1`을 그대로 적으면 `faith.○`에서 `/faith/faith/sr-1`로 리라이트된다.
 */
describe("화면 링크 (siteHref)", () => {
  it("같은 지면은 접두사만 뗀 상대 경로다 — 클라이언트 이동이 살아 있어야 한다", () => {
    expect(siteHref("faith", "/faith/sr-1", { from: "faith", env: DOMAINS })).toBe("/sr-1");
    expect(siteHref("faith", "/faith", { from: "faith", env: DOMAINS })).toBe("/");
    expect(siteHref("dev", "/dev?category=fe", { from: "dev", env: DOMAINS })).toBe(
      "/?category=fe",
    );
  });

  it("다른 지면은 그 호스트의 절대 URL이다 — 상대 경로로는 호스트를 못 넘는다", () => {
    expect(siteHref("faith", "/faith", { from: "hub", env: DOMAINS })).toBe(
      "https://faith.pangil.example/",
    );
    expect(siteHref("hub", "/hub/privacy", { from: "dev", env: DOMAINS })).toBe(
      "https://pangil.example/privacy",
    );
  });

  it("지금 서 있는 지면을 모르면(관리 화면) 절대 URL이다", () => {
    expect(postHref("QT", "qt-1", undefined, DOMAINS)).toBe("https://faith.pangil.example/qt-1");
  });

  it("도메인 미확정 구간에서는 경로를 그대로 둔다 — 로컬이 깨지면 안 된다", () => {
    expect(siteHref("faith", "/faith/sr-1", { from: "hub", env: {} })).toBe("/faith/sr-1");
    expect(postHref("TECH", "next-16", "dev", {})).toBe("/dev/next-16");
  });
});
