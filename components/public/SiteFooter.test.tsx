import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { copyrightLine, SiteFooter } from "@/components/public/SiteFooter";

describe("SiteFooter", () => {
  /**
   * 연도는 요청 시점에 읽는 async 조각이라 jsdom이 await하지 못한다 — 조립만 순수 함수로
   * 떼어 본다. 이 줄이 지켜야 하는 것은 "해마다 사람이 고치지 않아도 된다"이다.
   */
  it("연도는 시계에서 온다 — 해마다 사람이 고쳐야 하는 숫자를 박아두지 않는다", () => {
    expect(copyrightLine(2031, "김광일")).toBe("© 2031 김광일");
  });

  it("이름이 없으면 연도만 남는다 — 자리표시자를 그리지 않는다", () => {
    expect(copyrightLine(2026, null)).toBe("© 2026");
  });

  it("다른 지면으로 건너갈 길을 둔다", () => {
    render(<SiteFooter site="faith" />);

    expect(screen.getByRole("link", { name: "개발의 기록" })).toHaveAttribute("href", "/dev");
  });

  it("구독은 헤더가 아니라 여기 있다", () => {
    render(<SiteFooter site="dev" />);

    expect(screen.getByRole("link", { name: "RSS" })).toHaveAttribute("href", "/rss.xml");
  });
});
