import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * 맞춤법 검사에 보낼 글자열을 문서에서 뽑는다.
 *
 * 하나의 segment는 **문서 위치가 끊기지 않고 이어지는 글자들**이다. 그래서 글자열 안의 i번째
 * 글자는 언제나 문서의 `from + i`에 있다 — 검사 결과를 밑줄 자리로 돌릴 때 표가 필요 없다.
 *
 * 빼는 것:
 * - **코드 블록**: 통째로 건너뛴다.
 * - **인라인 코드**: 거기서 segment를 끊는다. 공백으로 메우면 "띄어쓰기 오류"가 새로 생긴다.
 *
 * 말씀 본문·찬양 가사·제목은 여기 올 일이 없다 — 리치 텍스트가 아니라 일반 입력칸이다.
 */
export type SpellSegment = { text: string; from: number };

/** 줄바꿈(hardBreak)은 한 칸을 차지하고 글자열에서도 한 글자다. 검사기는 문장 경계로 본다 */
const HARD_BREAK = "\n";

export function collectSegments(doc: PMNode): SpellSegment[] {
  const segments: SpellSegment[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name === "codeBlock") return false;
    if (!node.isTextblock) return true;

    let text = "";
    let from = -1;
    const flush = () => {
      if (text.trim() !== "") segments.push({ text, from });
      text = "";
      from = -1;
    };

    node.forEach((child, offset) => {
      const at = pos + 1 + offset;

      if (child.isText && !child.marks.some((mark) => mark.type.name === "code")) {
        if (from === -1) from = at;
        text += normalize(child.text ?? "");
      } else if (child.type.name === "hardBreak") {
        if (from === -1) from = at;
        text += HARD_BREAK;
      } else {
        flush();
      }
    });
    flush();

    return false;
  });

  return segments;
}

/**
 * 붙여넣은 글에는 줄바꿈 없는 공백(U+00A0)이 섞인다. 검사기는 그것을 공백으로 보지 않아
 * 멀쩡한 띄어쓰기를 틀렸다고 한다. **길이가 같은 글자로만** 바꾼다 — 위치가 어긋나면 안 된다.
 */
export function normalize(text: string): string {
  return text.replace(/ /g, " ");
}

/** 문서의 from~to를 segment와 같은 규칙으로 읽는다. 밑줄이 아직 같은 말 위에 있는지 볼 때 쓴다 */
export function readRange(doc: PMNode, from: number, to: number): string {
  return normalize(
    doc.textBetween(from, to, HARD_BREAK, (leaf) =>
      leaf.type.name === "hardBreak" ? HARD_BREAK : "￼",
    ),
  );
}
