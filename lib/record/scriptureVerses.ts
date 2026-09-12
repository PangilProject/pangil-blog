/**
 * 말씀 본문 문자열 → 절 목록 (03 §5.2 ScriptureBlock).
 *
 * 본문은 `content.scriptureBody`에 **문자열 한 덩어리**로 들어온다(05 §2). 크롤러는
 * "1 솔로몬이…" 처럼 절 번호를 앞에 세워 한 줄씩 적고(06 §2), 손으로 쓸 때는 "44. …"처럼
 * 적기도 한다. 조판은 둘 다 같은 모양이어야 한다.
 *
 * 번호를 못 찾은 줄은 번호 없이 한 문단으로 남긴다 — 번호를 붙이지 않고 적는 날도 있고,
 * 그때 본문이 사라지는 것보다 번호가 없는 편이 낫다.
 *
 * **강조는 글자 안의 표시로 싣는다** (`**굵게**` · `__밑줄__`). 저장 계약을 문서로 바꾸지
 * 않은 이유: 이 칸의 주인은 **크롤러**다(06 §2). 문서로 바꾸면 크롤러가 문서를 만들어야 하고,
 * 절 분리기·검색·내보내기·이관해 온 700여 편이 함께 흔들린다 — 얻는 것은 굵은 글자 하나다.
 * 가사의 `"4 Bar"`를 필드 대신 문자열에 실은 것과 같은 판단이다(02 §5.4).
 */

export type ScriptureVerse = {
  number?: string;
  /** 표시를 뗀 평문. 검색·요약처럼 글자만 필요한 쪽이 쓴다 */
  text: string;
  /** 조판용. 표시가 없으면 덩이 하나뿐이다 */
  segments: ScriptureSegment[];
};

export type ScriptureSegment = {
  text: string;
  bold?: boolean;
  underline?: boolean;
};

/** `**굵게**`와 `__밑줄__`. 둘 다 아닌 글자는 그대로 지나간다 */
const MARKED = /(\*\*|__)(.+?)\1/g;

/**
 * 한 줄을 강조 덩이로 쪼갠다.
 *
 * 짝이 맞지 않는 표시(`**`가 하나뿐)는 **글자로 남긴다** — 적다 만 상태에서 본문이
 * 사라지는 것보다 별표가 보이는 편이 낫다.
 */
export function toScriptureSegments(line: string): ScriptureSegment[] {
  const segments: ScriptureSegment[] = [];
  let at = 0;

  for (const match of line.matchAll(MARKED)) {
    const start = match.index;
    if (start > at) segments.push({ text: line.slice(at, start) });

    const marker = match[1];
    segments.push(
      marker === "**"
        ? { text: match[2] ?? "", bold: true }
        : { text: match[2] ?? "", underline: true },
    );
    at = start + match[0].length;
  }

  if (at < line.length) segments.push({ text: line.slice(at) });
  return segments.length > 0 ? segments : [{ text: line }];
}

/** 표시를 뗀 평문. 검색 색인이 `**주님**`을 한 낱말로 잡으면 그 말로 글을 못 찾는다 */
export function stripScriptureMarks(body: string): string {
  return body.replace(MARKED, (_whole, _marker, inner: string) => inner);
}

/** "12", "12-13", "12~13" 뒤에 마침표·괄호가 붙을 수 있다 */
const LEADING_NUMBER = /^(\d+(?:\s*[-~]\s*\d+)?)\s*[.)]?\s+(.+)$/;

export function toScriptureVerses(body: string): ScriptureVerse[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => {
      const match = line.match(LEADING_NUMBER);
      const [number, body] = match ? [match[1], match[2] ?? ""] : [undefined, line];

      return {
        ...(number ? { number } : {}),
        text: stripScriptureMarks(body),
        segments: toScriptureSegments(body),
      };
    });
}
