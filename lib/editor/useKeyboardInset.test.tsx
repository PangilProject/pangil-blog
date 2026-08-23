import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MOBILE_MEDIA_QUERY, useKeyboardInset } from "@/lib/editor/useKeyboardInset";

/**
 * QT 답변은 유일하게 모바일에서 실제로 쓰이는 작성이다(01 §2.1). 키보드가 툴바를 덮으면
 * 서식을 쓸 수 없으므로 높이 계산을 테스트로 고정한다. iOS 실기기 검증은 별도다(02 §5.2).
 */

function Probe() {
  return <span data-testid="inset">{useKeyboardInset()}</span>;
}

type FakeViewport = { height: number; offsetTop: number };

function setup({
  viewport,
  isMobile = true,
  innerHeight = 800,
}: {
  viewport: FakeViewport | null;
  isMobile?: boolean;
  innerHeight?: number;
}) {
  vi.stubGlobal("innerHeight", innerHeight);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === MOBILE_MEDIA_QUERY ? isMobile : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "visualViewport",
    viewport ? { ...viewport, addEventListener: vi.fn(), removeEventListener: vi.fn() } : undefined,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useKeyboardInset", () => {
  it("키보드가 올라온 만큼 값을 낸다", () => {
    setup({ viewport: { height: 460, offsetTop: 0 } });
    render(<Probe />);

    expect(screen.getByTestId("inset").textContent).toBe("340");
  });

  it("확대·스크롤로 뷰포트가 밀린 만큼은 빼고 센다", () => {
    setup({ viewport: { height: 460, offsetTop: 40 } });
    render(<Probe />);

    expect(screen.getByTestId("inset").textContent).toBe("300");
  });

  it("주소창이 접힌 정도는 키보드로 보지 않는다", () => {
    setup({ viewport: { height: 740, offsetTop: 0 } });
    render(<Probe />);

    expect(screen.getByTestId("inset").textContent).toBe("0");
  });

  it("데스크탑 폭에서는 0이다 — 툴바는 상단 sticky 그대로다", () => {
    setup({ viewport: { height: 460, offsetTop: 0 }, isMobile: false });
    render(<Probe />);

    expect(screen.getByTestId("inset").textContent).toBe("0");
  });

  it("visualViewport가 없는 브라우저에서는 아무것도 하지 않는다", () => {
    setup({ viewport: null });

    act(() => {
      render(<Probe />);
    });

    expect(screen.getByTestId("inset").textContent).toBe("0");
  });
});
