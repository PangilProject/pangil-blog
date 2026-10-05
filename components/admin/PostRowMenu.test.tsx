import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PostRowMenu } from "@/components/admin/PostRowMenu";

const publishPost = vi.fn();
const unpublishPost = vi.fn();
const deletePost = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/actions/posts", () => ({
  publishPost: (id: string) => publishPost(id),
  unpublishPost: (id: string) => unpublishPost(id),
  deletePost: (id: string) => deletePost(id),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => {
  publishPost
    .mockReset()
    .mockResolvedValue({ ok: true, id: "post-1", slug: "sr-1", callNumber: 1 });
  unpublishPost.mockReset().mockResolvedValue({ ok: true });
  deletePost.mockReset().mockResolvedValue({ ok: true });
  refresh.mockReset();
});

/** 메뉴를 연다 — Radix는 키보드(Enter)로도 연다. jsdom에는 포인터 이벤트가 온전하지 않다 */
async function openMenu(title = "테스트입니다") {
  await act(async () => {
    fireEvent.keyDown(screen.getByRole("button", { name: `${title} 메뉴` }), { key: "Enter" });
  });
}

async function choose(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("menuitem", { name }));
  });
}

/**
 * 전환은 되돌릴 수 있는 동작이라 확인을 묻지 않는다. 대신 **다시 공개하는 길이 발행 게이트를
 * 지나야 한다**(05 §3.4) — 상태만 되돌리면 스키마를 통과하지 않은 content가 공개된다.
 * 삭제는 되돌릴 수 없어 확인을 받는다.
 */
describe("PostRowMenu", () => {
  it("공개 중인 글은 비공개로 전환과 삭제를 보인다", async () => {
    render(<PostRowMenu postId="post-1" title="테스트입니다" isPublished />);
    await openMenu();

    expect(screen.getByRole("menuitem", { name: "비공개로 전환" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "삭제" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "공개로 전환" })).toBeNull();
  });

  it("비공개로 전환은 확인 없이 한 번에 내린다", async () => {
    render(<PostRowMenu postId="post-1" title="테스트입니다" isPublished />);
    await openMenu();
    await choose("비공개로 전환");

    expect(unpublishPost).toHaveBeenCalledWith("post-1");
    expect(publishPost).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("내려둔 글은 공개로 전환 — 발행 게이트를 다시 지난다", async () => {
    render(<PostRowMenu postId="post-1" title="테스트입니다" isPublished={false} />);
    await openMenu();
    await choose("공개로 전환");

    expect(publishPost).toHaveBeenCalledWith("post-1");
    expect(unpublishPost).not.toHaveBeenCalled();
  });

  it("막히면 사유를 남긴다 — 조용히 실패하면 왜 안 바뀌는지 모른다", async () => {
    publishPost.mockResolvedValue({ ok: false, reason: "invalid-content" });
    render(<PostRowMenu postId="post-1" title="테스트입니다" isPublished={false} />);
    await openMenu();
    await choose("공개로 전환");

    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByText("내용이 덜 채워져 공개할 수 없어요")).toBeInTheDocument();
  });

  it("삭제는 확인을 거친다", async () => {
    render(<PostRowMenu postId="post-1" title="테스트입니다" isPublished />);
    await openMenu();
    await choose("삭제");

    expect(deletePost).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("이 글을 삭제할까요?");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    });

    expect(deletePost).toHaveBeenCalledWith("post-1");
    expect(refresh).toHaveBeenCalled();
  });

  it("제목이 없어도 메뉴 이름이 비지 않는다", () => {
    render(<PostRowMenu postId="post-1" title="   " isPublished />);

    expect(screen.getByRole("button", { name: "제목 없음 메뉴" })).toBeInTheDocument();
  });
});
