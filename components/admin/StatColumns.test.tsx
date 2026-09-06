import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatColumns } from "@/components/admin/StatColumns";
import type { SeriesPoint } from "@/lib/db/statSummary";

const point = (over: Partial<SeriesPoint> = {}): SeriesPoint => ({
  key: "2026-09-06",
  label: "9/6",
  views: 10,
  devViews: 6,
  faithViews: 3,
  visitors: 4,
  ...over,
});

/** 막대 조각들의 height 스타일 (툴팁·빈 칸은 style이 없다) */
function shares(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>("div[style*='height']")]
    .map((node) => node.style.height)
    .filter((height) => height.endsWith("%"));
}

describe("StatColumns", () => {
  /**
   * 상자 높이는 그날의 **전체** 조회로 잡는데 칠하는 것이 기술·묵상뿐이었다. 소개 지면을
   * 본 날마다 그 차이만큼 막대 위가 비어서, 값보다 짧게 그려졌다.
   */
  it("칠한 것의 합이 상자를 채운다 — 두 지면이 아닌 조회가 있어도", () => {
    const { container } = render(
      <StatColumns points={[point({ views: 10, devViews: 6, faithViews: 3 })]} unit="day" />,
    );

    const sum = shares(container).reduce((total, height) => total + Number.parseFloat(height), 0);
    expect(sum).toBeCloseTo(100, 5);
  });

  it("남는 조회가 없으면 그 칸은 0이다", () => {
    const { container } = render(
      <StatColumns points={[point({ views: 9, devViews: 6, faithViews: 3 })]} unit="day" />,
    );

    const sum = shares(container).reduce((total, height) => total + Number.parseFloat(height), 0);
    expect(sum).toBeCloseTo(100, 5);
  });

  /** 지면 합이 전체를 넘는 이상한 데이터에서도 음수 높이를 그리지 않는다 */
  it("합이 넘쳐도 음수를 그리지 않는다", () => {
    const { container } = render(
      <StatColumns points={[point({ views: 5, devViews: 6, faithViews: 3 })]} unit="day" />,
    );

    for (const height of shares(container)) {
      expect(Number.parseFloat(height)).toBeGreaterThanOrEqual(0);
    }
  });

  it("남는 조회를 툴팁이 말한다", () => {
    const { container } = render(
      <StatColumns points={[point({ views: 10, devViews: 6, faithViews: 3 })]} unit="day" />,
    );

    expect(container.textContent).toContain("소개 1");
  });
});
