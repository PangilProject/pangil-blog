import { describe, expect, it } from "vitest";

import {
  currentStreak,
  HEATMAP_DAYS,
  heatLabel,
  heatLevel,
  longestStreak,
  monthSpans,
  toHeatmapCells,
} from "@/lib/record/heatmap";

const today = new Date("2026-09-20T00:00:00.000Z");

describe("toHeatmapCells", () => {
  it("격자를 꽉 채운다", () => {
    expect(toHeatmapCells([], today)).toHaveLength(HEATMAP_DAYS);
  });

  it("오늘이 마지막 칸이다", () => {
    const cells = toHeatmapCells([], today);

    expect(cells.at(-1)?.date).toBe("2026-09-20");
  });

  it("빈 날도 칸을 차지한다 — 비어 있는 줄이 보여야 '매일'이 사실인지 읽힌다", () => {
    const cells = toHeatmapCells([{ date: "2026-09-20", count: 2 }], today);

    expect(cells.at(-1)).toEqual({ date: "2026-09-20", count: 2 });
    expect(cells.at(-2)).toEqual({ date: "2026-09-19", count: 0 });
  });

  it("격자 밖의 날짜는 버린다", () => {
    const cells = toHeatmapCells([{ date: "2019-01-01", count: 9 }], today);

    expect(cells.every((cell) => cell.count === 0)).toBe(true);
  });
});

describe("heatLevel", () => {
  it("쓰지 않은 날과 쓴 날을 가른다", () => {
    expect(heatLevel(0)).toBe(0);
    expect(heatLevel(1)).toBe(1);
    expect(heatLevel(2)).toBe(2);
    expect(heatLevel(7)).toBe(3);
  });
});

const day = (date: string, count: number) => ({ date, count });

describe("longestStreak", () => {
  it("가장 길게 이어 쓴 구간을 센다", () => {
    const cells = [
      day("2026-09-01", 1),
      day("2026-09-02", 2),
      day("2026-09-03", 0),
      day("2026-09-04", 1),
      day("2026-09-05", 1),
      day("2026-09-06", 3),
    ];

    expect(longestStreak(cells)).toBe(3);
  });

  it("한 번도 안 썼으면 0이다", () => {
    expect(longestStreak([day("2026-09-01", 0)])).toBe(0);
  });
});

describe("currentStreak", () => {
  it("끝에서부터 이어 온 날을 센다", () => {
    const cells = [day("2026-09-01", 0), day("2026-09-02", 1), day("2026-09-03", 2)];

    expect(currentStreak(cells)).toBe(2);
  });

  it("오늘이 비어 있어도 끊긴 것으로 보지 않는다 — 하루가 끝나지 않았다", () => {
    const cells = [day("2026-09-01", 1), day("2026-09-02", 1), day("2026-09-03", 0)];

    expect(currentStreak(cells)).toBe(2);
  });

  it("어제도 비었으면 끊긴 것이다", () => {
    const cells = [day("2026-09-01", 1), day("2026-09-02", 0), day("2026-09-03", 0)];

    expect(currentStreak(cells)).toBe(0);
  });
});

describe("heatLabel", () => {
  it("쓴 날은 장수를, 쉰 날은 쉼이라 적는다", () => {
    expect(heatLabel(day("2026-09-20", 2))).toBe("9월 20일 · 2장");
    expect(heatLabel(day("2026-09-20", 0))).toBe("9월 20일 · 쉼");
  });
});

describe("monthSpans", () => {
  it("달이 바뀌는 열을 찾는다", () => {
    const cells = toHeatmapCells([], new Date("2026-09-20T00:00:00.000Z"));
    const spans = monthSpans(cells);

    // 371일이면 13개월에 걸친다
    expect(spans.length).toBeGreaterThanOrEqual(12);
    expect(spans.at(-1)?.key).toBe("2026-09");
  });

  it("열 수를 합치면 격자의 열 수와 같다", () => {
    const cells = toHeatmapCells([], new Date("2026-09-20T00:00:00.000Z"));
    const total = monthSpans(cells).reduce((sum, span) => sum + span.weeks, 0);

    expect(total).toBe(Math.ceil(cells.length / 7));
  });

  it("해가 바뀌는 자리에만 연도를 적는다", () => {
    const cells = toHeatmapCells([], new Date("2026-09-20T00:00:00.000Z"));
    const january = monthSpans(cells).find((span) => span.key === "2026-01");

    expect(january?.label).toBe("26년 1월");
    expect(monthSpans(cells).find((span) => span.key === "2026-05")?.label).toBe("5월");
  });

  it("두 주가 안 되는 구간은 글자를 비운다 — 옆 달과 겹친다", () => {
    const cells = toHeatmapCells([], new Date("2026-09-20T00:00:00.000Z"));
    const narrow = monthSpans(cells).filter((span) => span.weeks < 2);

    for (const span of narrow) {
      expect(span.label).toBe("");
    }
  });
});
