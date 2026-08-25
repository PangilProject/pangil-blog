import { describe, expect, it } from "vitest";

import { StatPayloadSchema } from "@/lib/stats/statSchema";

const valid = { site: "dev", eventType: "PAGEVIEW", path: "/dev/prisma-7" } as const;

describe("StatPayloadSchema", () => {
  it("최소 payload를 받는다", () => {
    expect(StatPayloadSchema.safeParse(valid).success).toBe(true);
  });

  it("모르는 지면·이벤트는 거절한다", () => {
    expect(StatPayloadSchema.safeParse({ ...valid, site: "blog" }).success).toBe(false);
    expect(StatPayloadSchema.safeParse({ ...valid, eventType: "CLICK" }).success).toBe(false);
  });

  it("빈 path는 거절한다", () => {
    expect(StatPayloadSchema.safeParse({ ...valid, path: "" }).success).toBe(false);
  });

  it("긴 문자열을 거절한다 — 통계 테이블이 남의 쿼리스트링으로 부풀지 않게", () => {
    expect(StatPayloadSchema.safeParse({ ...valid, path: "/".repeat(513) }).success).toBe(false);
    expect(StatPayloadSchema.safeParse({ ...valid, referrer: "x".repeat(1025) }).success).toBe(
      false,
    );
    expect(StatPayloadSchema.safeParse({ ...valid, postId: "x".repeat(41) }).success).toBe(false);
  });

  it("음수·비현실적 체류 시간을 거절한다 — 켜둔 탭 하나가 평균을 망치지 않게", () => {
    expect(StatPayloadSchema.safeParse({ ...valid, durationMs: -1 }).success).toBe(false);
    expect(StatPayloadSchema.safeParse({ ...valid, durationMs: 13 * 60 * 60 * 1000 }).success).toBe(
      false,
    );
    expect(StatPayloadSchema.safeParse({ ...valid, durationMs: 1.5 }).success).toBe(false);
    expect(StatPayloadSchema.safeParse({ ...valid, durationMs: 42_000 }).success).toBe(true);
  });
});
