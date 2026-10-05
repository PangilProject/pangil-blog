import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DraftList, type DraftRow } from "@/components/admin/DraftList";

const deleteDrafts = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/actions/posts", () => ({
  deleteDrafts: (ids: string[]) => deleteDrafts(ids),
  deletePost: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const drafts: DraftRow[] = [
  { id: "d-1", type: "QT", title: "10월 5일 큐티", updatedLabel: "방금 전" },
  { id: "d-2", type: "TECH", title: "", updatedLabel: "어제" },
  { id: "d-3", type: "SERMON", title: "주일 설교", updatedLabel: "3일 전" },
];

beforeEach(() => {
  deleteDrafts.mockReset().mockResolvedValue({ ok: true, count: 2 });
  refresh.mockReset();
});

function bulkButton() {
  return screen.getByRole("button", { name: "선택 삭제" });
}

describe("DraftList", () => {
  it("하나도 안 고르면 선택 삭제가 꺼져 있다", () => {
    render(<DraftList drafts={drafts} />);

    expect(bulkButton()).toBeDisabled();
  });

  it("고르면 켜지고, 몇 편인지는 버튼 밖에 따로 적는다", () => {
    render(<DraftList drafts={drafts} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "10월 5일 큐티 선택" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "제목 없음 선택" }));

    expect(bulkButton()).not.toBeDisabled();
    expect(bulkButton()).toHaveTextContent(/^선택 삭제$/);
    expect(screen.getByText("2편 선택됨")).toBeInTheDocument();
  });

  it("전체 선택은 다 고르고, 한 번 더 누르면 다 푼다", () => {
    render(<DraftList drafts={drafts} />);
    const all = screen.getByRole("checkbox", { name: "전체 선택" });

    fireEvent.click(all);
    expect(screen.getByText("3편 선택됨")).toBeInTheDocument();

    fireEvent.click(all);
    expect(bulkButton()).toBeDisabled();
    expect(screen.queryByText(/선택됨/)).toBeNull();
  });

  it("확인을 거쳐 고른 것만 지운다 — 되돌릴 수 없다", async () => {
    render(<DraftList drafts={drafts} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "10월 5일 큐티 선택" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "주일 설교 선택" }));

    await act(async () => {
      bulkButton().click();
    });

    expect(deleteDrafts).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("초안 2편을 삭제할까요?");

    await act(async () => {
      screen.getByRole("button", { name: "삭제" }).click();
    });

    expect(deleteDrafts).toHaveBeenCalledWith(["d-1", "d-3"]);
    expect(refresh).toHaveBeenCalled();
    expect(bulkButton()).toBeDisabled();
  });

  it("막히면 확인창을 닫지 않고 사유를 남긴다", async () => {
    deleteDrafts.mockResolvedValue({ ok: false, reason: "empty" });
    render(<DraftList drafts={drafts} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "주일 설교 선택" }));

    await act(async () => {
      bulkButton().click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "삭제" }).click();
    });

    expect(screen.getByRole("dialog")).toHaveTextContent("삭제하지 못했어요");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("한 편 삭제 버튼은 그대로 있다", () => {
    render(<DraftList drafts={drafts} />);

    expect(screen.getByRole("button", { name: "주일 설교 삭제" })).toBeInTheDocument();
  });
});
