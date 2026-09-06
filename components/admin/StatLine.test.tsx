import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatLine } from "@/components/admin/StatLine";
import type { SeriesPoint } from "@/lib/db/statSummary";

const point = (key: string, views: number, over: Partial<SeriesPoint> = {}): SeriesPoint => ({
  key,
  label: key.slice(5),
  views,
  devViews: 0,
  faithViews: 0,
  visitors: null,
  ...over,
});

const axis = (container: HTMLElement) =>
  [...container.querySelectorAll("span.flex-1")].map((node) => node.textContent?.trim());

describe("StatLine", () => {
  it("점을 칸마다 하나씩 놓는다", () => {
    const { container } = render(
      <StatLine points={[point("2026-09-04", 3), point("2026-09-05", 9)]} unit="day" />,
    );

    expect(container.querySelectorAll("span.rounded-full")).toHaveLength(2);
  });

  /** 선의 x는 칸 인덱스다 — 점과 어긋나면 그래프가 거짓말을 한다 */
  it("선이 모든 점을 잇는다", () => {
    const { container } = render(
      <StatLine
        points={[point("2026-09-04", 0), point("2026-09-05", 5), point("2026-09-06", 10)]}
        unit="day"
      />,
    );

    const xs = (container.querySelector("polyline")?.getAttribute("points") ?? "")
      .split(" ")
      .map((pair) => pair.split(",")[0]);
    expect(xs).toEqual(["0", "1", "2"]);
  });

  it("칸이 하나면 선을 그리지 않는다", () => {
    const { container } = render(<StatLine points={[point("2026-09-06", 4)]} unit="day" />);

    expect(container.querySelector("polyline")).toBeNull();
  });

  /** 값이 0인 날도 점이 있어야 한다 — 없으면 "그날은 없었다"로 읽힌다 */
  it("0인 날에도 점을 남긴다", () => {
    const { container } = render(
      <StatLine points={[point("2026-09-05", 0), point("2026-09-06", 8)]} unit="day" />,
    );

    expect(container.querySelectorAll("span.rounded-full")).toHaveLength(2);
  });

  /** 축을 읽는 기준점 — 맨 왼쪽과 달이 바뀌는 자리에만 월이 붙는다 */
  it("달이 바뀌는 자리에만 월을 적는다", () => {
    const { container } = render(
      <StatLine
        points={[
          point("2026-08-30", 1),
          point("2026-08-31", 1),
          point("2026-09-01", 1),
          point("2026-09-02", 1),
        ]}
        unit="day"
      />,
    );

    expect(axis(container)).toEqual(["8/30", "31", "9/1", "2"]);
  });

  it("지금 칸은 테두리로 구별한다", () => {
    const { container } = render(
      <StatLine points={[point("2026-09-05", 3), point("2026-09-06", 4)]} unit="day" />,
    );

    const dots = [...container.querySelectorAll("span.rounded-full")];
    expect(dots.at(-1)?.className).toContain("border-2");
    expect(dots[0]?.className).not.toContain("border-2");
  });

  it("툴팁이 지면별 구성을 말한다 — 선은 총합 하나만 그린다", () => {
    const { container } = render(
      <StatLine points={[point("2026-09-06", 10, { devViews: 6, faithViews: 3 })]} unit="day" />,
    );

    expect(container.textContent).toContain("기술 6");
    expect(container.textContent).toContain("묵상 3");
    expect(container.textContent).toContain("소개 1");
  });
  /**
   * 한 줄로 이어 적던 것을 표로 세운 자리다. 이 화면의 질문이 "늘고 있나"이므로
   * **앞 칸과의 차이**가 툴팁에 있어야 한다.
   */
  it("툴팁이 앞 칸과의 차이를 적는다", () => {
    const { container } = render(
      <StatLine points={[point("2026-09-05", 15), point("2026-09-06", 31)]} unit="day" />,
    );

    expect(container.textContent).toContain("▲16");
  });

  it("줄어든 날은 내림표로 적는다", () => {
    const { container } = render(
      <StatLine points={[point("2026-09-05", 31), point("2026-09-06", 15)]} unit="day" />,
    );

    expect(container.textContent).toContain("▼16");
  });

  /** 첫 칸에는 비교 대상이 없다 — 없는 차이를 0으로 적으면 "변화 없음"이라는 거짓말이 된다 */
  it("첫 칸에는 차이를 적지 않는다", () => {
    const { container } = render(<StatLine points={[point("2026-09-06", 9)]} unit="day" />);

    expect(container.textContent).not.toContain("▲");
    expect(container.textContent).not.toContain("±");
  });

  it("날짜를 사람이 읽는 말로 적는다", () => {
    const { container } = render(<StatLine points={[point("2026-09-06", 9)]} unit="day" />);

    expect(container.textContent).toContain("9월 6일");
  });

  /** 방문자는 하루 단위에만 있다 — 주·월은 여러 날을 이을 수 없다(05 §4.2) */
  it("방문자가 없는 단위에서는 그 줄을 놓지 않는다", () => {
    const { container } = render(
      <StatLine points={[point("2026-09", 40, { label: "9월" })]} unit="month" />,
    );

    expect(container.textContent).not.toContain("방문자");
  });
});
