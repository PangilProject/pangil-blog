import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminPostList, type AdminPostRow } from "@/components/admin/AdminPostList";

const unpublishPosts = vi.fn();
const republishPosts = vi.fn();
const deletePosts = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/actions/posts", () => ({
  unpublishPosts: (ids: string[]) => unpublishPosts(ids),
  republishPosts: (ids: string[]) => republishPosts(ids),
  deletePosts: (ids: string[]) => deletePosts(ids),
  deletePost: vi.fn(),
  publishPost: vi.fn(),
  unpublishPost: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const posts: AdminPostRow[] = [
  {
    id: "p-1",
    title: "XSS 정리",
    callLabel: "T-1",
    editorHref: "/admin/write/tech/p-1",
    status: "PUBLISHED",
  },
  {
    id: "p-2",
    title: "내린 글",
    callLabel: "T-2",
    editorHref: "/admin/write/tech/p-2",
    status: "PRIVATE",
  },
  {
    id: "p-3",
    title: "주일 설교",
    callLabel: "S-1",
    editorHref: "/admin/write/sermon/p-3",
    status: "PUBLISHED",
  },
];

beforeEach(() => {
  unpublishPosts.mockReset().mockResolvedValue({ ok: true, done: 1, skipped: 0 });
  republishPosts.mockReset().mockResolvedValue({ ok: true, done: 1, skipped: 0, failed: 0 });
  deletePosts.mockReset().mockResolvedValue({ ok: true, done: 2, skipped: 0 });
  refresh.mockReset();
});

const check = (title: string) =>
  fireEvent.click(screen.getByRole("checkbox", { name: `${title} 선택` }));

async function press(name: string) {
  await act(async () => {
    screen.getByRole("button", { name }).click();
  });
}

describe("AdminPostList", () => {
  it("하나도 안 고르면 일괄 버튼이 다 꺼져 있다", () => {
    render(<AdminPostList posts={posts} />);

    expect(screen.getByRole("button", { name: "비공개 전환" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "공개 전환" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "선택 삭제" })).toBeDisabled();
  });

  it("할 일이 있는 전환만 켜진다 — 내린 글만 고르면 공개 전환만", () => {
    render(<AdminPostList posts={posts} />);
    check("내린 글");

    expect(screen.getByRole("button", { name: "비공개 전환" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "공개 전환" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "선택 삭제" })).not.toBeDisabled();
  });

  it("비공개 전환은 확인을 거쳐 공개 중인 글만 보낸다", async () => {
    render(<AdminPostList posts={posts} />);
    check("XSS 정리");
    check("내린 글");

    await press("비공개 전환");
    expect(unpublishPosts).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("고른 2편 중 1편을 비공개로 전환할까요?");

    // 확인창의 확정 버튼도 이름이 같다 — 대화상자 안의 것(나중에 그려진 것)을 누른다
    await act(async () => {
      screen.getAllByRole("button", { name: "비공개 전환" }).at(-1)?.click();
    });

    expect(unpublishPosts).toHaveBeenCalledWith(["p-1"]);
    expect(refresh).toHaveBeenCalled();
  });

  it("공개 전환은 내려둔 글만 보낸다", async () => {
    render(<AdminPostList posts={posts} />);
    check("XSS 정리");
    check("내린 글");

    await press("공개 전환");
    expect(screen.getByRole("dialog")).toHaveTextContent("고른 2편 중 1편을 공개로 전환할까요?");

    await act(async () => {
      screen.getAllByRole("button", { name: "공개 전환" }).at(-1)?.click();
    });

    expect(republishPosts).toHaveBeenCalledWith(["p-2"]);
  });

  it("일부가 공개되지 못하면 그 수를 목록 위에 남긴다", async () => {
    republishPosts.mockResolvedValue({ ok: true, done: 0, skipped: 0, failed: 1 });
    render(<AdminPostList posts={posts} />);
    check("내린 글");

    await press("공개 전환");
    await act(async () => {
      screen.getAllByRole("button", { name: "공개 전환" }).at(-1)?.click();
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "1편은 내용이 덜 채워져 공개하지 못했어요",
    );
  });

  it("선택 삭제는 확인을 거쳐 고른 것을 모두 보낸다", async () => {
    render(<AdminPostList posts={posts} />);
    check("XSS 정리");
    check("주일 설교");

    await press("선택 삭제");
    expect(screen.getByRole("dialog")).toHaveTextContent("2편을 삭제할까요?");

    await press("삭제");
    expect(deletePosts).toHaveBeenCalledWith(["p-1", "p-3"]);
    expect(screen.queryByText(/선택됨/)).toBeNull();
  });

  it("막히면 확인창을 닫지 않고 사유를 남긴다", async () => {
    deletePosts.mockResolvedValue({ ok: false, reason: "empty" });
    render(<AdminPostList posts={posts} />);
    check("XSS 정리");

    await press("선택 삭제");
    await press("삭제");

    expect(screen.getByRole("dialog")).toHaveTextContent("바꾸지 못했어요");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("좁은 화면의 접힌 메뉴는 고른 게 없으면 꺼지고, 할 일이 없는 항목은 흐리다", async () => {
    render(<AdminPostList posts={posts} />);
    const trigger = screen.getByRole("button", { name: "선택한 글" });

    expect(trigger).toBeDisabled();

    check("내린 글");
    await act(async () => {
      fireEvent.keyDown(trigger, { key: "Enter" });
    });

    expect(screen.getByRole("menuitem", { name: "비공개 전환" })).toHaveAttribute("data-disabled");
    expect(screen.getByRole("menuitem", { name: "공개 전환" })).not.toHaveAttribute(
      "data-disabled",
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "공개 전환" }));
    });
    expect(screen.getByRole("dialog")).toHaveTextContent("1편을 공개로 전환할까요?");
  });

  it("줄마다 점 세 개 메뉴가 있고, 줄에 늘어놓던 버튼은 없다", () => {
    render(<AdminPostList posts={posts} />);

    expect(screen.getByRole("button", { name: "XSS 정리 메뉴" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /비공개로 전환|XSS 정리 삭제/ })).toBeNull();
  });
});
