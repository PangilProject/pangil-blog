import { describe, expect, it } from "vitest";

import {
  countKstDays,
  formatKstDay,
  isSunday,
  kstDateAsUtcMidnight,
  kstDateKey,
  startOfKstDay,
  startOfKstMonth,
  startOfKstWeek,
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

describe("startOfKstMonth", () => {
  it("KST 이번 달 1일 0시를 UTC 시각으로 준다", () => {
    expect(startOfKstMonth(new Date("2026-08-23T05:00:00Z")).toISOString()).toBe(
      "2026-07-31T15:00:00.000Z",
    );
  });

  it("KST로 달이 바뀌는 경계를 지킨다 — UTC 말일 15시가 다음 달 1일 0시다", () => {
    expect(startOfKstMonth(new Date("2026-08-31T15:00:00Z")).toISOString()).toBe(
      "2026-08-31T15:00:00.000Z",
    );
    expect(startOfKstMonth(new Date("2026-08-31T14:00:00Z")).toISOString()).toBe(
      "2026-07-31T15:00:00.000Z",
    );
  });
});

/**
 * **이 블로그의 주는 일요일에 시작한다.** 설교가 주일 예배에서 나오므로(02 §2.4) 월요일로
 * 끊으면 설교와 그 주의 나머지가 다른 주로 갈린다 — `이번 주 N/7`이 매주 첫날부터 어긋난다.
 */
describe("startOfKstWeek — 주는 일요일에 시작한다", () => {
  it("수요일에서 보면 그 주 일요일 0시다", () => {
    // 2026-09-16(수) KST 낮 → 그 주 일요일은 9/13
    const wednesday = new Date("2026-09-16T05:00:00.000Z");

    expect(kstDateKey(startOfKstWeek(wednesday))).toBe("2026-09-13");
  });

  it("일요일에는 그날 0시다 — 한 주 전으로 밀리지 않는다", () => {
    const sunday = new Date("2026-09-13T05:00:00.000Z");

    expect(kstDateKey(startOfKstWeek(sunday))).toBe("2026-09-13");
  });

  /** KST 자정 직전은 아직 어제다. UTC로 재면 하루 밀려 주가 통째로 어긋난다 */
  it("KST 토요일 밤 11시는 아직 그 주다", () => {
    // 2026-09-19(토) KST 23:00 = UTC 14:00
    const saturdayNight = new Date("2026-09-19T14:00:00.000Z");

    expect(kstDateKey(startOfKstWeek(saturdayNight))).toBe("2026-09-13");
  });

  it("KST 일요일 0시를 넘기면 새 주다", () => {
    // 2026-09-20(일) KST 00:30 = UTC 2026-09-19 15:30
    const justPastMidnight = new Date("2026-09-19T15:30:00.000Z");

    expect(kstDateKey(startOfKstWeek(justPastMidnight))).toBe("2026-09-20");
  });
});

/**
 * `이번 주 N/7`이 묻는 것은 "며칠 썼나"다. 이 셈이 틀리면 매일 여는 화면의 숫자가 틀린다.
 */
describe("countKstDays — 날을 세지 장수를 세지 않는다", () => {
  it("같은 날 세 편은 하루다", () => {
    const times = [
      new Date("2026-09-13T01:00:00.000Z"),
      new Date("2026-09-13T05:00:00.000Z"),
      new Date("2026-09-13T09:00:00.000Z"),
    ];

    expect(countKstDays(times)).toBe(1);
  });

  /**
   * **여기가 UTC로 세면 틀리는 자리다.** KST 밤 9시 이후는 UTC로 다음 날이라,
   * 같은 날 저녁에 쓴 둘이 이틀로 세어진다.
   */
  it("KST 같은 날의 아침과 밤은 하루다", () => {
    const morning = new Date("2026-09-13T00:00:00.000Z"); // KST 09:00
    const night = new Date("2026-09-13T14:00:00.000Z"); // KST 23:00

    expect(countKstDays([morning, night])).toBe(1);
  });

  it("KST 자정을 넘기면 이틀이다", () => {
    const beforeMidnight = new Date("2026-09-13T14:00:00.000Z"); // KST 9/13 23:00
    const afterMidnight = new Date("2026-09-13T16:00:00.000Z"); // KST 9/14 01:00

    expect(countKstDays([beforeMidnight, afterMidnight])).toBe(2);
  });

  it("발행 안 한 글은 세지 않는다 — 날짜가 없다", () => {
    expect(countKstDays([null, undefined, new Date("2026-09-13T05:00:00.000Z")])).toBe(1);
  });

  it("하나도 없으면 0이다", () => {
    expect(countKstDays([])).toBe(0);
  });
});
