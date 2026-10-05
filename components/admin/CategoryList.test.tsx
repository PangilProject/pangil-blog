import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CategoryList } from "@/components/admin/CategoryList";
import type { AdminCategory } from "@/lib/db/categories";

vi.mock("@/lib/actions/categories", () => ({
  renameCategory: vi.fn(),
  deleteCategory: vi.fn(),
  reorderCategories: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const categories: AdminCategory[] = [
  { id: "cat-1", name: "회고", slug: "retrospective", sortOrder: 10, postCount: 4 },
  { id: "cat-2", name: "FE", slug: "fe", sortOrder: 20, postCount: 0 },
];

/**
 * 끌어서 놓는 동작 자체는 jsdom이 재지 못한다(모든 상자의 크기가 0이라 어디에 놓였는지
 * 계산되지 않는다) — 그건 브라우저에서 확인한다. 여기서는 목록이 그 장치를 갖췄는지만 본다.
 */
describe("CategoryList", () => {
  it("줄마다 순서 손잡이가 있고, 한 칸씩 옮기던 버튼은 없다", () => {
    render(<CategoryList categories={categories} />);

    expect(screen.getByRole("button", { name: "회고 순서 이동" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "FE 순서 이동" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /위로|아래로/ })).toBeNull();
  });

  it("화면 순서는 받은 순서 그대로다", () => {
    render(<CategoryList categories={categories} />);

    const names = screen.getAllByRole("textbox").map((input) => (input as HTMLInputElement).value);
    expect(names).toEqual(["회고", "FE"]);
  });
});
