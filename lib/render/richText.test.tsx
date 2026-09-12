import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TiptapDoc } from "@/lib/content/schema";
import { codeKey, collectHeadings, renderRichText } from "@/lib/render/richText";

/**
 * 렌더러는 묵상·기술이 공유하는 유일한 직렬화기다(04 §3.1). 여기서 고정하는 것은 두 가지다.
 * 1. 저장된 서식이 지면에 그대로 나오는가
 * 2. **모르는 노드가 글을 못 열게 만들지 않는가** (ADR-002 근거 6)
 */
function view(doc: unknown) {
  const { content, headings } = renderRichText(doc as TiptapDoc);
  const { container } = render(<div className="record-prose">{content}</div>);
  return { container, headings };
}

const doc = (...nodes: unknown[]) => ({ type: "doc", content: nodes });
const text = (value: string) => ({ type: "text", text: value });

describe("renderRichText — 블록", () => {
  it("문단·제목·인용·목록·구분선을 그린다", () => {
    const { container } = view(
      doc(
        { type: "paragraph", content: [text("문단")] },
        { type: "heading", attrs: { level: 2 }, content: [text("큰 제목")] },
        { type: "heading", attrs: { level: 3 }, content: [text("작은 제목")] },
        { type: "blockquote", content: [{ type: "paragraph", content: [text("인용")] }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [text("항목")] }] },
          ],
        },
        { type: "horizontalRule" },
      ),
    );

    expect(container.querySelector("p")?.textContent).toBe("문단");
    expect(container.querySelector("h2")?.textContent).toBe("큰 제목");
    expect(container.querySelector("h3")?.textContent).toBe("작은 제목");
    expect(container.querySelector("blockquote p")?.textContent).toBe("인용");
    expect(container.querySelectorAll("ul li")).toHaveLength(1);
    expect(container.querySelector("hr")).not.toBeNull();
  });

  it("코드 블록은 언어 라벨·복사 버튼과 함께 서고 줄바꿈을 지킨다", () => {
    const { container } = view(
      doc({
        type: "codeBlock",
        attrs: { language: "ts" },
        content: [text("const a = 1;\nconst b = 2;")],
      }),
    );

    expect(container.textContent).toContain("TypeScript");
    expect(container.querySelector("pre code")?.textContent).toBe("const a = 1;\nconst b = 2;");
  });

  it("하이라이팅된 HTML이 있으면 그것을 쓴다 — 없으면 평문이다", () => {
    const source = doc({
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [text("const a = 1;")],
    });
    const highlighted = new Map([
      [
        codeKey({ code: "const a = 1;", language: "ts" }),
        '<pre class="shiki"><code>색칠됨</code></pre>',
      ],
    ]);

    const { content } = renderRichText(source as TiptapDoc, { highlighted });
    const { container } = render(<div>{content}</div>);

    expect(container.querySelector(".record-code")?.textContent).toBe("색칠됨");
  });

  it("이미지는 alt와 함께 지연 로딩한다", () => {
    const { container } = view(
      doc({ type: "image", attrs: { src: "https://e.com/a.png", alt: "도표" } }),
    );

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://e.com/a.png");
    expect(img?.getAttribute("alt")).toBe("도표");
    expect(img?.getAttribute("loading")).toBe("lazy");
  });

  it("src 없는 이미지는 그리지 않는다", () => {
    const { container } = view(doc({ type: "image", attrs: { alt: "빈 것" } }));
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("renderRichText — 표의 열 폭", () => {
  /**
   * 에디터에서 끌어 정한 폭은 칸의 `colwidth`에 실린다. `<colgroup>`을 안 그리면 지면에서
   * 그 값이 아무 일도 하지 않는다 — **쓴 사람이 본 표와 읽는 사람이 보는 표가 달라진다.**
   */
  const table = (...cells: unknown[]) =>
    doc({
      type: "table",
      content: [{ type: "tableRow", content: cells }],
    });

  const cell = (colwidth: unknown, colspan?: number) => ({
    type: "tableCell",
    attrs: { colwidth, ...(colspan ? { colspan } : {}) },
    content: [{ type: "paragraph", content: [text("칸")] }],
  });

  it("정해진 폭을 col로 그린다", () => {
    const { container } = view(table(cell([120]), cell([240])));

    const cols = container.querySelectorAll("col");
    expect(cols).toHaveLength(2);
    expect(cols[0]?.style.width).toBe("120px");
    expect(cols[1]?.style.width).toBe("240px");
  });

  it("폭이 하나도 없으면 colgroup을 세우지 않는다 — 이관해 온 표가 그렇다", () => {
    const { container } = view(table(cell(null), cell(null)));

    expect(container.querySelector("colgroup")).toBeNull();
  });

  it("일부만 정해져 있으면 나머지는 폭 없이 남긴다", () => {
    const { container } = view(table(cell([120]), cell(null)));

    const cols = container.querySelectorAll("col");
    expect(cols[0]?.style.width).toBe("120px");
    expect(cols[1]?.style.width).toBe("");
  });

  it("병합된 칸은 펴서 센다 — col 수가 실제 열 수와 같아야 한다", () => {
    const { container } = view(table(cell([100, 140], 2), cell([90])));

    expect(container.querySelectorAll("col")).toHaveLength(3);
  });
});

describe("renderRichText — 인라인 마크", () => {
  it("굵게·기울임·밑줄·취소선·코드를 씌운다", () => {
    const { container } = view(
      doc({
        type: "paragraph",
        content: [
          { type: "text", text: "굵게", marks: [{ type: "bold" }] },
          { type: "text", text: "기울임", marks: [{ type: "italic" }] },
          { type: "text", text: "밑줄", marks: [{ type: "underline" }] },
          { type: "text", text: "취소", marks: [{ type: "strike" }] },
          { type: "text", text: "코드", marks: [{ type: "code" }] },
        ],
      }),
    );

    expect(container.querySelector("strong")?.textContent).toBe("굵게");
    expect(container.querySelector("em")?.textContent).toBe("기울임");
    expect(container.querySelector("u")?.textContent).toBe("밑줄");
    expect(container.querySelector("s")?.textContent).toBe("취소");
    expect(container.querySelector("code")?.textContent).toBe("코드");
  });

  it("링크는 가장 바깥이고 외부 링크 안전 속성을 붙인다", () => {
    const { container } = view(
      doc({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "문서",
            marks: [{ type: "bold" }, { type: "link", attrs: { href: "https://e.com/a" } }],
          },
        ],
      }),
    );

    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://e.com/a");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    expect(link?.querySelector("strong")?.textContent).toBe("문서");
  });
});

describe("renderRichText — 목차 (04 §3.4)", () => {
  it("제목을 순서대로 뽑고 앵커를 심는다", () => {
    const { container, headings } = view(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [text("캐시 무효화")] },
        { type: "heading", attrs: { level: 3 }, content: [text("태그 체계")] },
      ),
    );

    expect(headings).toEqual([
      { id: "캐시-무효화", text: "캐시 무효화", level: 2 },
      { id: "태그-체계", text: "태그 체계", level: 3 },
    ]);
    expect(container.querySelector("h2")?.id).toBe("캐시-무효화");
  });

  it("같은 제목이 두 번이면 앵커가 갈린다 — 겹치면 목차 절반이 첫 항목으로 간다", () => {
    const { headings } = view(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [text("정리")] },
        { type: "heading", attrs: { level: 2 }, content: [text("정리")] },
      ),
    );

    expect(headings.map((heading) => heading.id)).toEqual(["정리", "정리-2"]);
  });

  it("한글 제목을 로마자로 바꾸지 않는다", () => {
    const { headings } = view(
      doc({ type: "heading", attrs: { level: 2 }, content: [text("주님의 시간에 (Live)")] }),
    );

    expect(headings[0]?.id).toBe("주님의-시간에-live");
  });
});

describe("renderRichText — 낯선 입력", () => {
  it("모르는 노드의 글자는 문단으로 흘린다 — 서식을 잃는 것과 내용을 잃는 것은 급이 다르다", () => {
    const { container } = view(
      doc({ type: "table", content: [{ type: "tableRow", content: [text("표 안의 글자")] }] }),
    );

    expect(container.textContent).toContain("표 안의 글자");
  });

  it("빈 문서·잘못된 문서에도 터지지 않는다", () => {
    expect(renderRichText(null).content).toBeNull();
    expect(renderRichText({ type: "doc", content: [] }).content).toEqual([]);
    expect(renderRichText({ type: "doc" } as unknown as TiptapDoc).headings).toEqual([]);
  });
});

describe("collectHeadings — 목차 추출 (04 §3.4)", () => {
  const sample = doc(
    { type: "heading", attrs: { level: 2 }, content: [text("정리")] },
    { type: "paragraph", content: [text("본문")] },
    {
      type: "blockquote",
      content: [{ type: "heading", attrs: { level: 3 }, content: [text("안쪽")] }],
    },
    { type: "heading", attrs: { level: 2 }, content: [text("정리")] },
  );

  it("렌더가 만든 앵커와 정확히 같다 — 어긋나면 목차 링크가 엉뚱한 곳으로 간다", () => {
    const { headings } = renderRichText(sample as TiptapDoc);

    expect(collectHeadings(sample as TiptapDoc)).toEqual(headings);
  });

  it("중첩된 제목도 순서대로 담는다", () => {
    expect(collectHeadings(sample as TiptapDoc).map((heading) => heading.id)).toEqual([
      "정리",
      "안쪽",
      "정리-2",
    ]);
  });
});
