import { describe, expect, it } from "vitest";

import { ownerCookieDomain } from "@/lib/stats/owner";

describe("ownerCookieDomain", () => {
  it("루트 호스트가 있으면 부모 도메인에 심는다 — 3면이 서브도메인으로 갈리므로", () => {
    expect(ownerCookieDomain("pangil.me")).toBe(".pangil.me");
  });

  it("포트·대문자를 정규화한다", () => {
    expect(ownerCookieDomain("Pangil.ME:443")).toBe(".pangil.me");
  });

  it("미설정이면 호스트 한정으로 둔다 — 3면이 한 호스트를 공유하는 단계다", () => {
    expect(ownerCookieDomain(undefined)).toBeUndefined();
    expect(ownerCookieDomain("")).toBeUndefined();
  });

  it("localhost에는 도메인 속성을 붙일 수 없다", () => {
    expect(ownerCookieDomain("localhost")).toBeUndefined();
  });
});
