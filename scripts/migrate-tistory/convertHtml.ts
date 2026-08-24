import { JSDOM } from "jsdom";

import { normalizeCodeLanguage } from "@/lib/editor/codeLanguages";

/**
 * 티스토리 본문 HTML → Tiptap JSON (05 §6.2 "sanitize가 실무 8할").
 *
 * `generateJSON`을 쓰지 않고 직접 순회한다. Tiptap에 맡기면 모르는 것을 **조용히** 버리는데,
 * 750편을 옮기면서 무엇을 잃었는지 모르는 것이 이 작업의 가장 큰 위험이다. 여기서는
 * 못 옮긴 것을 `notes`로 돌려주고, dry-run 리포트가 그걸 센다.
 *
 * 티스토리 마크업의 실제 모습:
 * - `data-ke-size`·`data-ke-list-type`·인라인 style이 거의 모든 태그에 붙어 있다 → 버린다
 * - `<p><figure>…</figure></p>` 처럼 문단 안에 블록이 들어 있다 → 문단을 컨테이너로 취급
 * - `<figure><span data-lightbox><img></span><figcaption></figcaption></figure>`
 * - `<span>`이 글자마다 감싸여 있다 → 통과시킨다(마크가 아니다)
 * - 코드 블록 언어가 두 갈래다. `data-ke-language`(사용자가 고른 것)와 `pre class`
 *   (티스토리 자동 감지). 자동 감지는 자주 틀린다 — SQL을 n1ql·routeros로 적어둔다
 */

export type ConvertNote = {
  kind: "dropped-element" | "unknown-language" | "iframe" | "empty-body";
  detail: string;
};

export type ConvertOptions = {
  /**
   * 빈 문단을 남긴다. 찬양 가사에서 **빈 줄이 절 구분**이기 때문이다 — 기본값은 버리는 것이고
   * (티스토리는 `<p>&nbsp;</p>`를 줄 간격으로 쓴다), 가사에서만 뜻이 있다.
   */
  keepEmptyParagraphs?: boolean;
};

export type ConvertResult = {
  /** TiptapDoc의 content 배열 */
  content: unknown[];
  notes: ConvertNote[];
};

type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

type Mark = { type: string; attrs?: Record<string, unknown> };

/** 글자에 씌울 수 있는 마크만 둔다(스키마와 렌더러가 아는 것) */
const MARK_BY_TAG: Record<string, string> = {
  B: "bold",
  STRONG: "bold",
  I: "italic",
  EM: "italic",
  U: "underline",
  INS: "underline",
  S: "strike",
  DEL: "strike",
  STRIKE: "strike",
  CODE: "code",
};

/** 통과시키는 껍데기 — 글자만 꺼낸다 */
const TRANSPARENT = new Set([
  "SPAN",
  "FONT",
  "DIV",
  "SECTION",
  "ARTICLE",
  "ASIDE",
  "MAIN",
  "LABEL",
  "SMALL",
]);

/** 조용히 버리는 것 */
const DISCARD = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "LINK", "META", "SVG", "BUTTON", "INPUT"]);

/** 우리가 이름을 아는 HTML 태그 — 여기 없는 이름은 글자였을 가능성이 있다 */
const KNOWN_TAGS = new Set([
  "P",
  "A",
  "BR",
  "HR",
  "IMG",
  "PRE",
  "CODE",
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
  "TD",
  "TH",
  "UL",
  "OL",
  "LI",
  "DL",
  "DT",
  "DD",
  "BLOCKQUOTE",
  "FIGURE",
  "FIGCAPTION",
  "IFRAME",
  "VIDEO",
  "AUDIO",
  "SOURCE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HTML",
  "HEAD",
  "BODY",
  "SUP",
  "SUB",
  "MARK",
  "ABBR",
  "TIME",
  "PICTURE",
  "CAPTION",
  "COL",
  "COLGROUP",
  "HGROUP",
  "HEADER",
  "FOOTER",
  "NAV",
  "FORM",
  "SELECT",
  "OPTION",
  "TEXTAREA",
  "CANVAS",
  "DETAILS",
  "SUMMARY",
  "EMBED",
  "OBJECT",
]);

/** 문단 안에 이런 게 있으면 문단이 아니라 컨테이너다 */
const BLOCK_IN_PARAGRAPH = "figure, img, table, pre, hr, iframe, blockquote, ul, ol";

/**
 * 티스토리 자동 감지가 일관되게 틀리는 것들.
 * `n1ql`은 백업 안의 실제 블록이 전부 평범한 SQL이었다(픽스처 105 참조).
 */
const AUTODETECT_FIXES: Record<string, string> = { n1ql: "sql" };

/** 자동 감지 라벨은 우리가 아는 언어일 때만 믿는다. 모르는 이름은 대개 오탐이다 */
function codeLanguageOf(pre: Element, notes: ConvertNote[]): string | null {
  const chosen = pre.getAttribute("data-ke-language");
  const code = pre.querySelector("code");
  const fromClass = [...(code?.classList ?? [])]
    .find((name) => name.startsWith("language-"))
    ?.slice("language-".length);

  // 사용자가 고른 값이 가장 믿을 만하다
  const trusted = chosen ?? fromClass;
  if (trusted) {
    const language = normalizeCodeLanguage(trusted);
    if (!language) notes.push({ kind: "unknown-language", detail: trusted });
    return language;
  }

  const detected = pre.className.split(/\s+/).filter(Boolean)[0];
  if (!detected) return null;

  return normalizeCodeLanguage(AUTODETECT_FIXES[detected] ?? detected);
}

/**
 * 우리가 아는 이름이 아니다 = 원문에서는 그냥 글자였다.
 *
 * `s3://<bucket-name>/키`처럼 코드 블록 밖에 적은 꺾쇠를 브라우저가 태그로 읽는다. 그러면
 * 뒤에 오던 글자가 그 태그의 **자식**이 되므로, 자식이 있는지로는 판별할 수 없다 —
 * 이름을 모른다는 것 자체가 근거다. 이름을 되살리고 자식은 그대로 이어 붙인다.
 */
function isSwallowedTag(element: Element): boolean {
  const tag = element.tagName;

  return !(
    Boolean(MARK_BY_TAG[tag]) ||
    TRANSPARENT.has(tag) ||
    DISCARD.has(tag) ||
    KNOWN_TAGS.has(tag)
  );
}

/** `<bucket-name>` — 원문에 적혀 있던 그대로 */
function swallowedText(element: Element): string {
  return `<${element.tagName.toLowerCase()}>`;
}

function cleanText(text: string): string {
  // &nbsp;(U+00A0)는 티스토리가 빈 줄·간격에 쓴다. 평범한 공백으로 눕힌다
  return text.replace(/ /g, " ").replace(/\s+/g, " ");
}

function textNode(text: string, marks: Mark[]): TiptapNode {
  return marks.length > 0 ? { type: "text", text, marks } : { type: "text", text };
}

/** 인라인 순회 — 글자와 마크만 만든다 */
function inline(node: Node, marks: Mark[], notes: ConvertNote[]): TiptapNode[] {
  if (node.nodeType === node.TEXT_NODE) {
    const text = cleanText(node.nodeValue ?? "");
    return text === "" ? [] : [textNode(text, marks)];
  }

  if (node.nodeType !== node.ELEMENT_NODE) return [];

  const element = node as Element;
  const tag = element.tagName;

  if (DISCARD.has(tag)) return [];
  if (tag === "BR") return [{ type: "hardBreak" }];

  if (isSwallowedTag(element)) {
    return [
      textNode(swallowedText(element), marks),
      ...[...element.childNodes].flatMap((child) => inline(child, marks, notes)),
    ];
  }

  const children = (next: Mark[]) =>
    [...element.childNodes].flatMap((child) => inline(child, next, notes));

  if (tag === "A") {
    const href = element.getAttribute("href");
    // 주소 없는 링크는 그냥 글자다
    return href ? children([...marks, { type: "link", attrs: { href } }]) : children(marks);
  }

  const mark = MARK_BY_TAG[tag];
  if (mark) return children([...marks, { type: mark }]);

  if (!TRANSPARENT.has(tag) && !["P", "LI", "TD", "TH", "FIGCAPTION"].includes(tag)) {
    notes.push({ kind: "dropped-element", detail: `inline <${tag.toLowerCase()}>` });
  }

  return children(marks);
}

function paragraph(content: TiptapNode[], keepEmpty = false): TiptapNode[] {
  // 빈 문단은 버린다. 티스토리 본문에는 `<p>&nbsp;</p>`가 줄 간격으로 잔뜩 들어 있다
  const empty =
    content.length === 0 ||
    content.every((child) => child.type === "text" && (child.text ?? "").trim() === "");

  if (empty) return keepEmpty ? [{ type: "paragraph" }] : [];

  return [{ type: "paragraph", content }];
}

function imageNode(img: Element): TiptapNode[] {
  const src = img.getAttribute("src");
  if (!src) return [];

  const width = Number(img.getAttribute("width") ?? img.getAttribute("data-origin-width"));
  const height = Number(img.getAttribute("height") ?? img.getAttribute("data-origin-height"));

  return [
    {
      type: "image",
      attrs: {
        src,
        alt: img.getAttribute("alt") ?? "",
        // 크기는 백업에 거의 없다. 이미지 이관 단계에서 실제 파일을 재서 채운다
        ...(Number.isFinite(width) && width > 0 ? { width } : {}),
        ...(Number.isFinite(height) && height > 0 ? { height } : {}),
      },
    },
  ];
}

/** `<figure>` = 이미지 + 캡션. 캡션은 우리 이미지 노드에 자리가 없어 아래 문단으로 남긴다 */
function figure(element: Element, notes: ConvertNote[]): TiptapNode[] {
  const img = element.querySelector("img");
  const iframe = element.querySelector("iframe");
  const caption = cleanText(element.querySelector("figcaption")?.textContent ?? "").trim();

  const body = img ? imageNode(img) : iframe ? iframeNode(iframe, notes) : [];

  return [...body, ...(caption ? paragraph([textNode(caption, [])]) : [])];
}

/** 임베드 자리는 없다. 주소를 남겨야 내용을 잃지 않는다 */
function iframeNode(element: Element, notes: ConvertNote[]): TiptapNode[] {
  const src = element.getAttribute("src");
  notes.push({ kind: "iframe", detail: src ?? "(주소 없음)" });
  if (!src) return [];

  return paragraph([textNode(src, [{ type: "link", attrs: { href: src } }])]);
}

function listItem(element: Element, notes: ConvertNote[]): TiptapNode[] {
  const children = blocks([...element.childNodes], notes);

  // listItem은 블록만 담을 수 있다. 글자만 있는 `<li>`는 문단으로 감싼다
  return [{ type: "listItem", content: children.length > 0 ? children : [{ type: "paragraph" }] }];
}

function cell(element: Element, notes: ConvertNote[]): TiptapNode[] {
  const children = blocks([...element.childNodes], notes);
  const colspan = Number(element.getAttribute("colspan") ?? 1);
  const rowspan = Number(element.getAttribute("rowspan") ?? 1);

  return [
    {
      type: element.tagName === "TH" ? "tableHeader" : "tableCell",
      attrs: {
        colspan: Number.isFinite(colspan) && colspan > 0 ? colspan : 1,
        rowspan: Number.isFinite(rowspan) && rowspan > 0 ? rowspan : 1,
        colwidth: null,
      },
      content: children.length > 0 ? children : [{ type: "paragraph" }],
    },
  ];
}

function table(element: Element, notes: ConvertNote[]): TiptapNode[] {
  const rows = [...element.querySelectorAll("tr")].map((row) => ({
    type: "tableRow",
    content: [...row.children]
      .filter((child) => child.tagName === "TD" || child.tagName === "TH")
      .flatMap((child) => cell(child, notes)),
  }));

  const filled = rows.filter((row) => (row.content?.length ?? 0) > 0);
  return filled.length > 0 ? [{ type: "table", content: filled }] : [];
}

/** 블록 순회 */
function blocks(nodes: Node[], notes: ConvertNote[], keepEmpty = false): TiptapNode[] {
  const out: TiptapNode[] = [];
  /** 블록 사이에 흩어진 글자를 모아 문단으로 만든다 */
  let loose: TiptapNode[] = [];

  const flush = () => {
    out.push(...paragraph(loose, keepEmpty));
    loose = [];
  };

  for (const node of nodes) {
    if (node.nodeType === node.TEXT_NODE) {
      loose.push(...inline(node, [], notes));
      continue;
    }

    if (node.nodeType !== node.ELEMENT_NODE) continue;

    const element = node as Element;
    const tag = element.tagName;

    if (DISCARD.has(tag)) continue;

    switch (tag) {
      case "P": {
        flush();
        // `<p><figure>…</figure></p>` — 문단이 블록을 품고 있으면 컨테이너로 본다
        if (element.querySelector(BLOCK_IN_PARAGRAPH)) {
          out.push(...blocks([...element.childNodes], notes));
        } else {
          out.push(
            ...paragraph([...element.childNodes].flatMap((child) => inline(child, [], notes))),
          );
        }
        continue;
      }

      case "H1":
      case "H2":
      case "H3":
      case "H4":
      case "H5":
      case "H6": {
        flush();
        // 지면의 최상위 제목은 h2다(02 §5.5). h1·h2 → 2, 그 아래는 전부 3으로 눕힌다
        const level = tag === "H1" || tag === "H2" ? 2 : 3;
        const content = [...element.childNodes].flatMap((child) => inline(child, [], notes));
        if (content.length > 0) out.push({ type: "heading", attrs: { level }, content });
        continue;
      }

      case "BLOCKQUOTE": {
        flush();
        const content = blocks([...element.childNodes], notes);
        if (content.length > 0) out.push({ type: "blockquote", content });
        continue;
      }

      case "UL":
      case "OL": {
        flush();
        const items = [...element.children]
          .filter((child) => child.tagName === "LI")
          .flatMap((child) => listItem(child, notes));
        if (items.length > 0) {
          out.push({ type: tag === "UL" ? "bulletList" : "orderedList", content: items });
        }
        continue;
      }

      case "PRE": {
        flush();
        const language = codeLanguageOf(element, notes);
        // 코드는 공백이 의미다 — cleanText를 쓰지 않는다
        const code = (element.querySelector("code") ?? element).textContent ?? "";
        const text = code.replace(/ /g, " ").replace(/\s+$/, "");
        if (text !== "") {
          out.push({
            type: "codeBlock",
            attrs: { language },
            content: [{ type: "text", text }],
          });
        }
        continue;
      }

      case "HR":
        flush();
        out.push({ type: "horizontalRule" });
        continue;

      case "FIGURE":
        flush();
        out.push(...figure(element, notes));
        continue;

      case "IMG":
        flush();
        out.push(...imageNode(element));
        continue;

      case "IFRAME":
        flush();
        out.push(...iframeNode(element, notes));
        continue;

      case "TABLE":
        flush();
        out.push(...table(element, notes));
        continue;

      case "BR":
        // 블록 사이의 `<br>`은 간격이다. 문단 안에서만 hardBreak가 된다
        continue;

      default: {
        if (MARK_BY_TAG[tag] || tag === "A" || TRANSPARENT.has(tag)) {
          // 껍데기 안에 블록(이미지·표)이 들어 있으면 블록으로 내려간다. 그러지 않으면
          // `<b><img></b>` 같은 자리의 이미지가 인라인에서 버려진다 — 굵게는 잃고 그림은 지킨다
          if (element.querySelector(BLOCK_IN_PARAGRAPH)) {
            flush();
            out.push(...blocks([...element.childNodes], notes));
          } else {
            loose.push(...inline(element, [], notes));
          }
          continue;
        }

        if (isSwallowedTag(element)) {
          loose.push(...inline(element, [], notes));
          continue;
        }

        notes.push({ kind: "dropped-element", detail: `block <${tag.toLowerCase()}>` });
        flush();
        out.push(...blocks([...element.childNodes], notes));
      }
    }
  }

  flush();
  return out;
}

export function htmlToTiptapContent(html: string, options: ConvertOptions = {}): ConvertResult {
  const notes: ConvertNote[] = [];
  const { document } = new JSDOM(`<body>${html}</body>`).window;

  const content = blocks([...document.body.childNodes], notes, options.keepEmptyParagraphs);

  if (content.length === 0) notes.push({ kind: "empty-body", detail: "변환 결과가 비었습니다" });

  return { content, notes };
}
