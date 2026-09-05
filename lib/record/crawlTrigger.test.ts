import { describe, expect, it } from "vitest";

import { crawlTriggerLabel, crawlTriggerState } from "@/lib/record/crawlTrigger";

/** KST 기준 날짜를 만든다 — 자정 근처가 아니라 한낮으로 잡아 시프트를 피한다 */
const at = (key: string) => new Date(`${key}T03:00:00.000Z`);

const SUNDAY = at("2026-09-06");
const MONDAY = at("2026-09-07");

describe("crawlTriggerState", () => {
  it("일요일은 크롤이 도는 날이 아니다", () => {
    expect(crawlTriggerState(SUNDAY, null)).toBe("none");
  });

  it("흔적이 없으면 손으로 부를 수 있다", () => {
    expect(crawlTriggerState(MONDAY, null)).toBe("ready");
  });

  it("가져왔으면 잠긴다 — 같은 날 다시 부를 이유가 없다", () => {
    expect(crawlTriggerState(MONDAY, { status: "SUCCESS", postId: "p1" })).toBe("done");
  });

  it("큐티 없는 날도 끝난 것이다", () => {
    expect(crawlTriggerState(MONDAY, { status: "SKIPPED", postId: null })).toBe("done");
  });

  /**
   * 규약("한 번 돌았으면 비활성")을 일부러 비껴가는 자리다. 실패한 크롤은 아무것도 만들지
   * 않았으므로 그날 큐티는 여전히 없다 — 가장 손이 필요한 날에 버튼이 잠기면 안 된다.
   */
  it("실패는 끝난 것이 아니다 — 다시 부를 수 있다", () => {
    expect(crawlTriggerState(MONDAY, { status: "FAILED", postId: null })).toBe("retry");
  });
});

describe("crawlTriggerLabel", () => {
  it("다시 부르는 것은 처음 부르는 것과 다른 일이다", () => {
    expect(crawlTriggerLabel("ready")).toBe("큐티 가져오기");
    expect(crawlTriggerLabel("retry")).toBe("다시 가져오기");
  });
});
