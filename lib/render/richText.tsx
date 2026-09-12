import type { ReactNode } from "react";

import { CodeBlock } from "@/components/public/CodeBlock";
import { PostImage } from "@/components/public/PostImage";
import type { TiptapDoc } from "@/lib/content/schema";
import { headingId } from "@/lib/render/headingId";

/**
 * Tiptap JSON → React (04 §3.1).
 *
 * 정본은 JSON 하나이고 렌더러는 묵상·기술이 공유한다(MDX 불채택, 04 결정 로그 #9).
 * `generateHTML`을 쓰지 않고 노드를 직접 순회하는 이유는 노드 레벨 매핑이 필요하기 때문이다 —
 * 코드 블록→Shiki, 이미지→next/image, 제목→TOC 앵커.
 *
 * **모르는 노드는 건너뛴다.** 렌더러가 노드 종류를 다 알 수는 없고(ADR-002 근거 6), 낯선 노드
 * 하나 때문에 그 글이 안 열리면 그게 더 나쁘다. 낯선 노드에 글자가 있으면 문단으로 흘린다 —
 * 서식을 잃는 것과 내용을 잃는 것은 급이 다르다.
 *
 * 제목 목차를 **같은 패스에서** 뽑는다(04 §3.4). 두 번 순회하면 앵커가 어긋난다.
 */

export type RichTextHeading = { id: string; text: string; level: 2 | 3 };

export type RenderedRichText = {
  content: ReactNode;
  headings: RichTextHeading[];
};

export type CodeBlockSource = { code: string; language: string | null };

/**
 * 하이라이팅 결과를 찾는 키. 같은 코드·같은 언어면 같은 결과이므로 내용 자체를 키로 쓴다 —
 * 노드 위치를 키로 쓰면 문서를 고칠 때마다 어긋난다.
 */
export function codeKey({ code, language }: CodeBlockSource): string {
  return `${language ?? ""}\u0000${code}`;
}

/** 하이라이팅할 코드 블록을 미리 모은다. 렌더는 동기이고 하이라이팅은 비동기라서 갈라 놓는다 */
export function collectCodeBlocks(doc: TiptapDoc | null | undefined): CodeBlockSource[] {
  const found: CodeBlockSource[] = [];

  const walk = (nodes: unknown) => {
    if (!Array.isArray(nodes)) return;
    for (const raw of nodes) {
      const node = raw as Node;
      if (node.type === "codeBlock") {
        found.push({
          code: textOf(node),
          language: typeof node.attrs?.language === "string" ? node.attrs.language : null,
        });
      }
      walk(node.content);
    }
  };

  walk(doc?.content);
  return found;
}

/**
 * 제목만 훑는다. 목차는 지면 레이아웃(본문 밖 우측 여백)이 필요로 하므로 본문 렌더 결과를
 * 기다릴 수 없다 — 대신 앵커 계산을 렌더와 **같은 함수**(headingId)로 하고, 두 결과가 같다는
 * 것을 테스트로 고정한다. 어긋나면 목차 링크가 엉뚱한 곳으로 간다.
 */
export function collectHeadings(doc: TiptapDoc | null | undefined): RichTextHeading[] {
  const headings: RichTextHeading[] = [];
  const seen = new Map<string, number>();

  const walk = (nodes: unknown) => {
    if (!Array.isArray(nodes)) return;
    for (const raw of nodes) {
      const node = raw as Node;
      if (node.type === "heading") {
        const level = node.attrs?.level === 2 ? 2 : 3;
        const text = textOf(node);
        headings.push({ id: headingId(text, seen), text, level });
        continue;
      }
      walk(node.content);
    }
  };

  walk(doc?.content);
  return headings;
}

export type RenderOptions = {
  /** codeKey → 하이라이팅된 HTML. 없으면 평문 코드 블록으로 그린다 */
  highlighted?: Map<string, string>;
};

type Mark = { type?: unknown; attrs?: Record<string, unknown> };

type Node = {
  type?: unknown;
  text?: unknown;
  attrs?: Record<string, unknown>;
  content?: unknown;
  marks?: unknown;
};

/** 글자에 마크를 씌운다. 링크가 가장 바깥이다 — 밑줄·굵게가 링크 안쪽에 들어간다 */
function applyMarks(text: string, marks: Mark[], key: string): ReactNode {
  let node: ReactNode = text;

  if (marks.some((mark) => mark.type === "code")) node = <code key={key}>{node}</code>;
  if (marks.some((mark) => mark.type === "strike")) node = <s key={key}>{node}</s>;
  if (marks.some((mark) => mark.type === "underline")) node = <u key={key}>{node}</u>;
  if (marks.some((mark) => mark.type === "italic")) node = <em key={key}>{node}</em>;
  if (marks.some((mark) => mark.type === "bold")) node = <strong key={key}>{node}</strong>;

  const link = marks.find((mark) => mark.type === "link");
  const href = typeof link?.attrs?.href === "string" ? link.attrs.href : null;

  if (href) {
    node = (
      <a
        key={key}
        href={href}
        // 외부 링크가 대부분이다. 참조자 정보를 넘기지 않고, 새 창의 opener도 끊는다
        rel="noopener noreferrer nofollow"
        target="_blank"
      >
        {node}
      </a>
    );
  }

  return <span key={key}>{node}</span>;
}

function textOf(node: Node): string {
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  return (node.content as Node[]).map(textOf).join("");
}

/** 병합된 칸. 1이면 속성을 그리지 않는다 */
function spanOf(node: Node, name: "colspan" | "rowspan"): number | undefined {
  const value = node.attrs?.[name];
  return typeof value === "number" && value > 1 ? value : undefined;
}

/**
 * 표의 열 폭 (px). 하나라도 정해진 것이 있을 때만 답한다.
 *
 * 폭은 **첫 줄 칸의 `colwidth`**에 실린다(prosemirror-tables). 병합된 칸은 한 칸에 여러
 * 폭을 들고 있어 펴서 읽는다. 아무 칸에도 폭이 없으면(이관해 온 표가 그렇다) `null`을
 * 돌려 `colgroup` 자체를 세우지 않는다 — 빈 `<col>`은 아무 일도 안 하면서 조판만 흔든다.
 */
function columnWidths(table: Node): (number | null)[] | null {
  const rows = table.content;
  const firstRow = Array.isArray(rows) ? (rows[0] as Node | undefined) : undefined;
  const cells = firstRow?.content;
  if (!Array.isArray(cells)) return null;

  const widths: (number | null)[] = [];
  let hasAny = false;

  for (const cell of cells as Node[]) {
    const colwidth = cell.attrs?.colwidth;
    const span = spanOf(cell, "colspan") ?? 1;

    for (let index = 0; index < span; index += 1) {
      const width = Array.isArray(colwidth) ? colwidth[index] : null;
      const usable = typeof width === "number" && width > 0 ? width : null;
      if (usable !== null) hasAny = true;
      widths.push(usable);
    }
  }

  return hasAny ? widths : null;
}

type Context = {
  headings: RichTextHeading[];
  seen: Map<string, number>;
  highlighted: Map<string, string> | undefined;
};

function renderChildren(content: unknown, context: Context, prefix: string): ReactNode[] {
  if (!Array.isArray(content)) return [];
  return content.flatMap((child, index) => {
    const rendered = renderNode(child as Node, context, `${prefix}-${index}`);
    return rendered === null ? [] : [rendered];
  });
}

function renderNode(node: Node, context: Context, key: string): ReactNode {
  if (typeof node.text === "string") {
    const marks = Array.isArray(node.marks) ? (node.marks as Mark[]) : [];
    return marks.length > 0 ? applyMarks(node.text, marks, key) : node.text;
  }

  const children = () => renderChildren(node.content, context, key);

  switch (node.type) {
    case "paragraph":
      return <p key={key}>{children()}</p>;

    case "heading": {
      const level = node.attrs?.level === 2 ? 2 : 3;
      const text = textOf(node);
      const id = headingId(text, context.seen);
      context.headings.push({ id, text, level });

      // 앵커 id는 목차와 링크 공유가 함께 쓴다
      return level === 2 ? (
        <h2 key={key} id={id}>
          {children()}
        </h2>
      ) : (
        <h3 key={key} id={id}>
          {children()}
        </h3>
      );
    }

    case "blockquote":
      return <blockquote key={key}>{children()}</blockquote>;

    case "bulletList":
      return <ul key={key}>{children()}</ul>;

    case "orderedList":
      return <ol key={key}>{children()}</ol>;

    case "listItem":
      return <li key={key}>{children()}</li>;

    case "codeBlock": {
      const language = typeof node.attrs?.language === "string" ? node.attrs.language : null;
      const code = textOf(node);

      return (
        <CodeBlock
          key={key}
          code={code}
          language={language}
          html={context.highlighted?.get(codeKey({ code, language })) ?? null}
        />
      );
    }

    /*
      넓은 표가 본문 폭을 밀어내지 않도록 자기 안에서만 좌우로 넘긴다 — 지면이 가로로
      스크롤되면 읽는 자리가 흔들린다.

      **폭을 여기서도 그린다.** 에디터에서 끌어 정한 폭은 칸의 `colwidth`에 실리는데,
      `<colgroup>`이 없으면 지면에서는 그 값이 아무 일도 하지 않는다 — 쓴 사람이 본 표와
      읽는 사람이 보는 표가 달라진다. 이관해 온 표에는 `colwidth`가 없고(컨버터가 null을
      넣었다) 그때는 `colgroup`을 세우지 않아 예전처럼 고르게 나뉜다.
    */
    case "table": {
      const widths = columnWidths(node);

      return (
        <div key={key} className="my-5 overflow-x-auto">
          <table>
            {widths && (
              <colgroup>
                {widths.map((width, index) => (
                  <col
                    // 열은 자리가 곧 정체다
                    // biome-ignore lint/suspicious/noArrayIndexKey: 자리 번호가 식별자다
                    key={index}
                    style={width === null ? undefined : { width: `${width}px` }}
                  />
                ))}
              </colgroup>
            )}
            <tbody>{children()}</tbody>
          </table>
        </div>
      );
    }

    case "tableRow":
      return <tr key={key}>{children()}</tr>;

    case "tableHeader":
      return (
        <th key={key} colSpan={spanOf(node, "colspan")} rowSpan={spanOf(node, "rowspan")}>
          {children()}
        </th>
      );

    case "tableCell":
      return (
        <td key={key} colSpan={spanOf(node, "colspan")} rowSpan={spanOf(node, "rowspan")}>
          {children()}
        </td>
      );

    case "horizontalRule":
      return <hr key={key} />;

    case "hardBreak":
      return <br key={key} />;

    case "image": {
      const src = typeof node.attrs?.src === "string" ? node.attrs.src : null;
      if (!src) return null;

      return (
        <PostImage
          key={key}
          src={src}
          alt={typeof node.attrs?.alt === "string" ? node.attrs.alt : ""}
          width={typeof node.attrs?.width === "number" ? node.attrs.width : null}
          height={typeof node.attrs?.height === "number" ? node.attrs.height : null}
        />
      );
    }

    default: {
      // 모르는 노드: 글자가 있으면 문단으로 흘린다. 서식은 잃어도 내용은 남는다
      const text = textOf(node);
      return text.trim() === "" ? null : <p key={key}>{text}</p>;
    }
  }
}

export function renderRichText(
  doc: TiptapDoc | null | undefined,
  options: RenderOptions = {},
): RenderedRichText {
  const context: Context = { headings: [], seen: new Map(), highlighted: options.highlighted };

  if (!doc || !Array.isArray(doc.content)) {
    return { content: null, headings: [] };
  }

  const content = renderChildren(doc.content, context, "n");

  return { content, headings: context.headings };
}
