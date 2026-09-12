import { act, render, screen } from "@testing-library/react";
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

describe("Toc — 누른 줄", () => {
  /**
   * 관찰 띠가 화면의 10~30%였을 때, 목차를 누르면 그 제목이 **맨 위(0%)** 로 올라가 띠 밖에
   * 놓였다 — 관찰자는 대신 띠에 들어온 다음 제목을 잡았고, 눌렀는데 다른 줄에 불이 들어왔다.
   */
  it("누르면 그 줄이 활성이 된다", async () => {
    render(<Toc headings={headings} />);

    const target = screen.getAllByRole("link", { name: "태그 체계" })[0] as HTMLElement;
    await act(async () => {
      target.click();
    });

    expect(target).toHaveAttribute("aria-current", "location");
  });

  it("누르기 전에는 첫 줄이 활성이다", () => {
    render(<Toc headings={headings} />);

    expect(screen.getAllByRole("link", { name: "정리" })[0]).toHaveAttribute(
      "aria-current",
      "location",
    );
  });

  /** 띠가 화면 맨 위에서 시작해야 눌러서 올라온 제목이 그 안에 든다 */
  it("관찰 띠가 화면 맨 위에서 시작한다", () => {
    const margins: string[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(_fn: unknown, options?: { rootMargin?: string }) {
          margins.push(options?.rootMargin ?? "");
        }
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
        takeRecords = vi.fn(() => []);
        root = null;
        rootMargin = "";
        thresholds = [];
      },
    );

    // 관찰자는 실제 제목 요소를 찾았을 때만 만들어진다
    const article = document.createElement("div");
    article.innerHTML = `<h2 id="${first.id}"></h2><h3 id="태그-체계"></h3>`;
    document.body.append(article);

    render(<Toc headings={headings} />);

    expect(margins[0]).toMatch(/^0px/);
    article.remove();
  });
});

/**
 * 좁은 화면의 목차는 상단에 붙어 **지금 읽는 절**을 말한다. 그 값은 여태 넓은 화면의
 * 하이라이트에만 쓰이던 것이라, 관찰자가 고른 절과 이 줄이 같은 것을 가리켜야 한다.
 */
describe("모바일 상단 줄", () => {
  it("지금 읽는 절을 적는다 — 아직 못 정했으면 첫 절이다", () => {
    render(<Toc headings={headings} />);

    expect(screen.getByText("지금").parentElement).toHaveTextContent("정리");
  });

  it("관찰자가 다른 절을 고르면 그 절로 바뀐다", () => {
    render(<Toc headings={headings} />);

    // 두 번째 제목 링크를 누르면 그 절이 현재가 된다(관찰자보다 먼저 반응한다)
    act(() => {
      screen.getAllByRole("link", { name: "태그 체계" })[0]?.click();
    });

    expect(screen.getByText("지금").parentElement).toHaveTextContent("태그 체계");
  });
});
