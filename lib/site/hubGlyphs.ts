/**
 * 문장을 낱말·낱자로 쪼갠다 (ADR-004 2단계).
 *
 * **서버가 쪼갠다.** 연출이 붙을 때 DOM을 다시 짜면 React가 관리하는 트리를 건드리게 된다 —
 * 미리 쪼개 두면 연출(`HubStage`)은 이미 선 노드에 스타일만 얹는다.
 *
 * 낱말로 한 겹 감싸는 이유는 **줄바꿈 때문**이다. 낱자를 바로 늘어놓으면 브라우저가 글자
 * 사이 아무 데서나 줄을 끊는다 — 한국어 문장은 띄어쓰기에서 끊겨야 읽힌다.
 *
 * 키에 자리 번호를 넣는다. 같은 글자가 한 문장에 여러 번 나오므로 글자만으로는 가를 수 없고,
 * 문장은 고정이라 순서가 바뀌지 않는다.
 */
export type HubGlyph = { key: string; char: string };
export type HubWord = { key: string; glyphs: HubGlyph[]; trailingSpace: boolean };

export function splitIntoGlyphs(line: string): HubWord[] {
  const words = line.split(" ");

  return words.map((word, wordIndex) => ({
    key: `w${wordIndex}`,
    trailingSpace: wordIndex < words.length - 1,
    // 자소 단위가 아니라 **문자 단위**로 센다. 전개 연산자가 서로게이트 쌍을 지켜 준다
    glyphs: [...word].map((char, glyphIndex) => ({
      key: `w${wordIndex}g${glyphIndex}`,
      char,
    })),
  }));
}
