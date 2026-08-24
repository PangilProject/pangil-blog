import { describe, expect, it } from "vitest";

import { watchdogVerdict } from "@/lib/crawler/watchdog";

/**
 * 06 §5. 알림이 **오지 않는** 버그는 알림이 오는 버그보다 늦게 발견된다 —
 * 그래서 조건을 전부 고정한다.
 */

/** KST 11:00 = UTC 02:00, Vercel 크론이 실제로 부르는 시각 */
const monday = new Date("2026-08-24T02:00:00.000Z");
const sunday = new Date("2026-08-23T02:00:00.000Z");

describe("watchdogVerdict", () => {
  it("흔적이 없으면 알린다 — 프리모템 #1의 최악(아예 안 돎)", () => {
    const verdict = watchdogVerdict({ now: monday, run: null });

    expect(verdict.alert).toBe(true);
    if (!verdict.alert) return;
    expect(verdict.message).toContain("2026-08-24");
    expect(verdict.message).toContain("실행 흔적 없음");
    expect(verdict.message).toContain("수동 폴백");
  });

  it("실패로 끝난 날도 알린다 — 원인을 알림에 싣는다", () => {
    const verdict = watchdogVerdict({
      now: monday,
      run: { status: "FAILED", errorMessage: "parse · 질문이 5개 (기대 6)" },
    });

    expect(verdict.alert).toBe(true);
    if (!verdict.alert) return;
    expect(verdict.message).toContain("질문이 5개");
  });

  it("성공·미게시는 조용하다", () => {
    expect(watchdogVerdict({ now: monday, run: { status: "SUCCESS" } }).alert).toBe(false);
    expect(watchdogVerdict({ now: monday, run: { status: "SKIPPED" } }).alert).toBe(false);
  });

  it("일요일은 큐티가 없으니 흔적이 없어도 조용하다", () => {
    const verdict = watchdogVerdict({ now: sunday, run: null });

    expect(verdict.alert).toBe(false);
    if (verdict.alert) return;
    expect(verdict.reason).toBe("sunday");
  });

  it("UTC 자정 이후 KST 날짜로 판단한다 — UTC 일요일 15:00은 KST 월요일이다", () => {
    // 2026-08-23T15:00Z = 2026-08-24 00:00 KST(월). 일요일 면제가 적용되면 안 된다
    const verdict = watchdogVerdict({ now: new Date("2026-08-23T15:00:00.000Z"), run: null });

    expect(verdict.alert).toBe(true);
  });
});
