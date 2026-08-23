import { describe, expect, it } from "vitest";

import { EMPTY_TIPTAP_DOC, type TiptapDoc } from "@/lib/content/schema";
import { isEmptyDoc } from "@/lib/editor/richText";

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
