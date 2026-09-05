import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const discardDraft = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/actions/posts", () => ({ discardDraft: (id: string) => discardDraft(id) }));

const { CancelDraftButton } = await import("@/components/editor/CancelDraftButton");

const click = (name: string) =>
  act(async () => {
    screen.getByRole("button", { name }).click();
  });

describe("CancelDraftButton", () => {
  beforeEach(() => {
    push.mockClear();
    discardDraft.mockClear();
  });

  /** 지울 것이 없는데 묻는 창은 한 번 더 누르게 하는 일일 뿐이다 */
  it("만든 초안이 없으면 묻지 않고 나간다", async () => {
    const onDiscard = vi.fn();
    render(<CancelDraftButton draftId={null} onDiscard={onDiscard} />);

    await click("작성 취소");

    expect(discardDraft).not.toHaveBeenCalled();
    expect(onDiscard).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/admin");
  });

  it("만든 초안이 있으면 삭제된다고 먼저 묻는다", async () => {
    render(<CancelDraftButton draftId="p1" onDiscard={vi.fn()} />);

    await click("작성 취소");

    expect(screen.getByText(/삭제돼요/)).toBeInTheDocument();
    // 물어보기만 하고 아직 아무것도 하지 않는다
    expect(discardDraft).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("확인하면 그 초안을 지우고 나간다", async () => {
    discardDraft.mockResolvedValue({ ok: true });
    const onDiscard = vi.fn();
    render(<CancelDraftButton draftId="p1" onDiscard={onDiscard} />);

    await click("작성 취소");
    await click("삭제");

    expect(discardDraft).toHaveBeenCalledWith("p1");
    // 로컬 사본도 비운다 — 안 그러면 다음에 복구 배너가 방금 버린 글을 되살리겠다고 묻는다
    expect(onDiscard).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/admin");
  });

  it("취소하면 아무 일도 일어나지 않는다", async () => {
    render(<CancelDraftButton draftId="p1" onDiscard={vi.fn()} />);

    await click("작성 취소");
    await click("취소");

    expect(discardDraft).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  /** 지우지 못한 채로 나가면 안 된다 — 남은 초안을 모른 채 초안함이 늘어난다 */
  it("지우지 못하면 머무르고 사유를 말한다", async () => {
    discardDraft.mockResolvedValue({ ok: false, reason: "not-found" });
    render(<CancelDraftButton draftId="p1" onDiscard={vi.fn()} />);

    await click("작성 취소");
    await click("삭제");

    expect(screen.getByText("이미 삭제된 글이에요")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
