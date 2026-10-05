import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminPostList, type AdminPostRow } from "@/components/admin/AdminPostList";

const unpublishPosts = vi.fn();
const deletePosts = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/actions/posts", () => ({
  unpublishPosts: (ids: string[]) => unpublishPosts(ids),
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
  it("하나도 안 고르면 두 일괄 버튼이 다 꺼져 있다", () => {
    render(<AdminPostList posts={posts} />);

    expect(screen.getByRole("button", { name: "비공개로" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "선택 삭제" })).toBeDisabled();
  });

  it("이미 내린 글만 고르면 비공개로는 꺼져 있고 삭제만 켜진다", () => {
    render(<AdminPostList posts={posts} />);
    check("내린 글");

    expect(screen.getByRole("button", { name: "비공개로" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "선택 삭제" })).not.toBeDisabled();
  });

  it("비공개로는 확인을 거쳐 공개 중인 글만 보낸다", async () => {
    render(<AdminPostList posts={posts} />);
    check("XSS 정리");
    check("내린 글");

    await press("비공개로");
    expect(unpublishPosts).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("고른 2편 중 공개 중인 1편");

    // 확인창의 확정 버튼도 이름이 `비공개로`다 — 대화상자 안의 것을 누른다
    await act(async () => {
      screen.getAllByRole("button", { name: "비공개로" }).at(-1)?.click();
    });

    expect(unpublishPosts).toHaveBeenCalledWith(["p-1"]);
    expect(refresh).toHaveBeenCalled();
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
});
