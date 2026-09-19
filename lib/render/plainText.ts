import type { TiptapDoc } from "@/lib/content/schema";

/**
 * Tiptap JSON → 평문 (04 §3.1의 3-타깃 중 하나).
 *
 * 같은 노드 순회가 React 렌더 / 평문 추출 / 마크다운 직렬화의 출력만 다르게 낸다.
 * 평문 타깃이 먼저 필요한 이유는 검색(05 §4A)이 발행 시점에 searchText를 채우기 때문이다.
 * React·마크다운 타깃은 M3에서 같은 순회 위에 붙인다.
 *
 * 모르는 노드는 건너뛴다 — 렌더러가 노드 종류를 다 알 수는 없고(ADR-002 근거 6),
 * 검색 색인이 낯선 노드 하나 때문에 실패하면 안 된다.
 */

type UnknownNode = {
  type?: unknown;
  attrs?: unknown;
  text?: unknown;
  content?: unknown;
};

/** 줄 경계로 취급하는 노드 — 평문에서 줄바꿈이 된다 */
const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "listItem",
  "bulletList",
  "orderedList",
  "horizontalRule",
  "tableRow",
  // 칸을 경계로 보지 않으면 "합계" + "3" 이 "합계3"으로 붙어 검색에 걸리지 않는다
  "tableCell",
  "tableHeader",
  /**
   * 블록은 아니지만 **줄은 끊는다.** 여기 없던 동안 문단 안의 줄바꿈이 색인에서 사라져
   * "감사"⏎"합니다"가 `감사합니다` 한 낱말로 붙었다 — 위 칸 이야기와 같은 고장이다.
   *
   * 가공의 사례가 아니다. 티스토리 컨버터가 `<br>`을 전부 이 노드로 옮겼으므로
   * (`scripts/migrate-tistory/convertHtml.ts:218`) 이관해 온 글 대부분이 그 상태였다.
   * 나머지 두 타깃은 처음부터 줄로 다루고 있었다(`markdown.ts:38`, `richText.tsx:311`).
   */
  "hardBreak",
]);

function walk(node: unknown, out: string[]): void {
  if (typeof node !== "object" || node === null) return;

  if (Array.isArray(node)) {
    for (const child of node) walk(child, out);
    return;
  }

  const candidate = node as UnknownNode;

  if (typeof candidate.text === "string") {
    out.push(candidate.text);
  }

  /**
   * 이미지의 대체 글자도 줍는다. 마크다운 타깃은 처음부터 담고 있었다(`markdown.ts`).
   *
   * 옛 글을 찾을 때 기억하는 것에 **사진 설명**이 든다 — 색인이 그 말을 모르면 그 말로는
   * 글을 못 찾는다(05 §4A "작성자가 기억하는 것들").
   */
  if (candidate.type === "image") {
    const alt = (candidate as { attrs?: { alt?: unknown } }).attrs?.alt;
    if (typeof alt === "string" && alt.trim() !== "") out.push(alt);
  }

  if (Array.isArray(candidate.content)) {
    for (const child of candidate.content) walk(child, out);
  }

  if (typeof candidate.type === "string" && BLOCK_TYPES.has(candidate.type)) {
    out.push("\n");
  }
}

/** Tiptap 문서의 텍스트만 뽑아 한 문자열로 만든다 */
export function tiptapToPlainText(doc: TiptapDoc | null | undefined): string {
  if (!doc) return "";

  const parts: string[] = [];
  walk(doc.content, parts);

  return normalizeWhitespace(parts.join(""));
}

/**
 * 붙여넣기용 평문 — **줄바꿈을 살린다** (04 §3.1 평문 타깃).
 *
 * 색인용(`tiptapToPlainText`)은 공백을 전부 한 칸으로 눕힌다. 검색은 어디서 끊겼는지를
 * 묻지 않기 때문이다. 반대로 옮겨 적으려고 복사한 글은 **문단이 곧 의미**라, 여기서는
 * 줄을 남기고 빈 줄만 하나로 줄인다.
 */
export function tiptapToCopyText(doc: TiptapDoc | null | undefined): string {
  if (!doc) return "";

  const parts: string[] = [];
  walk(doc.content, parts);

  return (
    parts
      .join("")
      .replace(/[^\S\n]+/g, " ")
      .replace(/ *\n */g, "\n")
      // 순회가 문단·목록마다 줄을 하나씩 넣어서 겹친다. 문단 하나 = 줄 하나로 눕힌다 —
      // 덩이 사이를 빈 줄로 끊는 것은 부르는 쪽의 일이다
      .replace(/\n{2,}/g, "\n")
      .trim()
  );
}

/** 검색 색인에 넣기 전 공백 정리 — 줄바꿈·연속 공백을 한 칸으로 */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
