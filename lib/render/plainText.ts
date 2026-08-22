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
  text?: unknown;
  content?: unknown;
};

/** 블록 경계로 취급하는 노드 — 평문에서 줄바꿈이 된다 */
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

/** 검색 색인에 넣기 전 공백 정리 — 줄바꿈·연속 공백을 한 칸으로 */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
