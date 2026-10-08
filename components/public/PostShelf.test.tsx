import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PostShelf } from "@/components/public/PostShelf";
import type { PostShelf as Shelf, ShelfPost } from "@/lib/db/publicPosts";

/**
 * 같은 축의 다른 글. 여기서 고정하는 것은 "지금 글은 누를 수 없다"와
 * "떠오르는 카드가 바로 앞뒤 글을 가리킨다"다. 모양(넓은/좁은 화면)은 조판이라 보지 않는다.
 */
const post = (n: number): ShelfPost => ({
  title: `회고 ${n}`,
  slug: `${n}`,
  type: "TECH",
  callNumber: n,
  publishedAt: new Date("2026-08-01T00:00:00Z"),
  excerpt: `요약 ${n}`,
});

const shelf: Shelf = {
  total: 16,
  items: [
    { ...post(14), current: false },
    { ...post(11), current: false },
    { ...post(10), current: true },
    { ...post(9), current: false },
    { ...post(6), current: false },
  ],
  previous: post(9),
  next: post(11),
};

describe("PostShelf", () => {
  it("다섯 줄 중 지금 글만 링크가 아니다", () => {
    render(<PostShelf shelf={shelf} axisLabel="회고" allHref="/dev?category=retro" />);

    const list = screen.getByRole("region", { name: /회고/ });
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);

    const current = within(list).getByText("회고 10").closest("[aria-current]");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current?.closest("a")).toBeNull();

    expect(within(list).getByRole("link", { name: "전체 보기 →" })).toHaveAttribute(
      "href",
      "/dev?category=retro",
    );
  });

  it("떠오르는 카드는 바로 앞뒤 글이고 각자 닫힌다", () => {
    render(<PostShelf shelf={shelf} axisLabel="회고" allHref="/dev" />);

    const nav = screen.getByRole("navigation", { name: "이전 글 다음 글" });
    expect(within(nav).getByRole("link", { name: /이전 글/ })).toHaveAttribute("href", "/dev/9");
    expect(within(nav).getByRole("link", { name: /다음 글/ })).toHaveAttribute("href", "/dev/11");
    expect(within(nav).getAllByRole("checkbox")).toHaveLength(2);
  });

  it("축에 이 글 하나뿐이면 아무것도 그리지 않는다", () => {
    const { container } = render(
      <PostShelf
        shelf={{ total: 1, items: [{ ...post(1), current: true }], previous: null, next: null }}
        axisLabel="회고"
        allHref="/dev"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
