import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Stagger } from "@/components/record/Stagger";

describe("Stagger — 03 §4 순차 등장", () => {
  it("자식마다 순번만 심는다 — 애니메이션은 CSS가 한다", () => {
    render(
      <Stagger>
        <div data-testid="a">첫째</div>
        <div data-testid="b">둘째</div>
        <div data-testid="c">셋째</div>
      </Stagger>,
    );

    expect(screen.getByTestId("a").style.getPropertyValue("--stagger-index")).toBe("0");
    expect(screen.getByTestId("b").style.getPropertyValue("--stagger-index")).toBe("1");
    expect(screen.getByTestId("c").style.getPropertyValue("--stagger-index")).toBe("2");
    expect(screen.getByTestId("a").className).toContain("record-appear");
  });

  it("startIndex로 이어 세운다 — 페이지네이션 2쪽", () => {
    render(
      <Stagger startIndex={12}>
        <div data-testid="a">열셋째</div>
      </Stagger>,
    );

    expect(screen.getByTestId("a").style.getPropertyValue("--stagger-index")).toBe("12");
  });

  it("자식이 원래 갖고 있던 className과 style을 지우지 않는다", () => {
    render(
      <Stagger>
        <div data-testid="a" className="shadow-card" style={{ color: "red" }}>
          카드
        </div>
      </Stagger>,
    );

    const child = screen.getByTestId("a");
    expect(child.className).toContain("shadow-card");
    expect(child.className).toContain("record-appear");
    expect(child.style.color).toBe("red");
  });

  it("엘리먼트가 아닌 자식은 그대로 통과시킨다", () => {
    render(<Stagger>텍스트</Stagger>);
    expect(screen.getByText("텍스트")).toBeInTheDocument();
  });
});
