import { describe, expect, it } from "vitest";

import type { TiptapDoc } from "@/lib/content/schema";
import { markdownToTiptapContent } from "@/lib/editor/markdown";
import { tiptapToMarkdown } from "@/lib/render/markdown";

/**
 * export의 목적은 **언제든 이 블로그를 떠날 수 있다는 사실**이다(07 §3). 그래서 여기서 고정할
 * 것은 조판의 완벽한 왕복이 아니라 **내용을 하나도 잃지 않는다**는 쪽이다.
 */
const doc = (...nodes: unknown[]) => ({ type: "doc", content: nodes }) as TiptapDoc;
const text = (value: string) => ({ type: "text", text: value });

describe("tiptapToMarkdown", () => {
  it("문단·제목·인용·구분선을 되돌린다", () => {
    const md = tiptapToMarkdown(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [text("큰 제목")] },
        { type: "heading", attrs: { level: 3 }, content: [text("작은 제목")] },
        { type: "paragraph", content: [text("본문")] },
        { type: "blockquote", content: [{ type: "paragraph", content: [text("인용")] }] },
        { type: "horizontalRule" },
      ),
    );

    expect(md).toBe("# 큰 제목\n\n## 작은 제목\n\n본문\n\n> 인용\n\n---");
  });

  it("코드 블록은 언어와 줄바꿈을 지킨다", () => {
    expect(
      tiptapToMarkdown(
        doc({
          type: "codeBlock",
          attrs: { language: "ts" },
          content: [text("const a = 1;\nconst b = 2;")],
        }),
      ),
    ).toBe("```ts\nconst a = 1;\nconst b = 2;\n```");
  });

  it("인라인 서식과 링크를 되돌린다", () => {
    const md = tiptapToMarkdown(
      doc({
        type: "paragraph",
        content: [
          { type: "text", text: "굵게", marks: [{ type: "bold" }] },
          text(" "),
          { type: "text", text: "코드", marks: [{ type: "code" }] },
          text(" "),
          {
            type: "text",
            text: "문서",
            marks: [{ type: "link", attrs: { href: "https://e.com" } }],
          },
        ],
      }),
    );

    expect(md).toBe("**굵게** `코드` [문서](https://e.com)");
  });

  it("중첩 목록을 들여쓴다", () => {
    const md = tiptapToMarkdown(
      doc({
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [text("상위")] },
              {
                type: "bulletList",
                content: [
                  { type: "listItem", content: [{ type: "paragraph", content: [text("하위")] }] },
                ],
              },
            ],
          },
        ],
      }),
    );

    expect(md).toBe("- 상위\n  - 하위");
  });

  it("마크다운 문자를 글자로 남긴다 — 내보낸 파일이 다시 서식이 되면 안 된다", () => {
    expect(tiptapToMarkdown(doc({ type: "paragraph", content: [text("2 * 3 과 _x_")] }))).toBe(
      "2 \\* 3 과 \\_x\\_",
    );
  });

  it("모르는 노드도 글자는 남긴다", () => {
    expect(
      tiptapToMarkdown(
        doc({ type: "table", content: [{ type: "tableRow", content: [text("셀")] }] }),
      ),
    ).toBe("셀");
  });

  it("빈 문서는 빈 문자열이다", () => {
    expect(tiptapToMarkdown(null)).toBe("");
    expect(tiptapToMarkdown(doc())).toBe("");
  });
});

describe("붙여넣기 파서와의 왕복", () => {
  it("마크다운 → Tiptap → 마크다운이 내용을 잃지 않는다", () => {
    const source = [
      "## 캐시 정리",
      "",
      "Next 16은 두 갈래다.",
      "",
      "- `revalidateTag` — 낡은 것을 먼저",
      "- `updateTag` — 즉시 만료",
      "",
      "```ts",
      'updateTag("post:1");',
      "```",
    ].join("\n");

    const roundTripped = tiptapToMarkdown({
      type: "doc",
      content: markdownToTiptapContent(source),
    } as TiptapDoc);

    for (const fragment of [
      "캐시 정리",
      "Next 16은 두 갈래다",
      "revalidateTag",
      "updateTag",
      'updateTag("post:1");',
    ]) {
      expect(roundTripped).toContain(fragment);
    }
  });
});
