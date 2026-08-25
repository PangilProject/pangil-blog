import { describe, expect, it } from "vitest";

import { optOutCookieDomain } from "@/lib/stats/optOut";

describe("optOutCookieDomain", () => {
  it("루트 호스트가 있으면 부모 도메인에 심는다 — 3면이 서브도메인으로 갈리므로", () => {
    expect(optOutCookieDomain("pangil.me")).toBe(".pangil.me");
  });

  it("포트·대문자를 정규화한다", () => {
    expect(optOutCookieDomain("Pangil.ME:443")).toBe(".pangil.me");
  });

  it("미설정이면 호스트 한정으로 둔다 — 3면이 한 호스트를 공유하는 단계다", () => {
    expect(optOutCookieDomain(undefined)).toBeUndefined();
    expect(optOutCookieDomain("")).toBeUndefined();
  });

  it("localhost에는 도메인 속성을 붙일 수 없다", () => {
    expect(optOutCookieDomain("localhost")).toBeUndefined();
  });
});
