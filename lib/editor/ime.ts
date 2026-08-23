import type { KeyboardEvent } from "react";

/**
 * 한글 조합 중인 키 입력인가 (IME).
 *
 * 한글은 조합이 끝날 때 Enter로 확정하는 입력기가 흔하다. 그 Enter를 우리 단축키로 받으면
 * 조합 중인 글자가 확정되면서 **한 번의 Enter가 두 가지 일**을 한다 — "안녕하세요"에서
 * 마지막 글자를 조합하며 Enter를 치면 태그가 "안녕하세"와 "요"로 갈리는 식이다.
 *
 * 그래서 Enter·Backspace로 무언가를 확정·삭제하는 핸들러는 전부 이 검사를 먼저 통과해야
 * 한다. 조합 중이면 아무것도 하지 않고 입력기에 넘긴다 — 사용자는 한 번 더 Enter를 친다.
 *
 * React의 합성 이벤트에는 isComposing이 없어 nativeEvent를 본다.
 */
export function isComposing(event: KeyboardEvent<HTMLElement>): boolean {
  return event.nativeEvent.isComposing;
}
