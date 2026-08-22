import { describe, expect, it } from "vitest";

import { createLocalMirror, type MirrorStorage, mirrorKey } from "@/lib/editor/localMirror";

function memoryStorage(options: { quotaAfter?: number } = {}): MirrorStorage & {
  dump(): Record<string, string>;
} {
  const map = new Map<string, string>();

  return {
    get length() {
      return map.size;
    },
    key(index) {
      return [...map.keys()][index] ?? null;
    },
    getItem(key) {
      return map.get(key) ?? null;
    },
    setItem(key, value) {
      if (options.quotaAfter !== undefined && map.size >= options.quotaAfter && !map.has(key)) {
        const error = new Error("quota");
        error.name = "QuotaExceededError";
        throw error;
      }
      map.set(key, value);
    },
    removeItem(key) {
      map.delete(key);
    },
    dump() {
      return Object.fromEntries(map);
    },
  };
}

describe("mirrorKey", () => {
  it("타입과 글 id로 키를 만든다 (04 §2.3)", () => {
    expect(mirrorKey("SERMON", "abc")).toBe("draft:SERMON:abc");
  });
});

describe("createLocalMirror — 보험 미러", () => {
  it("입력마다 rev를 올려 스냅샷을 남긴다", () => {
    const storage = memoryStorage();
    const mirror = createLocalMirror<string>({ type: "SERMON", id: "a", storage });

    expect(mirror.write("첫 줄").rev).toBe(1);
    expect(mirror.write("둘째 줄").rev).toBe(2);
    expect(mirror.read()?.value).toBe("둘째 줄");
  });

  it("서버 저장 전에는 동기화 안 된 변경으로 본다 — 복구 배너의 조건", () => {
    const storage = memoryStorage();
    const mirror = createLocalMirror<string>({ type: "SERMON", id: "a", storage });

    mirror.write("예배당에서 적은 것");
    expect(mirror.hasUnsyncedChanges()).toBe(true);

    mirror.markSynced(1);
    expect(mirror.hasUnsyncedChanges()).toBe(false);
  });

  it("동기화 후 더 적은 내용은 다시 미동기화가 된다", () => {
    const storage = memoryStorage();
    const mirror = createLocalMirror<string>({ type: "SERMON", id: "a", storage });

    mirror.write("첫 줄");
    mirror.markSynced(1);
    mirror.write("둘째 줄");

    expect(mirror.hasUnsyncedChanges()).toBe(true);
  });

  it("뒤늦게 도착한 낮은 rev 확인이 동기화 상태를 되돌리지 않는다", () => {
    const storage = memoryStorage();
    const mirror = createLocalMirror<string>({ type: "SERMON", id: "a", storage });

    mirror.write("1");
    mirror.write("2");
    mirror.markSynced(2);
    mirror.markSynced(1); // 늦게 도착한 응답

    expect(mirror.read()?.syncedRev).toBe(2);
    expect(mirror.hasUnsyncedChanges()).toBe(false);
  });

  it("스냅샷이 없으면 복구할 것도 없다", () => {
    const storage = memoryStorage();
    const mirror = createLocalMirror<string>({ type: "QT", id: "새 글", storage });

    expect(mirror.read()).toBeNull();
    expect(mirror.hasUnsyncedChanges()).toBe(false);
  });

  it("깨진 스냅샷은 없는 것으로 본다 — 서버 값으로 시작하는 편이 안전하다", () => {
    const storage = memoryStorage();
    storage.setItem(mirrorKey("QT", "a"), "{깨진 json");
    const mirror = createLocalMirror<string>({ type: "QT", id: "a", storage });

    expect(mirror.read()).toBeNull();
  });

  it("발행이 끝나면 미러를 비운다", () => {
    const storage = memoryStorage();
    const mirror = createLocalMirror<string>({ type: "QT", id: "a", storage });

    mirror.write("내용");
    mirror.clear();
    expect(mirror.read()).toBeNull();
  });
});

describe("createLocalMirror — 용량 가드", () => {
  it("용량이 차면 다른 초안의 오래된 미러부터 비우고 지금 글을 지킨다", () => {
    const storage = memoryStorage({ quotaAfter: 2 });
    const pruned: string[][] = [];

    // 오래된 초안 두 개가 이미 자리를 차지하고 있다
    storage.setItem(
      mirrorKey("QT", "old"),
      JSON.stringify({ rev: 1, syncedRev: 1, value: "x", updatedAt: "2026-01-01T00:00:00.000Z" }),
    );
    storage.setItem(
      mirrorKey("PRAISE", "older"),
      JSON.stringify({ rev: 1, syncedRev: 1, value: "y", updatedAt: "2025-01-01T00:00:00.000Z" }),
    );

    const mirror = createLocalMirror<string>({
      type: "SERMON",
      id: "today",
      storage,
      onPrune: (keys) => pruned.push(keys),
    });

    const snapshot = mirror.write("예배 중인 설교");

    expect(snapshot.rev).toBe(1);
    expect(mirror.read()?.value).toBe("예배 중인 설교");
    expect(pruned[0]).toContain(mirrorKey("PRAISE", "older"));
  });

  it("용량 외의 저장소 오류는 삼키지 않는다", () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error("보안 정책으로 차단됨");
    };

    const mirror = createLocalMirror<string>({ type: "QT", id: "a", storage });
    expect(() => mirror.write("내용")).toThrow(/보안 정책/);
  });
});
