import { describe, expect, it } from "vitest";

import { DIRECT, referrerHost, referrerKind, UNKNOWN } from "@/lib/stats/referrer";

describe("referrerHost", () => {
  it("호스트만 남긴다 — 쿼리스트링 때문에 같은 검색엔진이 갈라지면 안 된다", () => {
    expect(referrerHost("https://www.google.com/search?q=prisma")).toBe("www.google.com");
    expect(referrerHost("https://www.google.com/search?q=next")).toBe("www.google.com");
  });

  it("포트는 호스트의 일부다", () => {
    expect(referrerHost("http://localhost:3000/dev")).toBe("localhost:3000");
  });

  it("없으면 직접 방문이다", () => {
    for (const value of [null, undefined, ""]) expect(referrerHost(value)).toBe(DIRECT);
  });

  it("URL이 아닌 값은 한 칸으로 모은다 — 조작된 값이 자기 줄을 갖게 하지 않는다", () => {
    expect(referrerHost("not-a-url")).toBe(UNKNOWN);
    expect(referrerHost("《광고》 여기를 누르세요")).toBe(UNKNOWN);
  });

  it("http(s)가 아닌 스킴은 유입 경로가 아니다", () => {
    expect(referrerHost("javascript:alert(1)")).toBe(UNKNOWN);
    expect(referrerHost("data:text/html,<b>x</b>")).toBe(UNKNOWN);
    expect(referrerHost("file:///Users/x/index.html")).toBe(UNKNOWN);
  });
});

describe("referrerKind", () => {
  it("검색엔진을 가려낸다 — 검색 유입은 '그 주제를 더 쓰라'는 신호다(00 §6.3)", () => {
    for (const host of [
      "www.google.com",
      "search.naver.com",
      "m.search.daum.net",
      "www.bing.com",
    ]) {
      expect(referrerKind(host), host).toBe("search");
    }
  });

  it("그 외 호스트는 사이트 유입이다", () => {
    expect(referrerKind("news.ycombinator.com")).toBe("site");
    expect(referrerKind("localhost:3000")).toBe("site");
  });

  it("직접 방문과 알 수 없음은 따로 센다", () => {
    expect(referrerKind(DIRECT)).toBe("direct");
    expect(referrerKind(UNKNOWN)).toBe("unknown");
  });
});
