import { Editor } from "@tiptap/core";
import { CodeBlock } from "@tiptap/extension-code-block";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CodeHighlight } from "@/lib/editor/codeHighlight";

/**
 * 에디터 안에서 색이 입는지, 그리고 **토큰화가 끝나기 전에 에디터가 사라져도 터지지 않는지**를
 * 고정한다. 후자가 기성 확장을 쓰지 않은 이유다(파괴된 뷰에 dispatch → mismatched transaction).
 */
let editor: Editor | null = null;

function open(html: string) {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit.configure({ codeBlock: false }), CodeBlock, CodeHighlight],
    content: html,
  });
  return editor;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("CodeHighlight", () => {
  it("코드에 색이 입는다 — 쓰는 자리에서 보인다(ADR-001)", async () => {
    const instance = open('<pre><code class="language-ts">const a = 1;</code></pre>');

    await settle();

    const colored = instance.view.dom.querySelectorAll('span[style*="color"]');
    expect(colored.length).toBeGreaterThan(0);
  });

  it("언어를 모르면 색을 입히지 않는다 — 코드는 그대로 보인다", async () => {
    const instance = open("<pre><code>그냥 글자</code></pre>");

    await settle();

    expect(instance.view.dom.querySelectorAll('span[style*="color"]')).toHaveLength(0);
    expect(instance.view.dom.textContent).toContain("그냥 글자");
  });

  it("토큰화 중에 에디터를 파괴해도 터지지 않는다", async () => {
    const onRejection = vi.fn();
    window.addEventListener("unhandledrejection", onRejection);

    const instance = open('<pre><code class="language-tsx">const b = <div />;</code></pre>');
    instance.destroy();
    editor = null;

    await settle();

    expect(onRejection).not.toHaveBeenCalled();
    window.removeEventListener("unhandledrejection", onRejection);
  });
});
