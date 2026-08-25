import { describe, expect, it } from "vitest";

import { clientIpOf, deviceOf, isBotUserAgent, visitorHash } from "@/lib/stats/visitor";

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

describe("visitorHash", () => {
  const base = { salt: "s", ip: "1.2.3.4", userAgent: CHROME };

  it("같은 날 같은 방문자는 같은 해시다", () => {
    const a = visitorHash({ ...base, now: new Date("2026-08-25T01:00:00Z") });
    const b = visitorHash({ ...base, now: new Date("2026-08-25T09:00:00Z") });
    expect(a).toBe(b);
  });

  it("날짜가 바뀌면 해시가 바뀐다 — 날짜 교차 추적 불가(05 §4.2)", () => {
    const today = visitorHash({ ...base, now: new Date("2026-08-25T05:00:00Z") });
    const tomorrow = visitorHash({ ...base, now: new Date("2026-08-26T05:00:00Z") });
    expect(today).not.toBe(tomorrow);
  });

  it("경계는 KST 자정이다 — UTC 자정이 아니다", () => {
    // 2026-08-25T14:59Z = KST 23:59, 15:00Z = KST 다음날 00:00
    const before = visitorHash({ ...base, now: new Date("2026-08-25T14:59:59Z") });
    const after = visitorHash({ ...base, now: new Date("2026-08-25T15:00:00Z") });
    expect(before).not.toBe(after);
  });

  it("솔트가 다르면 해시가 다르다 — 솔트 없이는 되짚을 수 없다", () => {
    const now = new Date("2026-08-25T05:00:00Z");
    expect(visitorHash({ ...base, now })).not.toBe(visitorHash({ ...base, salt: "t", now }));
  });

  it("ip가 없어도 해시를 만든다 — 이벤트를 버리는 편이 더 나쁘다", () => {
    const now = new Date("2026-08-25T05:00:00Z");
    expect(visitorHash({ ...base, ip: null, now })).toHaveLength(64);
  });
});

describe("deviceOf", () => {
  it("아이폰은 MOBILE", () => expect(deviceOf(IPHONE)).toBe("MOBILE"));
  it("데스크탑 크롬은 DESKTOP", () => expect(deviceOf(CHROME)).toBe("DESKTOP"));
  it("ua가 없으면 DESKTOP", () => expect(deviceOf(null)).toBe("DESKTOP"));
});

describe("isBotUserAgent", () => {
  it("사람의 브라우저는 통과한다", () => {
    expect(isBotUserAgent(CHROME)).toBe(false);
    expect(isBotUserAgent(IPHONE)).toBe(false);
  });

  it.each([
    ["Googlebot/2.1 (+http://www.google.com/bot.html)"],
    ["Mozilla/5.0 (compatible; bingbot/2.0)"],
    ["Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)"],
    ["HeadlessChrome/128.0.0.0"],
    ["facebookexternalhit/1.1"],
  ])("봇은 막는다: %s", (ua) => {
    expect(isBotUserAgent(ua)).toBe(true);
  });

  it("ua가 없으면 봇으로 본다 — 사람의 브라우저는 항상 ua를 보낸다", () => {
    expect(isBotUserAgent(null)).toBe(true);
  });
});

describe("clientIpOf", () => {
  it("x-forwarded-for의 맨 앞을 쓴다 — 뒤는 프록시 체인이다", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1, 10.0.0.2" });
    expect(clientIpOf(headers)).toBe("203.0.113.9");
  });

  it("x-real-ip로 폴백한다", () => {
    expect(clientIpOf(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("둘 다 없으면 null", () => {
    expect(clientIpOf(new Headers())).toBeNull();
  });
});
