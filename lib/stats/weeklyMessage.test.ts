import { describe, expect, it } from "vitest";

import type { WeeklyStats } from "@/lib/db/weeklyDigest";
import { weeklyMessage } from "@/lib/stats/weeklyMessage";

/** KST 일요일 11:00 = UTC 02:00, 아침 크론이 부르는 시각 */
const now = new Date("2026-09-13T02:00:00.000Z");

function stats(overrides: Partial<WeeklyStats> = {}): WeeklyStats {
  return {
    views: 412,
    prevViews: 346,
    visitors: 128,
    prevVisitors: 109,
    topPosts: [{ title: "시편 23편", views: 47 }],
    referrers: [{ host: "google.com", views: 61 }],
    published: 12,
    crawls: { success: 7, total: 7 },
    ...overrides,
  };
}

describe("weeklyMessage", () => {
  it("어제까지의 7일을 적는다 — 오늘은 아직 끝나지 않았다", () => {
    expect(weeklyMessage(now, stats())).toContain("9/6–9/12");
  });

  it("조회와 방문자를 전주 대비와 함께 적는다", () => {
    const message = weeklyMessage(now, stats());

    expect(message).toContain("조회 412회 (전주 +19%)");
    expect(message).toContain("방문자 128명 (전주 +17%)");
  });

  it("줄어든 주는 부호를 그대로 적는다", () => {
    expect(weeklyMessage(now, stats({ views: 200, prevViews: 400 }))).toContain(
      "조회 200회 (전주 -50%)",
    );
  });

  /** 0에서 늘어난 값은 언제나 무한대다. 비율을 적으면 그게 곧 거짓말이 된다 */
  it("전주가 0이면 비율 대신 첫 주라고 적는다", () => {
    const message = weeklyMessage(
      now,
      stats({ views: 30, prevViews: 0, visitors: 11, prevVisitors: 0 }),
    );

    expect(message).toContain("조회 30회 (첫 주)");
    expect(message).not.toContain("%");
  });

  it("두 주가 같으면 같다고 적는다", () => {
    expect(weeklyMessage(now, stats({ views: 100, prevViews: 100 }))).toContain(
      "조회 100회 (전주와 같음)",
    );
  });

  it("아무것도 없던 주는 비율도 첫 주도 적지 않는다", () => {
    const message = weeklyMessage(
      now,
      stats({ views: 0, prevViews: 0, visitors: 0, prevVisitors: 0 }),
    );

    expect(message).toContain("조회 0회 · 방문자 0명");
    expect(message).not.toContain("첫 주");
  });

  it("긴 제목은 잘렸다는 것이 보이게 자른다", () => {
    const message = weeklyMessage(
      now,
      stats({ topPosts: [{ title: "아주 긴 제목".repeat(10), views: 9 }] }),
    );

    expect(message).toContain("…」 9");
  });

  it("제목이 없는 글도 자리를 지킨다 — 지워진 글의 조회가 사라지면 안 된다", () => {
    expect(weeklyMessage(now, stats({ topPosts: [{ title: null, views: 9 }] }))).toContain(
      "「제목 없음」 9",
    );
  });

  it("읽힌 글이 없으면 그 줄을 놓지 않는다", () => {
    expect(weeklyMessage(now, stats({ topPosts: [] }))).not.toContain("많이 읽힌 글");
  });

  it("유입이 없으면 그 줄을 놓지 않는다", () => {
    expect(weeklyMessage(now, stats({ referrers: [] }))).not.toContain("유입");
  });

  /** "0/0 성공"은 실적이 아니라 고장으로 읽힌다. 미실행은 watchdog가 따로 알린다(06 §5) */
  it("크롤 실적이 없는 주는 크롤러를 적지 않는다", () => {
    const message = weeklyMessage(now, stats({ crawls: { success: 0, total: 0 } }));

    expect(message).toContain("발행 12편");
    expect(message).not.toContain("크롤러");
  });

  it("실패한 크롤이 있으면 분모에 남는다", () => {
    expect(weeklyMessage(now, stats({ crawls: { success: 5, total: 7 } }))).toContain("크롤러 5/7");
  });

  /** 백로그 3에 "묵상 침범 위험"이 달려 있다(06 §8). 숫자만 적고 평가하지 않는다 */
  it("기록을 평가하는 말을 붙이지 않는다", () => {
    const message = weeklyMessage(now, stats({ published: 0, views: 3, prevViews: 300 }));

    for (const word of ["잘", "부진", "아쉽", "힘내", "축하", "노력"]) {
      expect(message).not.toContain(word);
    }
  });
});
