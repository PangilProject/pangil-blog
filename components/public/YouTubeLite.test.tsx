import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { YouTubeLite } from "@/components/public/YouTubeLite";

/**
 * 아일랜드 4개 중 하나다(04 §3.6). 이 컴포넌트의 존재 이유는 **클릭 전에 iframe을 심지 않는
 * 것**이므로, 그것과 "JS 없이도 유튜브로 갈 수 있다"를 함께 고정한다.
 */
const props = { videoId: "dQw4w9WgXcQ", title: "손잡고 함께 가세" };

describe("YouTubeLite", () => {
  it("클릭 전에는 iframe이 없다 — 썸네일 한 장이다", () => {
    const { container } = render(<YouTubeLite {...props} />);

    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("src")).toContain("dQw4w9WgXcQ");
  });

  it("JS가 없어도 유튜브로 가는 링크다", () => {
    render(<YouTubeLite {...props} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });

  it("누르면 그 자리에서 재생한다", () => {
    const { container } = render(<YouTubeLite {...props} />);

    fireEvent.click(screen.getByRole("link"));

    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1",
    );
    expect(iframe?.getAttribute("title")).toBe("손잡고 함께 가세");
  });

  it("새 창으로 열려던 클릭은 가로채지 않는다", () => {
    const { container } = render(<YouTubeLite {...props} />);

    fireEvent.click(screen.getByRole("link"), { metaKey: true });

    expect(container.querySelector("iframe")).toBeNull();
  });
});
