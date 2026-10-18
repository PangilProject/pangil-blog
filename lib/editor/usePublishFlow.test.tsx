import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const publishFromEditor = vi.fn();
/** 발행 뒤 이동은 호스트가 갈려서 `location.assign`이다(usePublishFlow) */
const assign = vi.fn();

vi.mock("@/lib/actions/posts", () => ({
  publishFromEditor: (input: unknown) => publishFromEditor(input),
}));

const { usePublishFlow } = await import("@/lib/editor/usePublishFlow");

/** 화면 게이트는 통과시킨다 — 이 파일의 주제는 요청 한 번과 그 뒤처리다 */
const pass = { safeParse: () => ({ success: true }) };

function open(id: string | null = "post-1") {
  const calls: string[] = [];
  const onSaved = vi.fn();
  const hook = renderHook(() =>
    usePublishFlow<{ title: string }>({
      gate: pass,
      toInput: (values) => ({ type: "TECH", title: values.title, content: { kind: "TECH" } }),
      currentId: () => id,
      onSaved,
      hold: () => void calls.push("hold"),
      release: () => void calls.push("release"),
      clearMirror: () => void calls.push("clearMirror"),
    }),
  );
  return { ...hook, calls, onSaved };
}

beforeEach(() => {
  publishFromEditor
    .mockReset()
    .mockResolvedValue({ ok: true, slug: "0072", url: "https://dev.kwangilkim.com/0072" });
  assign.mockReset();
  vi.stubGlobal("location", { assign });
});

describe("usePublishFlow — 지금 값을 실어 한 번에 발행한다 (ADR-006)", () => {
  /**
   * 전에는 자동 저장을 마저 돌리고(flush) 다 올라갔는지 확인한 뒤(isDirty) DB의 content로
   * 발행했다 — 다 썼는데 마지막 저장이 끝날 때까지 발행이 막혔다.
   */
  it("저장을 기다리지 않고 폼 값과 id를 실어 요청 한 번으로 발행한다", async () => {
    const { result, calls } = open();

    await act(async () => {
      await result.current.publish({ title: "제목" });
    });

    expect(publishFromEditor).toHaveBeenCalledTimes(1);
    expect(publishFromEditor).toHaveBeenCalledWith({
      type: "TECH",
      title: "제목",
      content: { kind: "TECH" },
      id: "post-1",
    });
    expect(calls).toEqual(["hold", "clearMirror"]);
    expect(assign).toHaveBeenCalledWith("https://dev.kwangilkim.com/0072");
  });

  it("새 글은 id 없이 보낸다 — 발행이 곧 첫 저장이다", async () => {
    const { result } = open(null);

    await act(async () => {
      await result.current.publish({ title: "제목" });
    });

    expect(publishFromEditor.mock.calls[0]?.[0]).toMatchObject({ id: undefined });
  });

  /** 새 글이 저장까지 됐는데 막혔다면, 그 id를 붙들어야 다시 누를 때 초안이 하나 더 안 생긴다 */
  it("막히면 저장된 id를 넘겨받고, 자동 저장을 다시 풀고, 다시 누를 수 있다", async () => {
    publishFromEditor.mockResolvedValue({ ok: false, reason: "invalid-content", id: "new-1" });
    const { result, calls, onSaved } = open(null);

    await act(async () => {
      await result.current.publish({ title: "제목" });
    });

    expect(onSaved).toHaveBeenCalledWith("new-1");
    expect(calls).toEqual(["hold", "release"]);
    expect(result.current.isPublishing).toBe(false);
    expect(result.current.error).toContain("덜 채운 칸");
    expect(assign).not.toHaveBeenCalled();
  });

  it("네트워크가 끊겨도 버튼이 발행 중에 갇히지 않는다", async () => {
    publishFromEditor.mockRejectedValue(new Error("network"));
    const { result, calls } = open();

    await act(async () => {
      await result.current.publish({ title: "제목" });
    });

    expect(calls).toEqual(["hold", "release"]);
    expect(result.current.isPublishing).toBe(false);
    expect(result.current.error).toContain("발행하지 못했어요");
  });
});
