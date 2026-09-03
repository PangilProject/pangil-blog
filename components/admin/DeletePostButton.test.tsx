import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DeletePostButton } from "@/components/admin/DeletePostButton";

const deletePost = vi.fn();
const refresh = vi.fn();
const push = vi.fn();

vi.mock("@/lib/actions/posts", () => ({
  deletePost: (id: string) => deletePost(id),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
}));

beforeEach(() => {
  deletePost.mockReset().mockResolvedValue({ ok: true });
  refresh.mockReset();
  push.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * 지우는 것은 되돌릴 수 없다. 확인을 모달로 받되(02 §3.4) 한 번의 클릭으로는 절대 지워지지
 * 않아야 한다 — 그게 이 컴포넌트의 유일한 이유다.
 *
 * 모달을 native `<dialog>`로 만들지 않은 이유가 여기 있다: jsdom이 `showModal()`을 지원하지
 * 않아, 되돌릴 수 없는 이 동작을 브라우저 없이 검증할 수 없게 된다.
 */
describe("DeletePostButton", () => {
  it("한 번 누르면 지우지 않고 확인을 묻는다", async () => {
    render(<DeletePostButton postId="post-1" title="테스트입니다" />);

    await act(async () => {
      screen.getByRole("button", { name: "테스트입니다 지우기" }).click();
    });

    expect(deletePost).not.toHaveBeenCalled();
    // 무엇을 지우는지가 확인 화면에 있어야 한다 — 목록에서는 어느 줄을 눌렀는지 흐려진다
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("이 글을 지울까요? 되돌릴 수 없어요.")).toBeInTheDocument();
    expect(screen.getByText("테스트입니다")).toBeInTheDocument();
  });

  it("확인 화면은 취소에 커서를 둔다 — 열자마자 누른 Enter가 삭제가 되면 안 된다", async () => {
    render(<DeletePostButton postId="post-1" title="테스트입니다" />);

    await act(async () => {
      screen.getByRole("button", { name: "테스트입니다 지우기" }).click();
    });

    expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
  });

  it("ESC로 확인 화면을 닫는다 — 나가는 길을 좁혀 두지 않는다", async () => {
    render(<DeletePostButton postId="post-1" title="테스트입니다" />);

    await act(async () => {
      screen.getByRole("button", { name: "테스트입니다 지우기" }).click();
    });
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deletePost).not.toHaveBeenCalled();
  });

  it("확인을 누르면 지우고 목록을 다시 읽는다", async () => {
    render(<DeletePostButton postId="post-1" title="테스트입니다" />);

    await act(async () => {
      screen.getByRole("button", { name: "테스트입니다 지우기" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "지운다" }).click();
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
      screen.getByRole("button", { name: "취소" }).click();
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
      screen.getByRole("button", { name: "지운다" }).click();
    });

    // 모달을 닫지 않는다 — 닫으면 무엇이 잘못됐는지가 함께 사라진다
    expect(screen.getByRole("alert")).toHaveTextContent("이미 지워졌어요");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("지운 뒤 갈 곳이 있으면 그리로 보낸다 — 공개 상세는 그 지면이 없어진다", async () => {
    render(<DeletePostButton postId="post-1" title="테스트입니다" afterDelete="/dev" />);

    await act(async () => {
      screen.getByRole("button", { name: "테스트입니다 지우기" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "지운다" }).click();
    });

    expect(push).toHaveBeenCalledWith("/dev");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("제목이 없는 초안도 버튼 이름이 비지 않는다", () => {
    render(<DeletePostButton postId="post-1" title="   " />);

    expect(screen.getByRole("button", { name: "제목 없음 지우기" })).toBeInTheDocument();
  });
});
