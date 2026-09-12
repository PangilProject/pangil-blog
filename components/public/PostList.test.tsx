import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PostList } from "@/components/public/PostList";
import type { ListCard } from "@/lib/db/publicLists";

/**
 * 목록 카드는 상세 지면·OG 카드와 같은 조판을 쓴다(04 §3.5). 여기서 고정하는 것은
 * "어디로 가는가"와 "지면별로 무엇을 보여주는가"다.
 */
const base: ListCard = {
  id: "post-1",
  type: "QT",
  title: "주님이 네 악을",
  slug: "qt-1",
  callNumber: 1,
  publishedAt: new Date("2026-08-23T00:00:00Z"),
  excerpt: null,
  thumbnailUrl: null,
  categoryName: null,
  categorySlug: null,
  scriptureRef: "열왕기상 2장 41~46절",
  tags: [],
};

describe("PostList", () => {
  it("카드가 그 글의 공개 지면을 가리킨다", () => {
    render(<PostList cards={[base]} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/faith/qt-1");
    expect(screen.getByText("주님이 네 악을")).toBeInTheDocument();
  });

  it("faith 카드는 말씀 범위와 타입을 보여준다", () => {
    render(<PostList cards={[base]} />);

    expect(screen.getByText("열왕기상 2장 41~46절")).toBeInTheDocument();
    expect(screen.getByText(/큐티/)).toBeInTheDocument();
    expect(screen.getByText("QT-0001")).toBeInTheDocument();
  });

  it("dev 카드는 요약과 태그를 보여준다 — 카테고리는 청구기호에 이미 있다(03 §6.3)", () => {
    render(
      <PostList
        cards={[
          {
            ...base,
            id: "post-2",
            type: "TECH",
            slug: "next-16",
            title: "Next 16 캐시",
            excerpt: "무효화를 두 갈래로 나눴다",
            scriptureRef: null,
            categoryName: "FE",
            categorySlug: "fe",
            tags: ["Next.js", "캐시"],
          },
        ]}
      />,
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", "/dev/next-16");
    expect(screen.getByText("무효화를 두 갈래로 나눴다")).toBeInTheDocument();
    // 청구기호 줄에만 카테고리가 있다
    expect(screen.getByText("0001 · FE")).toBeInTheDocument();
    expect(screen.getByText("Next.js · 캐시")).toBeInTheDocument();
  });

  it("빈 목록은 칸이 비었다고 말한다 (03 §5.1)", () => {
    render(<PostList cards={[]} />);

    expect(screen.getByText("이 칸은 아직 비어 있어요")).toBeInTheDocument();
  });

  it("검색 결과가 없을 때는 문구를 갈아끼운다", () => {
    render(<PostList cards={[]} emptyMessage="찾는 기록이 없어요" />);

    expect(screen.getByText("찾는 기록이 없어요")).toBeInTheDocument();
  });

  it("카드 회전은 인덱스에서 나오는 고정값이다 — 볼 때마다 흔들리면 안 된다", () => {
    const cards = [base, { ...base, id: "post-2", slug: "qt-2" }];
    const first = render(<PostList cards={cards} />).container.innerHTML;
    const second = render(<PostList cards={cards} />).container.innerHTML;

    expect(first).toBe(second);
  });

  /**
   * 시각이 아니라 데이터에서 나온다. 이 목록은 캐시되고 그 캐시는 글이 발행될 때 갈리므로,
   * 렌더 중에 "오늘"을 읽으면 어제 만든 HTML이 오늘도 "오늘"이라고 적혀 있게 된다.
   */
  it("가장 최근에 올라온 글에 새 글 도장을 찍는다", () => {
    render(
      <PostList
        cards={[
          { ...base, id: "새것", slug: "qt-2", publishedAt: new Date("2026-09-12T01:00:00Z") },
          { ...base, id: "옛것", slug: "qt-1", publishedAt: new Date("2026-09-01T01:00:00Z") },
        ]}
      />,
    );

    expect(screen.getAllByText("새 글")).toHaveLength(1);
  });

  /**
   * 도장으로 찍었더니 오른쪽 위 **날짜를 덮었다.** 카드에는 빈 모서리가 없다 —
   * 윗줄 왼쪽(청구기호 옆)에 세워 날짜와 나란히 읽히게 한다.
   */
  it("표시가 날짜를 가리지 않는다", () => {
    render(<PostList cards={[{ ...base, publishedAt: new Date("2026-09-12T01:00:00Z") }]} />);

    expect(screen.getByText("새 글")).toBeInTheDocument();
    expect(screen.getByText("9월 12일")).toBeInTheDocument();
  });

  it("같은 날 올린 글은 함께 찍힌다 — 그 묶음이 이번에 올라온 것이다", () => {
    render(
      <PostList
        cards={[
          { ...base, id: "a", slug: "qt-3", publishedAt: new Date("2026-09-12T01:00:00Z") },
          { ...base, id: "b", slug: "qt-2", publishedAt: new Date("2026-09-12T09:00:00Z") },
          { ...base, id: "c", slug: "qt-1", publishedAt: new Date("2026-09-01T01:00:00Z") },
        ]}
      />,
    );

    expect(screen.getAllByText("새 글")).toHaveLength(2);
  });
});
