import { describe, expect, it } from "vitest";

import { parseUnit, UNIT_BUCKETS, UNIT_WINDOW_DAYS, UNITS } from "@/lib/stats/range";

/**
 * 단위는 쿼리스트링으로 온다 — **남이 쓴 값**이다. 이 값이 그대로 SQL의 기간 계산에
 * 들어가므로(`since(UNIT_WINDOW_DAYS[unit])`) 여기서 막아야 한다.
 */
describe("parseUnit", () => {
  it("허용된 값은 그대로 쓴다", () => {
    expect(parseUnit("week")).toBe("week");
    expect(parseUnit("month")).toBe("month");
    expect(parseUnit("day")).toBe("day");
  });

  it("없거나 이상한 값은 일 단위로 되돌린다", () => {
    for (const value of [undefined, "", "year", "7", "DAY", "week; DROP TABLE"]) {
      expect(parseUnit(value), String(value)).toBe("day");
    }
  });

  it("배열로 와도(?unit=week&unit=month) 첫 값만 본다", () => {
    expect(parseUnit(["week", "month"])).toBe("week");
    expect(parseUnit(["year", "week"])).toBe("day");
  });
});

describe("관측 창", () => {
  it("모든 단위가 창과 막대 수를 갖는다 — 빠지면 화면이 빈 차트를 그린다", () => {
    for (const unit of UNITS) {
      expect(UNIT_WINDOW_DAYS[unit], unit).toBeGreaterThan(0);
      expect(UNIT_BUCKETS[unit], unit).toBeGreaterThan(0);
    }
  });

  it("단위가 커지면 창도 커진다 — 주가 일보다 짧으면 토글이 거짓말을 한다", () => {
    expect(UNIT_WINDOW_DAYS.day).toBeLessThan(UNIT_WINDOW_DAYS.week);
    expect(UNIT_WINDOW_DAYS.week).toBeLessThan(UNIT_WINDOW_DAYS.month);
  });

  it("주 단위 창은 막대 수를 담을 만큼 넓다", () => {
    expect(UNIT_WINDOW_DAYS.week).toBeGreaterThanOrEqual(UNIT_BUCKETS.week * 7);
  });
});
