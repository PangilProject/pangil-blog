"use client";

import { useState } from "react";

export type CopyState = "idle" | "copied" | "failed";

/** 복사 결과를 잠시 보여주고 되돌리는 시간 — 계속 "복사됨"이면 다음 복사가 됐는지 알 수 없다 */
const RESET_MS = 1600;

/**
 * 클립보드에 넣고 그 결과를 들고 있는다.
 *
 * 실패(권한·비보안 컨텍스트)를 조용히 두지 않는 것이 이 훅의 요지다 — 눌렀는데 아무 일도
 * 안 일어나는 것이 가장 나쁘다. 무엇을 어떻게 그릴지는 부르는 쪽이 정한다: 공개 지면의
 * 작은 글자 버튼과 에디터의 버튼이 같은 동작을 써야 한다.
 */
export function useCopyText(): { state: CopyState; copy: (text: string) => Promise<void> } {
  const [state, setState] = useState<CopyState>("idle");

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), RESET_MS);
  };

  return { state, copy };
}

/** 버튼에 적을 말. 세 상태의 문구를 한 곳에 둔다 — 두 곳에 적으면 갈린다 */
export function copyLabel(state: CopyState, idle: string): string {
  if (state === "copied") return "복사됨";
  if (state === "failed") return "복사 안 됨";
  return idle;
}
