/**
 * 변환된 Tiptap 블록을 다루는 잔손 (05 §6.2 faith 컨버터 공용).
 *
 * faith 세 타입은 **HTML을 다시 파싱하지 않는다.** 슬라이스 2의 변환 결과(블록 배열) 위에서
 * 구조만 가른다 — 그러면 답변 안의 굵게·링크·이미지가 그대로 살아 있고, 티스토리 마크업의
 * 기괴함을 한 곳에서만 상대한다.
 */

export type Block = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: unknown;
  text?: string;
  marks?: unknown;
};

export function textOf(node: unknown): string {
  if (typeof node !== "object" || node === null) return "";

  const block = node as Block;
  if (typeof block.text === "string") return block.text;
  if (!Array.isArray(block.content)) return "";

  return (block.content as unknown[]).map(textOf).join("");
}

/** 블록 하나의 글자 — 앞뒤 공백과 &nbsp; 잔재를 턴다 */
export function lineOf(node: unknown): string {
  return textOf(node).replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

/** 글자가 없어도 뜻이 있는 블록 — 가로선은 말씀과 본문의 경계다 */
const MEANINGFUL_WITHOUT_TEXT = new Set(["image", "table", "horizontalRule"]);

export function isEmptyBlock(node: unknown): boolean {
  const block = node as Block;
  if (block?.type && MEANINGFUL_WITHOUT_TEXT.has(block.type)) return false;
  return lineOf(node) === "";
}

/** 답변·요약처럼 Tiptap 문서로 담는 자리 */
export function toDoc(blocks: unknown[]): { type: "doc"; content: unknown[] } {
  return { type: "doc", content: blocks.filter((block) => !isEmptyBlock(block)) };
}

/** `: 답변` — 티스토리에서 답변 앞에 붙이던 표시를 뗀다 */
export function stripAnswerMarker(block: unknown): unknown {
  const node = block as Block;
  if (node?.type !== "paragraph" || !Array.isArray(node.content)) return block;

  const [first, ...rest] = node.content as Block[];
  if (typeof first?.text !== "string") return block;

  const stripped = first.text.replace(/^\s*[:：]\s*/, "");
  if (stripped === first.text) return block;

  return {
    ...node,
    content: [...(stripped === "" ? [] : [{ ...first, text: stripped }]), ...rest],
  };
}

/**
 * `<br>`로만 줄을 나눈 문단을 줄 단위 문단으로 편다.
 *
 * 티스토리에서는 같은 구조를 두 가지로 적을 수 있다 — 문단을 여러 개 두거나, 한 문단 안에서
 * `<br>`로 줄을 나누거나. QT 글 몇 편은 질문 6개와 답변 전부가 **한 문단**에 들어 있었고,
 * 그 글들은 그룹 제목을 하나도 찾지 못했다. faith 컨버터는 줄 단위로 구조를 읽으므로
 * 여기서 먼저 편다.
 *
 * 기술 글에는 쓰지 않는다 — 거기서 `<br>`는 문단 안의 줄바꿈 그 자체다.
 */
export function explodeHardBreaks(blocks: unknown[]): unknown[] {
  return blocks.flatMap((block) => {
    const node = block as Block;
    if (node?.type !== "paragraph" || !Array.isArray(node.content)) return [block];

    const parts: unknown[][] = [[]];
    for (const child of node.content as Block[]) {
      if (child?.type === "hardBreak") parts.push([]);
      else parts[parts.length - 1].push(child);
    }

    if (parts.length === 1) return [block];

    return parts.filter((part) => part.length > 0).map((part) => ({ ...node, content: part }));
  });
}
