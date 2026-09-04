import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VisibilityButton } from "@/components/admin/VisibilityButton";

const publishPost = vi.fn();
const unpublishPost = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/actions/posts", () => ({
  publishPost: (id: string) => publishPost(id),
  unpublishPost: (id: string) => unpublishPost(id),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

beforeEach(() => {
  publishPost
    .mockReset()
    .mockResolvedValue({ ok: true, id: "post-1", slug: "sr-1", callNumber: 1 });
  unpublishPost.mockReset().mockResolvedValue({ ok: true });
  refresh.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * 되돌릴 수 있는 동작이라 확인을 묻지 않는다. 대신 **다시 공개하는 길이 발행 게이트를
 * 지나야 한다**(05 §3.4) — 상태만 되돌리면 스키마를 통과하지 않은 content가 공개된다.
 */
describe("VisibilityButton", () => {
  it("발행된 글은 한 번 눌러 내린다", async () => {
    render(<VisibilityButton postId="post-1" title="테스트입니다" isPublished />);

    await act(async () => {
      screen.getByRole("button", { name: "테스트입니다 비공개로 전환" }).click();
    });

    expect(unpublishPost).toHaveBeenCalledWith("post-1");
    expect(publishPost).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("내려둔 글은 발행 게이트를 다시 지나 공개된다", async () => {
    render(<VisibilityButton postId="post-1" title="테스트입니다" isPublished={false} />);

    await act(async () => {
      screen.getByRole("button", { name: "테스트입니다 공개로 전환" }).click();
    });

    expect(publishPost).toHaveBeenCalledWith("post-1");
    expect(unpublishPost).not.toHaveBeenCalled();
  });

  it("막히면 사유를 남긴다 — 조용히 실패하면 왜 안 바뀌는지 모른다", async () => {
    publishPost.mockResolvedValue({ ok: false, reason: "invalid-content" });
    render(<VisibilityButton postId="post-1" title="테스트입니다" isPublished={false} />);

    await act(async () => {
      screen.getByRole("button", { name: "테스트입니다 공개로 전환" }).click();
    });

    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByText("내용이 덜 채워져 공개할 수 없어요")).toBeInTheDocument();
  });

  it("제목이 없어도 버튼 이름이 비지 않는다", () => {
    render(<VisibilityButton postId="post-1" title="   " isPublished />);

    expect(screen.getByRole("button", { name: "제목 없음 비공개로 전환" })).toBeInTheDocument();
  });
});
