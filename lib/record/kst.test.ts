import { describe, expect, it } from "vitest";

import {
  formatKstDay,
  isSunday,
  kstDateAsUtcMidnight,
  kstDateKey,
  startOfKstDay,
  toKstDate,
} from "@/lib/record/kst";

/**
 * "오늘"은 항상 KST다. UTC 서버에서 도는 코드가 날짜를 하루 밀면 크롤러 멱등 키와 오늘의
 * 카드가 동시에 어긋난다 — 그래서 경계(자정 전후)를 테스트로 고정한다.
 */

describe("toKstDate", () => {
  it("UTC 오후는 같은 날이다", () => {
    expect(toKstDate(new Date("2026-08-23T05:00:00Z"))).toEqual({
      year: 2026,
      month: 8,
      day: 23,
      weekday: 0,
    });
  });

  it("UTC 15시 이후는 KST로 다음 날이다", () => {
    expect(toKstDate(new Date("2026-08-23T15:00:00Z"))).toMatchObject({ day: 24, weekday: 1 });
  });

  it("UTC 자정 직후는 KST로 아직 같은 날 오전 9시다", () => {
    expect(toKstDate(new Date("2026-08-23T00:10:00Z"))).toMatchObject({ day: 23 });
  });
});

describe("kstDateKey", () => {
  it("한 자리 월·일을 0으로 채운다", () => {
    expect(kstDateKey(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01-05");
  });

  it("UTC 15시에 날짜가 넘어간다", () => {
    expect(kstDateKey(new Date("2026-01-05T14:59:59Z"))).toBe("2026-01-05");
    expect(kstDateKey(new Date("2026-01-05T15:00:00Z"))).toBe("2026-01-06");
  });
});

describe("startOfKstDay", () => {
  it("KST 자정은 UTC 15시다", () => {
    expect(startOfKstDay(new Date("2026-08-23T05:00:00Z")).toISOString()).toBe(
      "2026-08-22T15:00:00.000Z",
    );
  });

  it("KST 자정 직후의 경계도 그날 0시를 가리킨다", () => {
    expect(startOfKstDay(new Date("2026-08-22T15:00:00Z")).toISOString()).toBe(
      "2026-08-22T15:00:00.000Z",
    );
  });
});

describe("kstDateAsUtcMidnight", () => {
  it("@db.Date 관례대로 UTC 자정으로 적는다", () => {
    expect(kstDateAsUtcMidnight(new Date("2026-08-23T05:00:00Z")).toISOString()).toBe(
      "2026-08-23T00:00:00.000Z",
    );
  });
});

describe("formatKstDay · isSunday", () => {
  it("헤더 표기", () => {
    expect(formatKstDay(new Date("2026-08-23T05:00:00Z"))).toBe("8월 23일 일요일");
  });

  it("일요일 판정도 KST 기준이다", () => {
    // UTC 토요일 밤 = KST 일요일 아침
    expect(isSunday(new Date("2026-08-22T16:00:00Z"))).toBe(true);
    expect(isSunday(new Date("2026-08-22T14:00:00Z"))).toBe(false);
  });
});
