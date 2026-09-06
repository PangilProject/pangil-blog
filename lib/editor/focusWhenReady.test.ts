import { describe, expect, it, vi } from "vitest";

import { focusWhenReady } from "@/lib/editor/focusWhenReady";

/** 프레임을 직접 돌린다 — 실제 rAF를 기다리면 테스트가 시간에 묶인다 */
function frames() {
  const queued: (() => void)[] = [];
  return {
    schedule: (run: () => void) => queued.push(run),
    tick: () => {
      const run = queued.shift();
      run?.();
    },
    pending: () => queued.length,
  };
}

const target = () =>
  ({ focus: vi.fn() }) as unknown as HTMLElement & { focus: ReturnType<typeof vi.fn> };

describe("focusWhenReady", () => {
  it("이미 있으면 바로 옮긴다", () => {
    const element = target();
    const clock = frames();

    focusWhenReady(() => element, { schedule: clock.schedule });

    expect(element.focus).toHaveBeenCalledTimes(1);
    expect(clock.pending()).toBe(0);
  });

  /**
   * 리치 텍스트 칸은 Tiptap이 자기 effect에서 붙이므로 부모 effect가 도는 시점에 아직
   * 없을 수 있다. 한 번만 찾아보고 끝내면 **아무 일도 일어나지 않는다** — 찬양 묵상에서
   * 엔터를 두 번 눌러도 커서가 옮겨가지 않던 것이 이것이었다.
   */
  it("아직 없으면 다음 프레임에 다시 본다", () => {
    const element = target();
    const clock = frames();
    let ready = false;

    focusWhenReady(() => (ready ? element : null), { schedule: clock.schedule });
    expect(element.focus).not.toHaveBeenCalled();

    ready = true;
    clock.tick();

    expect(element.focus).toHaveBeenCalledTimes(1);
  });

  /** 못 찾는 것이 정상인 경우가 있다(그 사이 지워졌다). 그때는 조용히 그만둔다 */
  it("끝까지 없으면 그만둔다 — 영원히 기다리지 않는다", () => {
    const clock = frames();

    focusWhenReady(() => null, { tries: 3, schedule: clock.schedule });

    for (let i = 0; i < 10; i += 1) clock.tick();
    expect(clock.pending()).toBe(0);
  });

  it("한 번 옮기면 더 보지 않는다", () => {
    const element = target();
    const clock = frames();

    focusWhenReady(() => element, { tries: 5, schedule: clock.schedule });
    for (let i = 0; i < 5; i += 1) clock.tick();

    expect(element.focus).toHaveBeenCalledTimes(1);
  });
});
