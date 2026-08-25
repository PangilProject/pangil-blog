import { describe, expect, it } from "vitest";

import { isAllowedOrigin } from "@/lib/stats/origin";

const HOSTS = { root: "pangil.me", dev: "dev.pangil.me", faith: "faith.pangil.me" };

describe("isAllowedOrigin", () => {
  it("자사 3호스트는 통과한다", () => {
    for (const host of Object.values(HOSTS)) {
      expect(isAllowedOrigin(`https://${host}`, HOSTS)).toBe(true);
    }
  });

  it("남의 호스트는 드롭한다 — 남의 페이지가 내 통계를 채우면 안 된다", () => {
    expect(isAllowedOrigin("https://evil.example.com", HOSTS)).toBe(false);
    // 접미사만 같은 호스트도 통과시키지 않는다
    expect(isAllowedOrigin("https://notpangil.me", HOSTS)).toBe(false);
  });

  it("Origin이 없으면 드롭한다 — 브라우저는 항상 붙이고 curl은 붙이지 않는다", () => {
    expect(isAllowedOrigin(null, HOSTS)).toBe(false);
  });

  it("URL이 아닌 값은 드롭한다", () => {
    expect(isAllowedOrigin("pangil.me", HOSTS)).toBe(false);
    expect(isAllowedOrigin("null", HOSTS)).toBe(false);
  });

  it("포트는 무시한다 — 로컬 개발이 막히면 안 된다", () => {
    expect(isAllowedOrigin("http://localhost:3000", {})).toBe(true);
  });

  it("호스트 미설정 단계에서는 프리뷰 호스트만 허용한다", () => {
    expect(isAllowedOrigin("https://pangil-blog.vercel.app", {})).toBe(true);
    expect(isAllowedOrigin("https://evil.example.com", {})).toBe(false);
  });

  it("호스트가 설정되면 프리뷰 폴백은 닫힌다 — 실도메인에서 vercel.app을 믿지 않는다", () => {
    expect(isAllowedOrigin("https://pangil-blog.vercel.app", HOSTS)).toBe(false);
  });
});
