/**
 * 아직 화면에 없을 수도 있는 입력 칸에 커서를 옮긴다 (찬양 묵상·가사 섹션).
 *
 * **왜 한 번으로는 안 되는가.** 블록을 새로 만든 뒤 커서를 그 칸으로 옮기려면 그 칸이 DOM에
 * 있어야 한다. `textarea`처럼 우리가 직접 그리는 칸은 커밋 직후에 이미 있다 — 그래서 가사
 * 섹션은 한 번의 조회로 잘 됐다.
 *
 * 리치 텍스트 칸은 다르다. 편집기는 Tiptap이 자기 effect에서 붙이므로, 부모의 effect가 도는
 * 시점에 `contenteditable`이 아직 없을 수 있다. 그때 한 번만 찾아보고 끝내면 **아무 일도
 * 일어나지 않고 의도까지 사라진다** — 찬양 묵상에서 엔터를 두 번 눌러도 커서가 옮겨가지
 * 않던 것이 이것이었다. 블록은 생겼는데 손은 앞 칸에 남아 있었다.
 *
 * 그래서 **찾을 때까지 몇 프레임 기다린다.** 무한히 기다리지는 않는다 — 못 찾는 것이
 * 정상인 경우(그 사이 지워졌다)가 있고, 그때 조용히 그만두는 편이 맞다.
 */

/** 프레임 단위로 다시 본다. 다섯 번이면 편집기가 붙기에 넉넉하고, 실패해도 눈에 안 띈다 */
const DEFAULT_TRIES = 5;

export function focusWhenReady(
  find: () => HTMLElement | null | undefined,
  {
    tries = DEFAULT_TRIES,
    schedule = defaultSchedule,
  }: { tries?: number; schedule?: (run: () => void) => void } = {},
): void {
  const attempt = (left: number) => {
    const target = find();

    if (target) {
      target.focus();
      return;
    }

    if (left <= 0) return;
    schedule(() => attempt(left - 1));
  };

  attempt(tries);
}

/** 다음 프레임. 없는 환경(테스트·SSR)에서는 매크로태스크로 떨어진다 */
function defaultSchedule(run: () => void): void {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(run);
    return;
  }
  setTimeout(run, 0);
}
