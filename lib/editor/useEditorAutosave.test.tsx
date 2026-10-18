import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type MirrorStorage, mirrorKey } from "@/lib/editor/localMirror";
import { AUTOSAVE_INTERVAL_MS, useEditorAutosave } from "@/lib/editor/useEditorAutosave";

function memoryStorage(): MirrorStorage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useEditorAutosave — 04 §2.3 · ADR-006 배선", () => {
  it("입력 즉시 로컬에 남기고, 서버 저장은 3분 뒤에 한 번 한다", async () => {
    const storage = memoryStorage();
    const saved: string[] = [];

    const { result } = renderHook(() =>
      useEditorAutosave<string>({
        type: "SERMON",
        id: "a",
        storage,
        save: async (value) => void saved.push(value),
      }),
    );

    act(() => result.current.onChange("예배 첫 줄"));

    // 로컬은 이미 남아 있다 — 네트워크와 무관하다
    expect(storage.getItem(mirrorKey("SERMON", "a"))).toContain("예배 첫 줄");
    expect(saved).toEqual([]);

    // 입력마다 올리던 1초 주기는 없다 — 3분이 차기 전에는 서버에 가지 않는다
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS - 1000);
    });
    expect(saved).toEqual([]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(saved).toEqual(["예배 첫 줄"]);
  });

  it("서버 저장이 실패해도 로컬 내용은 남는다 — 예배당 네트워크가 죽는 상황", async () => {
    const storage = memoryStorage();

    const { result } = renderHook(() =>
      useEditorAutosave<string>({
        type: "SERMON",
        id: "b",
        storage,
        save: async () => {
          throw new Error("offline");
        },
      }),
    );

    act(() => result.current.onChange("설교 노트"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS);
    });

    expect(result.current.state).toBe("retrying");
    expect(storage.getItem(mirrorKey("SERMON", "b"))).toContain("설교 노트");
  });

  it("마운트 시 미동기화 스냅샷이 있으면 복구 대상으로 알린다", () => {
    const storage = memoryStorage();
    storage.setItem(
      mirrorKey("SERMON", "c"),
      JSON.stringify({
        rev: 3,
        syncedRev: 1,
        value: "저장 안 된 설교",
        updatedAt: "2026-08-16T02:00:00.000Z",
      }),
    );

    const { result } = renderHook(() =>
      useEditorAutosave<string>({ type: "SERMON", id: "c", storage, save: async () => {} }),
    );

    expect(result.current.recovery?.value).toBe("저장 안 된 설교");

    act(() => result.current.dismissRecovery());
    expect(result.current.recovery).toBeNull();
  });

  it("동기화가 끝난 스냅샷으로는 복구 배너를 띄우지 않는다", () => {
    const storage = memoryStorage();
    storage.setItem(
      mirrorKey("QT", "d"),
      JSON.stringify({ rev: 2, syncedRev: 2, value: "저장된 답변", updatedAt: "2026-08-16" }),
    );

    const { result } = renderHook(() =>
      useEditorAutosave<string>({ type: "QT", id: "d", storage, save: async () => {} }),
    );

    expect(result.current.recovery).toBeNull();
  });

  it("서버 저장이 성공하면 그 rev까지 동기화로 표시한다 — 다음 진입에서 배너가 안 뜬다", async () => {
    const storage = memoryStorage();

    const { result } = renderHook(() =>
      useEditorAutosave<string>({ type: "QT", id: "e", storage, save: async () => {} }),
    );

    act(() => result.current.onChange("답변"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS);
    });

    const snapshot = JSON.parse(storage.getItem(mirrorKey("QT", "e")) ?? "{}");
    expect(snapshot.syncedRev).toBe(snapshot.rev);
  });

  it("발행 후에는 미러를 비운다", async () => {
    const storage = memoryStorage();

    const { result } = renderHook(() =>
      useEditorAutosave<string>({ type: "QT", id: "f", storage, save: async () => {} }),
    );

    act(() => result.current.onChange("내용"));
    act(() => result.current.clearMirror());

    expect(storage.getItem(mirrorKey("QT", "f"))).toBeNull();
  });

  /**
   * `작성 취소`의 핵심이다. 밀린 저장을 끊지 않으면 취소를 누른 뒤 디바운스가 깨어나
   * 초안을 만든다 — 초안을 안 남기려고 누른 버튼이 초안을 남긴다.
   */
  it("버리고 나가면 밀린 저장이 나가지 않는다", async () => {
    const saved: string[] = [];
    const storage = memoryStorage();

    const { result } = renderHook(() =>
      useEditorAutosave<string>({
        type: "QT",
        id: "h",
        storage,
        save: async (value) => void saved.push(value),
      }),
    );

    act(() => result.current.onChange("쓰다 만 글"));
    act(() => result.current.abandon());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 2);
    });

    expect(saved).toEqual([]);
    // 로컬 사본도 남지 않는다 — 다음에 열 때 복구 배너가 이걸 되살리겠다고 물으면 안 된다
    expect(storage.getItem(mirrorKey("QT", "h"))).toBeNull();
  });

  it("저장소가 없어도(SSR·차단) 동작한다", async () => {
    const saved: string[] = [];

    const { result } = renderHook(() =>
      useEditorAutosave<string>({
        type: "QT",
        id: "g",
        storage: null,
        save: async (value) => void saved.push(value),
      }),
    );

    act(() => result.current.onChange("내용"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS);
    });

    expect(saved).toEqual(["내용"]);
    expect(result.current.recovery).toBeNull();
  });

  /** 발행된 글은 서버에 올리면 곧 공개 반영이다 — 반영은 발행 버튼만 한다(ADR-006) */
  it("발행된 글(serverSave: false)은 로컬에만 남기고 서버에 올리지 않는다", async () => {
    const storage = memoryStorage();
    const saved: string[] = [];

    const { result } = renderHook(() =>
      useEditorAutosave<string>({
        type: "TECH",
        id: "p",
        storage,
        serverSave: false,
        save: async (value) => void saved.push(value),
      }),
    );

    expect(result.current.edited).toBe(false);
    act(() => result.current.onChange("고친 문단"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS * 2);
      await result.current.flush();
    });

    expect(saved).toEqual([]);
    expect(result.current.edited).toBe(true);
    expect(storage.getItem(mirrorKey("TECH", "p"))).toContain("고친 문단");
  });
});
