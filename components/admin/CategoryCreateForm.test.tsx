import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CategoryCreateForm } from "@/components/admin/CategoryCreateForm";

const createCategory = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/actions/categories", () => ({
  createCategory: (input: unknown) => createCategory(input),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => {
  createCategory.mockReset().mockResolvedValue({ ok: true });
  refresh.mockReset();
});

afterEach(() => vi.clearAllMocks());

describe("CategoryCreateForm", () => {
  it("영문 이름이면 주소를 제안한다", () => {
    render(<CategoryCreateForm />);

    fireEvent.change(screen.getByRole("textbox", { name: "새 분류 이름" }), {
      target: { value: "Web Security" },
    });

    expect(screen.getByRole("textbox", { name: "새 분류 주소" })).toHaveValue("web-security");
  });

  it("한글 이름은 주소를 비워 둔다 — 뜻을 옮기는 일은 사람이 한다", () => {
    render(<CategoryCreateForm />);

    fireEvent.change(screen.getByRole("textbox", { name: "새 분류 이름" }), {
      target: { value: "웹 보안" },
    });

    expect(screen.getByRole("textbox", { name: "새 분류 주소" })).toHaveValue("");
  });

  it("직접 적은 주소를 이름 타이핑이 덮지 않는다", () => {
    render(<CategoryCreateForm />);
    const slug = screen.getByRole("textbox", { name: "새 분류 주소" });

    fireEvent.change(slug, { target: { value: "sec" } });
    fireEvent.change(screen.getByRole("textbox", { name: "새 분류 이름" }), {
      target: { value: "Web Security" },
    });

    expect(slug).toHaveValue("sec");
  });

  it("만들면 칸을 비우고 목록을 다시 읽는다", async () => {
    render(<CategoryCreateForm />);

    fireEvent.change(screen.getByRole("textbox", { name: "새 분류 이름" }), {
      target: { value: "Web Security" },
    });

    await act(async () => {
      screen.getByRole("button", { name: "분류 추가" }).click();
    });

    expect(createCategory).toHaveBeenCalledWith({ name: "Web Security", slug: "web-security" });
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "새 분류 이름" })).toHaveValue("");
  });

  it("막히면 사유를 남기고 적은 값을 지우지 않는다", async () => {
    createCategory.mockResolvedValue({ ok: false, reason: "이미 쓰는 주소예요", field: "slug" });
    render(<CategoryCreateForm />);

    fireEvent.change(screen.getByRole("textbox", { name: "새 분류 이름" }), {
      target: { value: "FE" },
    });

    await act(async () => {
      screen.getByRole("button", { name: "분류 추가" }).click();
    });

    expect(screen.getByRole("alert")).toHaveTextContent("이미 쓰는 주소예요");
    expect(screen.getByRole("textbox", { name: "새 분류 이름" })).toHaveValue("FE");
  });
});
