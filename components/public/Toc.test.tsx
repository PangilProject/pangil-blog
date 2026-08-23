import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toc } from "@/components/public/Toc";

/**
 * 목차는 아일랜드 4개 중 하나다(04 §3.6). jsdom에 IntersectionObserver가 없으므로 채워 넣고,
 * 여기서는 "무엇을 그리는가"와 "언제 그리지 않는가"를 고정한다.
 */
beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = "";
      thresholds = [];
    },
  );
});

const first = { id: "정리", text: "정리", level: 2 as const };
const headings = [first, { id: "태그-체계", text: "태그 체계", level: 3 as const }];

describe("Toc", () => {
  it("제목을 앵커 링크로 그린다", () => {
    render(<Toc headings={headings} />);

    const links = screen.getAllByRole("link", { name: "정리" });
    expect(links[0]).toHaveAttribute("href", "#정리");
    expect(screen.getAllByRole("link", { name: "태그 체계" })[0]).toHaveAttribute(
      "href",
      "#태그-체계",
    );
  });

  it("제목이 하나면 목차를 놓지 않는다 — 한 줄짜리 목차는 지면만 먹는다", () => {
    const { container } = render(<Toc headings={[first]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("제목이 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<Toc headings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("첫 항목이 현재 위치로 표시된다", () => {
    render(<Toc headings={headings} />);
    expect(screen.getAllByRole("link", { name: "정리" })[0]).toHaveAttribute(
      "aria-current",
      "location",
    );
  });
});
