import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DividerTabs } from "@/components/record/DividerTabs";
import { GroupTab } from "@/components/record/GroupTab";

const items = [
  { label: "전체", href: "/faith", active: true },
  { label: "큐티", href: "/faith/qt" },
  { label: "설교", href: "/faith/sermon" },
];

describe("DividerTabs — 03 §3 칸막이 탭", () => {
  it("탭은 링크다 — 필터가 URL로 공유되는 뷰이고 클라이언트 JS를 늘리지 않는다", () => {
    render(<DividerTabs items={items} label="묵상 타입 필터" />);

    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "큐티" })).toHaveAttribute("href", "/faith/qt");
  });

  it("활성 탭은 액센트 상단 인셋과 aria-current를 갖는다", () => {
    render(<DividerTabs items={items} label="묵상 타입 필터" />);

    const active = screen.getByRole("link", { name: "전체" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active.className).toContain("shadow-[inset_0_2px_0_var(--accent)]");
    expect(active.className).toContain("bg-card");
  });

  it("비활성 탭은 한 칸 내려앉은 표면색을 쓴다", () => {
    render(<DividerTabs items={items} label="묵상 타입 필터" />);

    const inactive = screen.getByRole("link", { name: "설교" });
    expect(inactive).not.toHaveAttribute("aria-current");
    expect(inactive.className).toContain("bg-surface-tab");
  });

  it("탭 묶음은 이름을 가진 내비게이션이다", () => {
    render(<DividerTabs items={items} label="묵상 타입 필터" />);
    expect(screen.getByRole("navigation", { name: "묵상 타입 필터" })).toBeInTheDocument();
  });
});

describe("GroupTab — 질문 그룹 헤더", () => {
  it("칸막이 탭과 같은 액센트 인셋을 쓴다", () => {
    render(<GroupTab>내용관찰</GroupTab>);

    const tab = screen.getByText("내용관찰");
    expect(tab.className).toContain("shadow-[inset_0_2px_0_var(--accent)]");
    expect(tab.className).toContain("font-typewriter");
  });
});
