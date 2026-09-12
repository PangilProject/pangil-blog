/**
 * 마크다운 → Tiptap JSON (02 §5.5 "붙여넣기 → 커서 자리에 즉시 서식 변환").
 *
 * 기술 글의 최우선 인터랙션이다. AI와 대화하며 정리한 마크다운을 붙여넣는 것이 실제 작성
 * 경로이고(02 §5.5 "AI 협업 진입점"), 그래서 별도 미리보기 창도 변환 버튼도 없다.
 *
 * **직접 구현하는 이유**: 정본이 Tiptap JSON이고 렌더러도 자체 노드 매퍼다(04 §3.1,
 * MDX 불채택). 마크다운 라이브러리를 들이면 HTML을 한 번 경유하게 되는데, 그러면 지원
 * 블록 목록(02 §5.5 "여기까지만")을 라이브러리가 정하게 된다.
 *
 * 지원: 제목(h2/h3) · 본문 · 코드 블록(언어) · 인용 · 목록(중첩) · 이미지 · 링크 · 구분선
 * 미지원: 표 — Tiptap 표 확장이 아직 없다. 붙여넣으면 원문 그대로 문단으로 남는다
 */

export type MarkdownNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: MarkdownNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

/** 본문 최상위 제목은 h2다(02 §5.5) — `#`을 한 칸 밀어 매핑한다 */
function headingLevel(hashes: number): number {
  return hashes <= 1 ? 2 : 3;
}

const FENCE = /^\s*(?:```|~~~)\s*([\w+#-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const HR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED = /^(\s*)(\d+)[.)]\s+(.*)$/;
const IMAGE_ONLY = /^\s*!\[([^\]]*)\]\(([^\s)]+)\)\s*$/;

/**
 * 파이프 표 (02 §5.5).
 *
 * 표를 **내보내기는 하는데 읽지는 못했다** — `postToMarkdown`이 파이프 표로 내보내므로,
 * 내보낸 파일을 다시 붙여넣으면 표가 문단으로 풀렸다. 왕복이 끊긴 자리다.
 *
 * 가르는 줄(`|---|---|`)이 있어야 표로 본다. 그게 없으면 그냥 세로줄이 든 문장이고,
 * 평범한 글을 표로 바꾸면 붙여넣기가 무서워진다.
 */
const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const TABLE_DIVIDER = /^\s*\|(?:\s*:?-{1,}:?\s*\|)+\s*$/;

/** `| 가 | 나 |` → `["가", "나"]`. 이스케이프한 세로줄은 글자로 남긴다 */
function tableCells(line: string): string[] {
  const inner = TABLE_ROW.exec(line)?.[1] ?? "";

  return inner.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, "|").trim());
}

/**
 * 붙여넣은 글이 마크다운인가.
 *
 * 신호가 없으면 변환하지 않는다 — 평범한 글에서 별표 하나를 기울임으로 바꿔버리면
 * 붙여넣기가 무서워진다. 문단 구조를 만드는 표시(제목·목록·코드 울타리·인용)를 먼저 본다.
 */
export function looksLikeMarkdown(text: string): boolean {
  const lines = text.split("\n");

  return lines.some(
    (line) =>
      HEADING.test(line) ||
      FENCE.test(line) ||
      TABLE_DIVIDER.test(line) ||
      BULLET.test(line) ||
      ORDERED.test(line) ||
      QUOTE.test(line) ||
      /\[[^\]]+\]\([^\s)]+\)/.test(line) ||
      /(\*\*|__)[^\s*_][\s\S]*?(\*\*|__)/.test(line) ||
      /`[^`]+`/.test(line),
  );
}

function textNode(text: string, marks: MarkdownNode["marks"] = undefined): MarkdownNode | null {
  if (text === "") return null;
  return marks && marks.length > 0 ? { type: "text", text, marks } : { type: "text", text };
}

/**
 * 인라인 서식. 코드가 가장 강하다 — 백틱 안의 별표는 서식이 아니다.
 * 인라인 이미지는 alt 글자로 남긴다(이미지는 문단을 차지하는 블록으로만 다룬다).
 */
export function parseInline(source: string): MarkdownNode[] {
  const out: MarkdownNode[] = [];
  let rest = source;

  const pattern =
    /(`+)([^`]+?)\1|!\[([^\]]*)\]\(([^\s)]+)\)|\[([^\]]+)\]\(([^\s)]+)\)|(\*\*|__)(?=\S)([\s\S]+?)(?<=\S)\7|(~~)(?=\S)([\s\S]+?)(?<=\S)\9|(\*|_)(?=\S)([^*_]+?)(?<=\S)\11/;

  while (rest !== "") {
    const match = pattern.exec(rest);
    if (!match || match.index === undefined) break;

    const before = rest.slice(0, match.index);
    const beforeNode = textNode(before);
    if (beforeNode) out.push(beforeNode);

    const [
      whole,
      ,
      code,
      imageAlt,
      ,
      linkText,
      linkHref,
      ,
      strongText,
      ,
      strikeText,
      ,
      emphasisText,
    ] = match;

    if (code !== undefined) {
      out.push({ type: "text", text: code, marks: [{ type: "code" }] });
    } else if (imageAlt !== undefined) {
      const alt = textNode(imageAlt);
      if (alt) out.push(alt);
    } else if (linkText !== undefined && linkHref !== undefined) {
      out.push({
        type: "text",
        text: linkText,
        marks: [{ type: "link", attrs: { href: linkHref } }],
      });
    } else if (strongText !== undefined) {
      out.push(...withMark(parseInline(strongText), "bold"));
    } else if (strikeText !== undefined) {
      out.push(...withMark(parseInline(strikeText), "strike"));
    } else if (emphasisText !== undefined) {
      out.push(...withMark(parseInline(emphasisText), "italic"));
    }

    rest = rest.slice(match.index + whole.length);
  }

  const tail = textNode(rest);
  if (tail) out.push(tail);

  return out;
}

function withMark(nodes: MarkdownNode[], mark: string): MarkdownNode[] {
  return nodes.map((node) => ({
    ...node,
    marks: [...(node.marks ?? []), { type: mark }],
  }));
}

function paragraph(lines: string[]): MarkdownNode | null {
  // 마크다운은 이어진 줄을 한 문단으로 본다
  const text = lines.join(" ").trim();
  if (text === "") return null;
  return { type: "paragraph", content: parseInline(text) };
}

type ListKind = "bulletList" | "orderedList";

function listMatch(line: string): { kind: ListKind; indent: number; text: string } | null {
  const bullet = BULLET.exec(line);
  if (bullet) {
    return { kind: "bulletList", indent: bullet[1]?.length ?? 0, text: bullet[2] ?? "" };
  }

  const ordered = ORDERED.exec(line);
  if (ordered) {
    return { kind: "orderedList", indent: ordered[1]?.length ?? 0, text: ordered[3] ?? "" };
  }

  return null;
}

/**
 * 목록 블록을 중첩까지 읽는다. AI가 준 마크다운은 거의 항상 중첩 목록을 쓴다.
 * 들여쓰기가 더 깊은 줄은 그 항목의 자식으로 넘긴다.
 */
function parseList(lines: string[], start: number): { node: MarkdownNode; next: number } {
  const first = listMatch(lines[start] ?? "");
  const kind = first?.kind ?? "bulletList";
  const baseIndent = first?.indent ?? 0;

  const items: MarkdownNode[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const item = listMatch(line);

    if (!item || item.indent < baseIndent) break;
    // 같은 층에서 종류가 바뀌면 다른 목록이다
    if (item.indent === baseIndent && item.kind !== kind) break;

    if (item.indent > baseIndent) {
      const nested = parseList(lines, index);
      const last = items[items.length - 1];
      if (last) {
        last.content = [...(last.content ?? []), nested.node];
      } else {
        items.push({ type: "listItem", content: [nested.node] });
      }
      index = nested.next;
      continue;
    }

    const content: MarkdownNode[] = [];
    const text = paragraph([item.text]);
    if (text) content.push(text);
    items.push({ type: "listItem", content });
    index += 1;
  }

  return { node: { type: kind, content: items }, next: index };
}

/** 마크다운을 Tiptap 노드 배열로 바꾼다. 빈 입력은 빈 배열이다 */
/**
 * 머리 줄 + 본문 줄 → 표 노드.
 *
 * 줄마다 칸 수가 다를 수 있다(손으로 적은 표가 그렇다). **머리 줄을 기준으로 맞춘다** —
 * 모자라면 빈 칸을 채우고 넘치면 버리지 않고 남긴다. 칸 수가 어긋난 표는 ProseMirror가
 * 통째로 거부하므로, 여기서 맞춰 두지 않으면 붙여넣기가 조용히 실패한다.
 */
function tableNode(header: string[], rows: string[][]): MarkdownNode {
  const width = Math.max(header.length, ...rows.map((row) => row.length), 1);

  const toRow = (cells: string[], kind: "tableHeader" | "tableCell"): MarkdownNode => ({
    type: "tableRow",
    content: Array.from({ length: width }, (_, index) => ({
      type: kind,
      content: [{ type: "paragraph", content: parseInline(cells[index] ?? "") }],
    })),
  });

  return {
    type: "table",
    content: [toRow(header, "tableHeader"), ...rows.map((row) => toRow(row, "tableCell"))],
  };
}

export function markdownToTiptapContent(markdown: string): MarkdownNode[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const out: MarkdownNode[] = [];
  let buffer: string[] = [];

  const flush = () => {
    const node = paragraph(buffer);
    if (node) out.push(node);
    buffer = [];
  };

  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";

    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      const language = fence[1] ?? "";
      const code: string[] = [];
      index += 1;

      while (index < lines.length && !FENCE.test(lines[index] ?? "")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      // 닫는 울타리가 없어도 버리지 않는다 — 붙여넣기는 잘려서 오기도 한다
      index += 1;

      out.push({
        type: "codeBlock",
        ...(language === "" ? {} : { attrs: { language } }),
        ...(code.length > 0 ? { content: [{ type: "text", text: code.join("\n") }] } : {}),
      });
      continue;
    }

    if (line.trim() === "") {
      flush();
      index += 1;
      continue;
    }

    /*
      표는 **가르는 줄이 둘째 줄에 있을 때만** 표다. 머리 줄과 가르는 줄을 함께 보고 결정한다 —
      한 줄만 보면 `| 이건 표가 아니다 |` 같은 문장도 표가 된다.
    */
    if (TABLE_ROW.test(line) && TABLE_DIVIDER.test(lines[index + 1] ?? "")) {
      flush();

      const header = tableCells(line);
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length && TABLE_ROW.test(lines[index] ?? "")) {
        rows.push(tableCells(lines[index] ?? ""));
        index += 1;
      }

      out.push(tableNode(header, rows));
      continue;
    }

    if (HR.test(line) && buffer.length === 0) {
      flush();
      out.push({ type: "horizontalRule" });
      index += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      out.push({
        type: "heading",
        attrs: { level: headingLevel(heading[1]?.length ?? 1) },
        content: parseInline(heading[2] ?? ""),
      });
      index += 1;
      continue;
    }

    const image = IMAGE_ONLY.exec(line);
    if (image) {
      flush();
      out.push({
        type: "image",
        attrs: { src: image[2], alt: image[1] === "" ? null : image[1] },
      });
      index += 1;
      continue;
    }

    const quote = QUOTE.exec(line);
    if (quote) {
      flush();
      const quoted: string[] = [];
      while (index < lines.length) {
        const current = QUOTE.exec(lines[index] ?? "");
        if (!current) break;
        quoted.push(current[1] ?? "");
        index += 1;
      }
      out.push({ type: "blockquote", content: markdownToTiptapContent(quoted.join("\n")) });
      continue;
    }

    if (listMatch(line)) {
      flush();
      const { node, next } = parseList(lines, index);
      out.push(node);
      index = next;
      continue;
    }

    buffer.push(line.trim());
    index += 1;
  }

  flush();
  return out;
}
