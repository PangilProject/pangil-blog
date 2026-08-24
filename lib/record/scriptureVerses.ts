/**
 * 말씀 본문 문자열 → 절 목록 (03 §5.2 ScriptureBlock).
 *
 * 본문은 `content.scriptureBody`에 **문자열 한 덩어리**로 들어온다(05 §2). 크롤러는
 * "1 솔로몬이…" 처럼 절 번호를 앞에 세워 한 줄씩 적고(06 §2), 손으로 쓸 때는 "44. …"처럼
 * 적기도 한다. 조판은 둘 다 같은 모양이어야 한다.
 *
 * 번호를 못 찾은 줄은 번호 없이 한 문단으로 남긴다 — 번호를 붙이지 않고 적는 날도 있고,
 * 그때 본문이 사라지는 것보다 번호가 없는 편이 낫다.
 */

export type ScriptureVerse = {
  number?: string;
  text: string;
};

/** "12", "12-13", "12~13" 뒤에 마침표·괄호가 붙을 수 있다 */
const LEADING_NUMBER = /^(\d+(?:\s*[-~]\s*\d+)?)\s*[.)]?\s+(.+)$/;

export function toScriptureVerses(body: string): ScriptureVerse[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => {
      const match = line.match(LEADING_NUMBER);
      return match ? { number: match[1], text: match[2] } : { text: line };
    });
}
