import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * 방문자 수는 async 서버 컴포넌트이고 DB를 만진다 — jsdom에서 await되지 않고, 불러오는
 * 것만으로 Prisma가 env를 요구한다. 이 테스트의 주제는 푸터의 링크와 저작권이라 대역을 세운다.
 */
vi.mock("@/components/public/VisitorCount", () => ({
  VisitorCount: () => <span data-testid="visitors" />,
}));

const { copyrightLine, SiteFooter } = await import("@/components/public/SiteFooter");

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
