import type { TiptapDoc } from "@/lib/content/schema";

/**
 * Tiptap JSON → 마크다운 (04 §3.1의 3-타깃 중 마지막 · 07 §3 lock-in 방어).
 *
 * 같은 노드 순회가 React 렌더 / 평문 추출 / 마크다운 직렬화의 출력만 다르게 낸다. 이 타깃의
 * 목적은 **언제든 이 블로그를 떠날 수 있다는 사실**이다 — 티스토리를 떠나며 겪은 일을 우리
 * 독자(=나)에게 되풀이하지 않는다.
 *
 * 붙여넣기 파서(lib/editor/markdown)의 반대 방향이다. 왕복이 완전히 같을 필요는 없지만
 * (서식 없는 글자는 그대로 남는다), **내용은 하나도 잃지 않아야 한다.**
 *
 * 모르는 노드는 글자만 흘린다 — 렌더러와 같은 규칙이다(ADR-002 근거 6).
 */

type Mark = { type?: unknown; attrs?: Record<string, unknown> };

type Node = {
  type?: unknown;
  text?: unknown;
  attrs?: Record<string, unknown>;
  content?: unknown;
  marks?: unknown;
};

/** 마크다운에서 뜻을 갖는 문자를 글자로 남긴다 */
function escapeText(text: string): string {
  return text.replace(/([\\`*_[\]])/g, "\\$1");
}

function inline(nodes: unknown): string {
  if (!Array.isArray(nodes)) return "";

  return (nodes as Node[])
    .map((node) => {
      if (typeof node.text !== "string") {
        // 문단 안의 이미지·줄바꿈 같은 것들
        if (node.type === "hardBreak") return "  \n";
        if (node.type === "image") return image(node);
        return inline(node.content);
      }

      const marks = (Array.isArray(node.marks) ? node.marks : []) as Mark[];
      const has = (type: string) => marks.some((mark) => mark.type === type);

      // 코드 안의 글자는 이스케이프하지 않는다 — 백틱 안에서는 마크다운 문법이 아니다
      let text = has("code") ? `\`${node.text}\`` : escapeText(node.text);

      if (has("bold")) text = `**${text}**`;
      if (has("italic")) text = `*${text}*`;
      if (has("strike")) text = `~~${text}~~`;
      // 밑줄은 마크다운에 없다. 굳이 HTML을 섞지 않고 글자만 남긴다

      const link = marks.find((mark) => mark.type === "link");
      const href = typeof link?.attrs?.href === "string" ? link.attrs.href : null;

      return href ? `[${text}](${href})` : text;
    })
    .join("");
}

function image(node: Node): string {
  const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
  const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
  return src ? `![${alt}](${src})` : "";
}

function textOf(node: Node): string {
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  return (node.content as Node[]).map(textOf).join("");
}

function listBlock(node: Node, ordered: boolean, depth: number): string {
  if (!Array.isArray(node.content)) return "";

  return (node.content as Node[])
    .map((item, index) => {
      const marker = ordered ? `${index + 1}.` : "-";
      const indent = "  ".repeat(depth);
      const children = Array.isArray(item.content) ? (item.content as Node[]) : [];

      // 첫 문단은 마커 뒤에, 그다음(중첩 목록 등)은 아래에 들여쓴다
      const [first, ...rest] = children;
      const head = first ? blocks([first], depth).trim() : "";
      const tail = rest.length > 0 ? `\n${blocks(rest, depth + 1)}` : "";

      return `${indent}${marker} ${head}${tail}`;
    })
    .join("\n");
}

function blocks(nodes: Node[], depth = 0): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "paragraph": {
          const text = inline(node.content);
          return text.trim() === "" ? "" : text;
        }

        case "heading": {
          // 지면의 최상위 제목은 h2다(02 §5.5) — 파서와 같은 규칙으로 되돌린다
          const level = node.attrs?.level === 2 ? "#" : "##";
          return `${level} ${inline(node.content)}`;
        }

        case "blockquote": {
          const inner = blocks(Array.isArray(node.content) ? (node.content as Node[]) : []);
          return inner
            .split("\n")
            .map((line) => (line === "" ? ">" : `> ${line}`))
            .join("\n");
        }

        case "bulletList":
          return listBlock(node, false, depth);

        case "orderedList":
          return listBlock(node, true, depth);

        case "codeBlock": {
          const language = typeof node.attrs?.language === "string" ? node.attrs.language : "";
          return `\`\`\`${language}\n${textOf(node)}\n\`\`\``;
        }

        case "horizontalRule":
          return "---";

        case "image":
          return image(node);

        default: {
          // 모르는 노드: 글자만 흘린다. 조판을 잃는 것과 내용을 잃는 것은 급이 다르다
          const text = textOf(node);
          return text.trim() === "" ? "" : text;
        }
      }
    })
    .filter((block) => block !== "")
    .join("\n\n");
}

/** Tiptap 문서를 마크다운 본문으로 */
export function tiptapToMarkdown(doc: TiptapDoc | null | undefined): string {
  if (!doc || !Array.isArray(doc.content)) return "";
  return blocks(doc.content as Node[]);
}
