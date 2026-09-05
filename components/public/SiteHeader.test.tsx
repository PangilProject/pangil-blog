import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/public/SiteHeader";

/**
 * `글쓰기`가 가는 곳은 지면이 정한다(A-03b). 이 매핑이 어긋나면 신앙 지면에서 기술 에디터가
 * 열린다 — 화면은 정상으로 보이고 저장 계약만 엉뚱해서 눈으로 잡기 어렵다.
 */
describe("SiteHeader", () => {
  it("기술 지면의 글쓰기는 기술 에디터로 간다", () => {
    render(<SiteHeader site="dev" />);

    expect(screen.getByRole("link", { name: "글쓰기" })).toHaveAttribute(
      "href",
      "/admin/write/tech",
    );
  });

  it("신앙 지면의 글쓰기는 묵상 글쓰기 하나로 간다 — 서식은 그 화면에서 고른다", () => {
    render(<SiteHeader site="faith" />);

    expect(screen.getByRole("link", { name: "글쓰기" })).toHaveAttribute(
      "href",
      "/admin/write/faith",
    );
  });

  it("목록과 RSS는 헤더에 없다 — 브랜드가 곧 목록이고, 구독은 푸터로 내렸다", () => {
    render(<SiteHeader site="faith" />);

    expect(screen.queryByRole("link", { name: "목록" })).toBeNull();
    expect(screen.queryByRole("link", { name: "RSS" })).toBeNull();
  });

  it("글쓰기는 로그인 여부와 무관하게 놓인다 — 갈리는 곳은 proxy다", () => {
    // 서버 컴포넌트이고 세션을 보지 않는다. 즉 렌더만으로 늘 있어야 한다
    render(<SiteHeader site="faith" />);

    expect(screen.getByRole("link", { name: "글쓰기" })).toHaveAttribute("rel", "nofollow");
  });
});
