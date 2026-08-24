import { describe, expect, it } from "vitest";

import type { RecordType } from "@/lib/record/callNumber";
import { reminderMessage } from "@/lib/record/reminder";
import type { TodayPost } from "@/lib/record/todayCard";

/** KST 21:00 = UTC 12:00, 저녁 크론이 부르는 시각 */
const now = new Date("2026-08-24T12:00:00.000Z");

function post(status: TodayPost["status"]): TodayPost {
  return { id: "p1", status, title: "제목", createdAt: now, updatedAt: now };
}

function posts(entries: [RecordType, TodayPost][]) {
  return new Map(entries);
}

describe("reminderMessage", () => {
  it("다 발행한 날은 아무 말도 하지 않는다", () => {
    expect(
      reminderMessage({
        now,
        types: ["QT", "PRAISE"],
        posts: posts([
          ["QT", post("PUBLISHED")],
          ["PRAISE", post("PUBLISHED")],
        ]),
      }),
    ).toBeNull();
  });

  it("크롤러 초안만 있으면 아직 남지 않은 것이다", () => {
    const message = reminderMessage({
      now,
      types: ["QT", "PRAISE"],
      posts: posts([["QT", post("DRAFT")]]),
    });

    expect(message).toContain("8월 24일 월요일");
    expect(message).toContain("오늘의 큐티 초안");
    expect(message).toContain("오늘의 찬양 없음");
  });

  it("일요일은 설교·찬양을 센다", () => {
    const sunday = new Date("2026-08-23T12:00:00.000Z");
    const message = reminderMessage({ now: sunday, types: ["SERMON", "PRAISE"], posts: posts([]) });

    expect(message).toContain("오늘의 설교 없음");
    expect(message).not.toContain("큐티");
  });
});
