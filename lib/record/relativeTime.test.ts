import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "@/lib/record/relativeTime";

const now = new Date("2026-08-23T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("formatRelativeTime", () => {
  it("1분 미만은 방금이다", () => {
    expect(formatRelativeTime(ago(0), now)).toBe("방금");
    expect(formatRelativeTime(ago(59_000), now)).toBe("방금");
  });

  it("분·시간·일 단위로 올라간다", () => {
    expect(formatRelativeTime(ago(5 * 60_000), now)).toBe("5분 전");
    expect(formatRelativeTime(ago(3 * 3_600_000), now)).toBe("3시간 전");
    expect(formatRelativeTime(ago(26 * 3_600_000), now)).toBe("어제");
    expect(formatRelativeTime(ago(3 * 86_400_000), now)).toBe("3일 전");
  });

  it("미래 시각도 방금으로 흡수한다 — 음수 시간을 보일 이유가 없다", () => {
    expect(formatRelativeTime(new Date(now.getTime() + 5_000), now)).toBe("방금");
  });
});
