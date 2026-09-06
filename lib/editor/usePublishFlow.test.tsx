import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const publishPost = vi.fn();
/** 발행 뒤 이동은 호스트가 갈려서 `location.assign`이다(usePublishFlow) */
const assign = vi.fn();

vi.mock("@/lib/actions/posts", () => ({ publishPost: (id: string) => publishPost(id) }));

const { usePublishFlow } = await import("@/lib/editor/usePublishFlow");

/** 화면 게이트는 통과시키고, 이 파일의 주제(저장 상태)만 남긴다 */
const pass = { safeParse: () => ({ success: true }) };

function open(options: { isDirty: () => boolean; flush?: () => Promise<void> }) {
  return renderHook(() =>
    usePublishFlow<{ title: string }>({
      gate: pass,
      flush: options.flush ?? (async () => {}),
      isDirty: options.isDirty,
      clearMirror: () => {},
      currentId: () => "post-1",
    }),
  );
}

beforeEach(() => {
  publishPost
    .mockReset()
    .mockResolvedValue({ ok: true, slug: "0072", url: "https://dev.kwangilkim.com/0072" });
  assign.mockReset();
  vi.stubGlobal("location", { assign });
});

describe("usePublishFlow — 저장이 끝났는지", () => {
  /**
   * `flush()`는 저장이 실패해도 정상 종료한다(상태 기계가 재시도를 걸 뿐 다시 던지지 않는다).
   * 그걸 믿고 넘어가면 `publishPost`가 DB에서 옛 content를 읽어 발행한다 — 방금 쓴 문단이
   * 빠진 채로 나가고, 발행 게이트도 그 옛 content로 판단해서 아무도 막지 않는다.
   */
  it("아직 못 올린 내용이 있으면 발행하지 않는다", async () => {
    const { result } = open({ isDirty: () => true });

    await act(async () => {
      await result.current.publish({ title: "제목" });
    });

    expect(publishPost).not.toHaveBeenCalled();
    expect(result.current.error).toContain("아직 저장되지 않은 내용이 있어요");
  });

  /** 막았으면 다시 누를 수 있어야 한다 — 되돌리지 않으면 영원히 `발행 중…`이다 */
  it("막은 뒤에는 다시 누를 수 있다", async () => {
    const { result } = open({ isDirty: () => true });

    await act(async () => {
      await result.current.publish({ title: "제목" });
    });

    expect(result.current.isPublishing).toBe(false);
  });

  it("저장이 끝나 있으면 그대로 발행한다", async () => {
    const { result } = open({ isDirty: () => false });

    await act(async () => {
      await result.current.publish({ title: "제목" });
    });

    expect(publishPost).toHaveBeenCalledWith("post-1");
    expect(assign).toHaveBeenCalledWith("https://dev.kwangilkim.com/0072");
  });

  /** 순서가 중요하다 — 먼저 밀어 올리고, 그러고도 남았는지 본다 */
  it("확인하기 전에 먼저 저장을 밀어 올린다", async () => {
    const order: string[] = [];
    const { result } = open({
      flush: async () => void order.push("flush"),
      isDirty: () => {
        order.push("isDirty");
        return false;
      },
    });

    await act(async () => {
      await result.current.publish({ title: "제목" });
    });

    expect(order).toEqual(["flush", "isDirty"]);
  });
});
