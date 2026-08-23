import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";

import { CodeBlockFenceOnEnter } from "@/lib/editor/codeBlockFence";

/**
 * ```을 치고 Enter를 누르면 코드 블록이 되는지 (02 §5.5).
 *
 * Tiptap 기본 입력 규칙은 글자가 입력될 때만 돌기 때문에 Enter로는 발동하지 않는다 —
 * 실제로 코드가 문단 글자로 남아 그대로 저장됐다(브라우저 검증에서 나온 증상).
 */
let editor: Editor | null = null;

function open(html: string) {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit, CodeBlockFenceOnEnter],
    content: html,
  });
  editor.commands.focus("end");
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("코드 울타리 + Enter", () => {
  it("```을 치고 Enter를 누르면 코드 블록이 된다", () => {
    const instance = open("<p>```</p>");

    instance.commands.keyboardShortcut("Enter");

    expect(instance.getJSON().content?.[0]).toMatchObject({ type: "codeBlock" });
  });

  it("언어를 적었으면 함께 싣는다", () => {
    const instance = open("<p>```ts</p>");

    instance.commands.keyboardShortcut("Enter");

    expect(instance.getJSON().content?.[0]).toMatchObject({
      type: "codeBlock",
      attrs: { language: "ts" },
    });
  });

  it("~~~도 울타리다", () => {
    const instance = open("<p>~~~py</p>");

    instance.commands.keyboardShortcut("Enter");

    expect(instance.getJSON().content?.[0]).toMatchObject({
      type: "codeBlock",
      attrs: { language: "py" },
    });
  });

  it("보통 문단에서는 Enter를 가로채지 않는다", () => {
    const instance = open("<p>그냥 문단</p>");

    instance.commands.keyboardShortcut("Enter");

    expect(instance.getJSON().content?.[0]).toMatchObject({ type: "paragraph" });
    expect(instance.getJSON().content).toHaveLength(2);
  });

  it("코드 블록 안의 Enter는 줄바꿈이다 — 블록을 또 만들지 않는다", () => {
    const instance = open("<pre><code>const a = 1;</code></pre>");

    instance.commands.keyboardShortcut("Enter");

    const blocks = instance.getJSON().content?.filter((node) => node.type === "codeBlock");
    expect(blocks).toHaveLength(1);
    // 가로채지 않았으므로 기본 동작(코드 안 줄바꿈)이 그대로 일어난다
    expect(instance.getText()).toContain("const a = 1;\n");
  });
});
