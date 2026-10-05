import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FilterMenu, TabMenu } from "@/components/admin/FilterMenu";

const faith = [
  { label: "전체", href: "/admin/posts" },
  { label: "큐티", href: "/admin/posts?type=QT" },
];
const tech = [
  { label: "회고", href: "/admin/posts?category=retrospective" },
  { label: "FE", href: "/admin/posts?category=fe" },
  { label: "미분류", href: "/admin/posts?category=_none" },
];

async function open(name: string) {
  await act(async () => {
    fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });
  });
}

describe("TabMenu (기술 ▾)", () => {
  it("아무 카테고리도 안 골랐으면 그냥 기술이다", () => {
    render(<TabMenu label="기술" items={tech} />);

    expect(screen.getByRole("button", { name: "기술" })).toHaveTextContent(/^기술$/);
  });

  it("고르면 탭 이름이 그 카테고리가 된다 — 기술 · 를 앞에 붙이지 않는다", () => {
    render(
      <TabMenu
        label="기술"
        items={tech.map((item) => ({ ...item, active: item.label === "FE" }))}
      />,
    );

    expect(screen.getByRole("button", { name: "기술: FE" })).toHaveTextContent(/^FE$/);
  });

  it("누르면 카테고리가 링크로 바로 열린다 — 한 번 누르고 한 번 고른다", async () => {
    render(<TabMenu label="기술" items={tech} />);
    await open("기술");

    expect(screen.getByRole("menuitem", { name: "FE" })).toHaveAttribute(
      "href",
      "/admin/posts?category=fe",
    );
    expect(screen.getByRole("menuitem", { name: "미분류" })).toBeInTheDocument();
  });
});

describe("FilterMenu (좁은 화면)", () => {
  const items = [...faith, ...tech.map((item) => ({ ...item, active: item.label === "FE" }))];

  it("접혀 있어도 지금 고른 분류를 적는다", () => {
    render(<FilterMenu items={items} label="분류 필터" />);

    expect(screen.getByRole("button", { name: "분류 필터: FE" })).toHaveTextContent("FE");
  });

  it("분류명만 이어서 나열한다 — 묵상·기술 머리글로 묶지 않는다", async () => {
    render(<FilterMenu items={items} label="분류 필터" />);
    await open("분류 필터: FE");

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "전체",
      "큐티",
      "회고",
      "FE",
      "미분류",
    ]);
    expect(screen.queryByText("묵상")).toBeNull();
    expect(screen.getByRole("menuitem", { name: "FE" })).toHaveAttribute("aria-current", "page");
  });

  it("아무것도 고르지 않았으면 첫 항목(전체)을 적는다", () => {
    render(<FilterMenu items={faith} label="분류 필터" />);

    expect(screen.getByRole("button", { name: "분류 필터: 전체" })).toBeInTheDocument();
  });
});
