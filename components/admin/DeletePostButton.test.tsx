import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DeletePostButton } from "@/components/admin/DeletePostButton";

const deletePost = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/actions/posts", () => ({
  deletePost: (id: string) => deletePost(id),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

beforeEach(() => {
  deletePost.mockReset().mockResolvedValue({ ok: true });
  refresh.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * 지우는 것은 되돌릴 수 없다. 확인을 두 번째 클릭으로 받되(팝업 금지, 02 §3.4의 정신) 한 번의
 * 클릭으로는 절대 지워지지 않아야 한다 — 그게 이 컴포넌트의 유일한 이유다.
 */
describe("DeletePostButton", () => {
  it("한 번 누르면 지우지 않고 확인을 묻는다", async () => {
    render(<DeletePostButton postId="post-1" title="테스트입니다" />);

    await act(async () => {
      screen.getByRole("button", { name: "테스트입니다 지우기" }).click();
    });

    expect(deletePost).not.toHaveBeenCalled();
    expect(screen.getByText("정말 지울까요?")).toBeInTheDocument();
  });

  it("확인을 누르면 지우고 목록을 다시 읽는다", async () => {
    render(<DeletePostButton postId="post-1" title="테스트입니다" />);

    await act(async () => {
      screen.getByRole("button", { name: "테스트입니다 지우기" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "테스트입니다 지우기 확인" }).click();
    });

    expect(deletePost).toHaveBeenCalledWith("post-1");
    expect(refresh).toHaveBeenCalled();
  });

  it("취소하면 아무 일도 없다", async () => {
    render(<DeletePostButton postId="post-1" title="테스트입니다" />);

    await act(async () => {
      screen.getByRole("button", { name: "테스트입니다 지우기" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "테스트입니다 지우기 취소" }).click();
    });

    expect(deletePost).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "테스트입니다 지우기" })).toBeInTheDocument();
  });

  it("이미 지워진 글이면 사유를 남기고 목록을 다시 읽지 않는다", async () => {
    deletePost.mockResolvedValue({ ok: false, reason: "not-found" });
    render(<DeletePostButton postId="post-1" title="테스트입니다" />);

    await act(async () => {
      screen.getByRole("button", { name: "테스트입니다 지우기" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "테스트입니다 지우기 확인" }).click();
    });

    expect(screen.getByText("이미 지워졌어요")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("제목이 없는 초안도 버튼 이름이 비지 않는다", () => {
    render(<DeletePostButton postId="post-1" title="   " />);

    expect(screen.getByRole("button", { name: "제목 없음 지우기" })).toBeInTheDocument();
  });
});
