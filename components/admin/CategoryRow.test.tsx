import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CategoryRow } from "@/components/admin/CategoryRow";
import type { AdminCategory } from "@/lib/db/categories";

const renameCategory = vi.fn();
const moveCategory = vi.fn();
const deleteCategory = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/actions/categories", () => ({
  renameCategory: (id: string, name: string) => renameCategory(id, name),
  moveCategory: (id: string, direction: string) => moveCategory(id, direction),
  deleteCategory: (id: string, slug: string) => deleteCategory(id, slug),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const category: AdminCategory = {
  id: "cat-1",
  name: "회고",
  slug: "retrospective",
  sortOrder: 10,
  postCount: 0,
};

beforeEach(() => {
  renameCategory.mockReset().mockResolvedValue({ ok: true });
  moveCategory.mockReset().mockResolvedValue({ ok: true });
  deleteCategory.mockReset().mockResolvedValue({ ok: true });
  refresh.mockReset();
});

afterEach(() => vi.clearAllMocks());

function renderRow(overrides: Partial<AdminCategory> = {}, flags = {}) {
  return render(
    <CategoryRow
      category={{ ...category, ...overrides }}
      isFirst={false}
      isLast={false}
      {...flags}
    />,
  );
}

describe("CategoryRow", () => {
  it("이름을 고치고 칸을 떠나면 저장한다 — 목록이 곧 편집 화면이다", async () => {
    renderRow();
    const input = screen.getByRole("textbox", { name: "회고 이름" });

    await act(async () => {
      fireEvent.change(input, { target: { value: "돌아보기" } });
      fireEvent.blur(input);
    });

    expect(renameCategory).toHaveBeenCalledWith("cat-1", "돌아보기");
    expect(refresh).toHaveBeenCalled();
  });

  it("바꾼 게 없으면 저장하지 않는다", async () => {
    renderRow();

    await act(async () => {
      fireEvent.blur(screen.getByRole("textbox", { name: "회고 이름" }));
    });

    expect(renameCategory).not.toHaveBeenCalled();
  });

  it("빈 이름은 되돌린다 — 이름 없는 분류를 만들지 않는다", async () => {
    renderRow();
    const input = screen.getByRole("textbox", { name: "회고 이름" });

    await act(async () => {
      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.blur(input);
    });

    expect(renameCategory).not.toHaveBeenCalled();
    expect(input).toHaveValue("회고");
  });

  it("주소는 고칠 수 없다 — 공개 링크에 쓰인 값이다", () => {
    renderRow();

    expect(screen.getByText("retrospective")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /주소/ })).toBeNull();
  });

  it("글이 있는 분류에는 삭제 버튼을 놓지 않는다", () => {
    renderRow({ postCount: 12 });

    expect(screen.queryByRole("button", { name: "회고 삭제" })).toBeNull();
    expect(screen.getByText("글 12편")).toBeInTheDocument();
  });

  it("삭제는 확인을 거친다", async () => {
    renderRow();

    await act(async () => {
      screen.getByRole("button", { name: "회고 삭제" }).click();
    });

    expect(deleteCategory).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => {
      screen.getByRole("button", { name: "삭제" }).click();
    });

    expect(deleteCategory).toHaveBeenCalledWith("cat-1", "retrospective");
  });

  it("끝에서는 그 방향으로 못 옮긴다", () => {
    render(<CategoryRow category={category} isFirst isLast={false} />);

    expect(screen.getByRole("button", { name: "회고 위로" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "회고 아래로" })).not.toBeDisabled();
  });

  it("막히면 사유를 남긴다 — 조용히 실패하면 왜 그대로인지 모른다", async () => {
    renameCategory.mockResolvedValue({ ok: false, reason: "이미 쓰는 이름이에요" });
    renderRow();
    const input = screen.getByRole("textbox", { name: "회고 이름" });

    await act(async () => {
      fireEvent.change(input, { target: { value: "FE" } });
      fireEvent.blur(input);
    });

    expect(screen.getByText("이미 쓰는 이름이에요")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
