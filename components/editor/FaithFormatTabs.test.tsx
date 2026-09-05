import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FaithFormatTabs } from "@/components/editor/FaithFormatTabs";

const discardDraft = vi.fn();
const replace = vi.fn();

vi.mock("@/lib/actions/posts", () => ({
  discardDraft: (id: string) => discardDraft(id),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

beforeEach(() => {
  discardDraft.mockReset().mockResolvedValue({ ok: true });
  replace.mockReset();
});

afterEach(() => vi.clearAllMocks());

/**
 * 서식은 저장 계약을 가르는 축이다(02 §5). 그래서 이 탭이 지켜야 하는 것은 둘이다 —
 * **쓰기 시작하면 사라질 것**, 그리고 **옮길 때 빈 초안을 남기지 않을 것**.
 */
describe("FaithFormatTabs", () => {
  it("아직 비어 있으면 세 서식을 고를 수 있다", () => {
    render(<FaithFormatTabs current="QT" postId={null} isEmpty />);

    for (const label of ["큐티", "설교", "찬양"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("쓰기 시작하면 사라진다 — 그때부터 이 글의 종류는 정해진 것이다", () => {
    const { container } = render(<FaithFormatTabs current="QT" postId="post-1" isEmpty={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("초안이 없으면 그냥 그 서식으로 옮긴다", async () => {
    render(<FaithFormatTabs current="QT" postId={null} isEmpty />);

    await act(async () => {
      screen.getByRole("button", { name: "설교" }).click();
    });

    expect(discardDraft).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/admin/write/sermon");
  });

  it("자동 저장이 만든 빈 초안은 지우고 옮긴다 — 초안함에 빈 껍데기를 남기지 않는다", async () => {
    render(<FaithFormatTabs current="QT" postId="post-1" isEmpty />);

    await act(async () => {
      screen.getByRole("button", { name: "찬양" }).click();
    });

    expect(discardDraft).toHaveBeenCalledWith("post-1");
    expect(replace).toHaveBeenCalledWith("/admin/write/praise");
  });

  it("초안을 지우지 못하면 옮기지 않고 사유를 남긴다", async () => {
    discardDraft.mockResolvedValue({ ok: false, reason: "published" });
    render(<FaithFormatTabs current="QT" postId="post-1" isEmpty />);

    await act(async () => {
      screen.getByRole("button", { name: "설교" }).click();
    });

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("서식을 바꾸지 못했어요")).toBeInTheDocument();
  });

  it("지금 서식은 다시 누를 수 없다 — 빈 초안이 괜히 지워진다", () => {
    render(<FaithFormatTabs current="QT" postId="post-1" isEmpty />);

    screen.getByRole("button", { name: "큐티" }).click();

    expect(discardDraft).not.toHaveBeenCalled();
  });
});
