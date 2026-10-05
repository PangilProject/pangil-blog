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
  deleteCategory: (id: string, slug: string, moveTo: unknown) => deleteCategory(id, slug, moveTo),
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

const others = [
  { id: "cat-2", name: "개발", slug: "dev" },
  { id: "cat-3", name: "정보", slug: "info" },
];

function renderRow(overrides: Partial<AdminCategory> = {}, flags = {}) {
  return render(
    <CategoryRow
      category={{ ...category, ...overrides }}
      isFirst={false}
      isLast={false}
      others={others}
      {...flags}
    />,
  );
}

async function openDelete() {
  await act(async () => {
    screen.getByRole("button", { name: "회고 삭제" }).click();
  });
}

async function confirmDelete() {
  await act(async () => {
    screen.getByRole("button", { name: "삭제" }).click();
  });
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

  it("목록에는 글 수를 적지 않는다 — 필요한 순간은 지우기 직전이다", () => {
    renderRow({ postCount: 12 });

    expect(screen.queryByText(/12편/)).toBeNull();
  });

  it("삭제는 확인을 거친다", async () => {
    renderRow();
    await openDelete();

    expect(deleteCategory).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // 글이 없으면 옮길 곳을 묻지 않는다
    expect(screen.queryByRole("combobox")).toBeNull();

    await confirmDelete();

    expect(deleteCategory).toHaveBeenCalledWith("cat-1", "retrospective", null);
  });

  it("글이 있어도 지울 수 있고, 기본은 미분류로 둔다", async () => {
    renderRow({ postCount: 12 });
    await openDelete();

    expect(screen.getByRole("dialog")).toHaveTextContent("글 12편");
    expect(screen.getByRole("combobox")).toHaveDisplayValue("미분류");

    await confirmDelete();

    expect(deleteCategory).toHaveBeenCalledWith("cat-1", "retrospective", null);
  });

  it("옮길 분류를 고르면 그리로 옮긴다 — 병합", async () => {
    renderRow({ postCount: 12 });
    await openDelete();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "cat-2" } });
    await confirmDelete();

    expect(deleteCategory).toHaveBeenCalledWith("cat-1", "retrospective", {
      id: "cat-2",
      slug: "dev",
    });
  });

  it("끝에서는 그 방향으로 못 옮긴다", () => {
    render(<CategoryRow category={category} isFirst isLast={false} others={others} />);

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
