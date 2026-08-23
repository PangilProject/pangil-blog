import { describe, expect, it } from "vitest";

import { looksLikeMarkdown, markdownToTiptapContent, parseInline } from "@/lib/editor/markdown";

/**
 * 기술 글의 최우선 인터랙션이다(02 §5.5). AI와 대화하며 정리한 마크다운을 붙여넣는 것이
 * 실제 작성 경로이므로, 여기서 고정하는 것은 "실제로 그렇게 생긴 입력"이다.
 */

describe("looksLikeMarkdown — 신호가 없으면 변환하지 않는다", () => {
  it("문단 구조를 만드는 표시를 알아본다", () => {
    expect(looksLikeMarkdown("## 제목")).toBe(true);
    expect(looksLikeMarkdown("- 항목")).toBe(true);
    expect(looksLikeMarkdown("1. 항목")).toBe(true);
    expect(looksLikeMarkdown("> 인용")).toBe(true);
    expect(looksLikeMarkdown("```ts\nconst a = 1\n```")).toBe(true);
    expect(looksLikeMarkdown("[링크](https://example.com)")).toBe(true);
    expect(looksLikeMarkdown("**굵게**")).toBe(true);
    expect(looksLikeMarkdown("`code`")).toBe(true);
  });

  it("평범한 글은 건드리지 않는다 — 별표 하나로 서식이 되면 붙여넣기가 무서워진다", () => {
    expect(looksLikeMarkdown("오늘 배운 것을 정리했다. 2*3=6 이고 5-2=3 이다.")).toBe(false);
    expect(looksLikeMarkdown("그냥 여러 줄\n짧은 메모")).toBe(false);
  });
});

describe("parseInline", () => {
  it("굵게·기울임·취소선·코드·링크를 마크로 옮긴다", () => {
    expect(parseInline("**굵게** *기울임* ~~취소~~ `code`")).toEqual([
      { type: "text", text: "굵게", marks: [{ type: "bold" }] },
      { type: "text", text: " " },
      { type: "text", text: "기울임", marks: [{ type: "italic" }] },
      { type: "text", text: " " },
      { type: "text", text: "취소", marks: [{ type: "strike" }] },
      { type: "text", text: " " },
      { type: "text", text: "code", marks: [{ type: "code" }] },
    ]);
  });

  it("링크는 href를 싣는다", () => {
    expect(parseInline("[문서](https://example.com/a)")).toEqual([
      {
        type: "text",
        text: "문서",
        marks: [{ type: "link", attrs: { href: "https://example.com/a" } }],
      },
    ]);
  });

  it("코드 안의 별표는 서식이 아니다", () => {
    expect(parseInline("`a * b`")).toEqual([
      { type: "text", text: "a * b", marks: [{ type: "code" }] },
    ]);
  });

  it("겹친 서식은 마크를 겹친다", () => {
    expect(parseInline("**굵고 *기울인* 것**")).toEqual([
      { type: "text", text: "굵고 ", marks: [{ type: "bold" }] },
      { type: "text", text: "기울인", marks: [{ type: "italic" }, { type: "bold" }] },
      { type: "text", text: " 것", marks: [{ type: "bold" }] },
    ]);
  });

  it("서식 없는 글은 글자 하나로 남는다", () => {
    expect(parseInline("그냥 문장")).toEqual([{ type: "text", text: "그냥 문장" }]);
  });
});

describe("markdownToTiptapContent — 블록", () => {
  it("제목은 h2·h3로 내려 맞춘다 — 지면의 최상위 제목이 h2다", () => {
    const nodes = markdownToTiptapContent("# 큰 제목\n\n## 작은 제목\n\n#### 더 작은 제목");

    expect(nodes.map((node) => node.attrs?.level)).toEqual([2, 3, 3]);
  });

  it("코드 블록은 언어를 싣고 줄바꿈을 지킨다", () => {
    const [node] = markdownToTiptapContent("```ts\nconst a = 1;\nconst b = 2;\n```");

    expect(node).toEqual({
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [{ type: "text", text: "const a = 1;\nconst b = 2;" }],
    });
  });

  it("닫는 울타리가 없어도 코드를 버리지 않는다 — 붙여넣기는 잘려서 오기도 한다", () => {
    const [node] = markdownToTiptapContent("```\nnpm run build");

    expect(node?.type).toBe("codeBlock");
    expect(node?.content?.[0]?.text).toBe("npm run build");
  });

  it("인용은 안쪽도 마크다운으로 읽는다", () => {
    const [node] = markdownToTiptapContent("> **핵심**은 이것이다\n> 두 번째 줄");

    expect(node?.type).toBe("blockquote");
    expect(node?.content?.[0]?.type).toBe("paragraph");
    expect(node?.content?.[0]?.content?.[0]).toEqual({
      type: "text",
      text: "핵심",
      marks: [{ type: "bold" }],
    });
  });

  it("구분선을 알아본다", () => {
    expect(markdownToTiptapContent("---")[0]).toEqual({ type: "horizontalRule" });
  });

  it("이미지 한 줄은 이미지 블록이다", () => {
    expect(markdownToTiptapContent("![도표](https://example.com/a.png)")[0]).toEqual({
      type: "image",
      attrs: { src: "https://example.com/a.png", alt: "도표" },
    });
  });

  it("이어진 줄은 한 문단이다", () => {
    const nodes = markdownToTiptapContent("첫 줄\n이어지는 줄\n\n다음 문단");

    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.content?.[0]?.text).toBe("첫 줄 이어지는 줄");
  });

  it("표는 아직 변환하지 않고 원문으로 남긴다", () => {
    const nodes = markdownToTiptapContent("| a | b |\n| --- | --- |\n| 1 | 2 |");

    expect(nodes.every((node) => node.type === "paragraph")).toBe(true);
  });
});

describe("markdownToTiptapContent — 목록", () => {
  it("글머리 목록과 번호 목록을 가른다", () => {
    const nodes = markdownToTiptapContent("- 하나\n- 둘\n\n1. 첫째\n2. 둘째");

    expect(nodes.map((node) => node.type)).toEqual(["bulletList", "orderedList"]);
    expect(nodes[0]?.content).toHaveLength(2);
  });

  it("중첩 목록을 자식으로 넣는다 — AI가 준 마크다운은 거의 항상 중첩된다", () => {
    const [list] = markdownToTiptapContent("- 상위\n  - 하위 1\n  - 하위 2\n- 다음 상위");

    expect(list?.content).toHaveLength(2);
    const nested = list?.content?.[0]?.content?.[1];
    expect(nested?.type).toBe("bulletList");
    expect(nested?.content).toHaveLength(2);
  });

  it("목록 항목의 인라인 서식도 살린다", () => {
    const [list] = markdownToTiptapContent("- `npm run build`로 확인");

    expect(list?.content?.[0]?.content?.[0]?.content?.[0]).toEqual({
      type: "text",
      text: "npm run build",
      marks: [{ type: "code" }],
    });
  });
});

describe("markdownToTiptapContent — 실제 붙여넣기 꼴", () => {
  it("AI가 준 문서 하나를 통째로 읽는다", () => {
    const pasted = [
      "## 캐시 무효화 정리",
      "",
      "Next 16은 무효화를 두 갈래로 나눴다.",
      "",
      "- `revalidateTag(tag, profile)` — stale-while-revalidate",
      "- `updateTag(tag)` — 즉시 만료",
      "  - Server Action 전용",
      "",
      "```ts",
      'revalidateTag("post:1", "max");',
      "```",
      "",
      "> 발행 직후에는 즉시 만료가 필요하다.",
    ].join("\n");

    const nodes = markdownToTiptapContent(pasted);

    expect(nodes.map((node) => node.type)).toEqual([
      "heading",
      "paragraph",
      "bulletList",
      "codeBlock",
      "blockquote",
    ]);
  });

  it("빈 입력은 빈 배열이다", () => {
    expect(markdownToTiptapContent("")).toEqual([]);
    expect(markdownToTiptapContent("\n\n  \n")).toEqual([]);
  });
});
