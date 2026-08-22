import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AutosaveState, createAutosave } from "@/lib/editor/autosave";

function harness(saveImpl?: (value: string) => Promise<void>) {
  const saved: string[] = [];
  const states: AutosaveState[] = [];
  const errors: unknown[] = [];

  const autosave = createAutosave<string>({
    save:
      saveImpl ??
      (async (value) => {
        saved.push(value);
      }),
    onStateChange: (state) => states.push(state),
    onError: (error) => errors.push(error),
  });

  return { autosave, saved, states, errors };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createAutosave — debounce 1s", () => {
  it("입력이 멈추고 1초 뒤에 한 번 저장한다", async () => {
    const { autosave, saved } = harness();

    autosave.change("가");
    autosave.change("가나");
    autosave.change("가나다");
    expect(saved).toEqual([]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(saved).toEqual(["가나다"]);
  });

  it("1초가 되기 전에는 저장하지 않는다", async () => {
    const { autosave, saved } = harness();

    autosave.change("가");
    await vi.advanceTimersByTimeAsync(900);
    expect(saved).toEqual([]);
  });
});

describe("createAutosave — maxWait 5s (프리모템 #2)", () => {
  it("계속 타이핑해도 5초에는 저장한다 — 설교 속기에서 debounce가 영원히 안 터지는 문제", async () => {
    const { autosave, saved } = harness();

    // 500ms마다 입력 → debounce는 매번 리셋된다
    for (let i = 0; i < 12; i += 1) {
      autosave.change(`글자 ${i}`);
      await vi.advanceTimersByTimeAsync(500);
    }

    expect(saved.length).toBeGreaterThanOrEqual(1);
    expect(saved[0]).toBe("글자 9"); // 5초 시점의 최신 값
  });
});

describe("createAutosave — 상태 전이", () => {
  it("typing → saving → saved 순서로 간다", async () => {
    const { autosave, states } = harness();

    autosave.change("가");
    expect(states).toEqual(["typing"]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(states).toEqual(["typing", "saving", "saved"]);
  });

  it("저장 중 들어온 입력은 saved로 끝나지 않는다 — 아직 안 올라간 값이 있다", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const { autosave, states, saved } = harness(async (value) => {
      if (value === "첫 저장") await gate;
      saved.push(value);
    });

    autosave.change("첫 저장");
    await vi.advanceTimersByTimeAsync(1000);
    expect(states).toContain("saving");

    autosave.change("저장 중 입력");
    release?.();
    await vi.advanceTimersByTimeAsync(1000);

    expect(saved).toEqual(["첫 저장", "저장 중 입력"]);
  });
});

describe("createAutosave — 실패와 재시도", () => {
  it("실패하면 retrying으로 가고 백오프 뒤 다시 시도한다", async () => {
    let attempts = 0;
    const { autosave, states } = harness(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("network");
    });

    autosave.change("설교 노트");
    await vi.advanceTimersByTimeAsync(1000);
    expect(attempts).toBe(1);
    expect(states).toContain("retrying");

    await vi.advanceTimersByTimeAsync(2000); // 첫 백오프
    expect(attempts).toBe(2);

    await vi.advanceTimersByTimeAsync(5000); // 둘째 백오프
    expect(attempts).toBe(3);
    expect(autosave.state()).toBe("saved");
  });

  it("실패한 값을 버리지 않는다 — 버리는 순간 그게 유실이다", async () => {
    let failing = true;
    const saved: string[] = [];
    const autosave = createAutosave<string>({
      save: async (value) => {
        if (failing) throw new Error("offline");
        saved.push(value);
      },
    });

    autosave.change("예배당에서 적은 것");
    await vi.advanceTimersByTimeAsync(1000);
    expect(autosave.isDirty()).toBe(true);

    failing = false;
    await vi.advanceTimersByTimeAsync(2000);
    expect(saved).toEqual(["예배당에서 적은 것"]);
    expect(autosave.isDirty()).toBe(false);
  });

  it("백오프는 10초에서 멈추고 계속 재시도한다 — 포기하지 않는다", async () => {
    let attempts = 0;
    const autosave = createAutosave<string>({
      save: async () => {
        attempts += 1;
        throw new Error("offline");
      },
    });

    autosave.change("노트");
    await vi.advanceTimersByTimeAsync(1000); // 1회
    await vi.advanceTimersByTimeAsync(2000); // 2회
    await vi.advanceTimersByTimeAsync(5000); // 3회
    await vi.advanceTimersByTimeAsync(10000); // 4회
    await vi.advanceTimersByTimeAsync(10000); // 5회 — 10초 유지
    expect(attempts).toBe(5);
    expect(autosave.state()).toBe("retrying");
  });
});

describe("createAutosave — flush", () => {
  it("임시저장 버튼은 debounce를 건너뛴다", async () => {
    const { autosave, saved } = harness();

    autosave.change("바로 저장");
    await autosave.flush();

    expect(saved).toEqual(["바로 저장"]);
  });

  it("저장할 것이 없으면 아무 일도 하지 않는다", async () => {
    const { autosave, saved } = harness();
    await autosave.flush();
    expect(saved).toEqual([]);
  });

  it("dispose 이후에는 저장하지 않는다 — 언마운트된 에디터가 쓰면 안 된다", async () => {
    const { autosave, saved } = harness();

    autosave.change("가");
    autosave.dispose();
    await vi.advanceTimersByTimeAsync(10000);

    expect(saved).toEqual([]);
  });
});
