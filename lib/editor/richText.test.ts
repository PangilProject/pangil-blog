import { describe, expect, it } from "vitest";

import { EMPTY_TIPTAP_DOC, type TiptapDoc } from "@/lib/content/schema";
import { isEmptyDoc, type RichTextValue, toTiptapDoc } from "@/lib/editor/richText";

const doc = (text: string): TiptapDoc => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

describe("isEmptyDoc", () => {
  it("빈 문서와 빈 문단은 비어 있다", () => {
    expect(isEmptyDoc(EMPTY_TIPTAP_DOC)).toBe(true);
    expect(isEmptyDoc({ type: "doc", content: [{ type: "paragraph" }] })).toBe(true);
    expect(isEmptyDoc(null)).toBe(true);
  });

  it("글자가 있으면 비어 있지 않다", () => {
    expect(isEmptyDoc(doc("한 줄"))).toBe(false);
  });
});

describe("toTiptapDoc — Json 경계 (ADR-002)", () => {
  /**
   * ProseMirror는 attrs를 Object.create(null)로 만든다. 그 객체는 Server Action 직렬화를
   *통과하지 못해 서버에서 함수로 도착하고 z.json()이 거부한다 — 제목이나 코드 블록이 있는
   * 글의 저장이 전부 조용히 실패했던 실제 원인이다.
   */
  function withNullProtoAttrs(): RichTextValue {
    const attrs = Object.create(null) as { level: number };
    attrs.level = 2;

    return {
      type: "doc",
      content: [{ type: "heading", attrs, content: [{ type: "text", text: "제목" }] }],
    };
  }

  it("프로토타입 없는 attrs를 평범한 객체로 바꾼다", () => {
    const doc = toTiptapDoc(withNullProtoAttrs());
    const attrs = (doc.content[0] as { attrs: object }).attrs;

    expect(Object.getPrototypeOf(attrs)).toBe(Object.prototype);
  });

  it("내용은 그대로 남는다", () => {
    expect(toTiptapDoc(withNullProtoAttrs())).toEqual({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "제목" }] },
      ],
    });
  });

  it("z.json()을 통과하는 값만 남는다", () => {
    const value = { type: "doc", content: [{ type: "paragraph", attrs: { fn: () => 1 } }] };

    expect(toTiptapDoc(value as RichTextValue)).toEqual({
      type: "doc",
      content: [{ type: "paragraph", attrs: {} }],
    });
  });
});
