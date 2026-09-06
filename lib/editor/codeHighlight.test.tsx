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

/**
 * **시간이 아니라 조건을 기다린다.**
 *
 * 전에는 150ms를 고정으로 재웠는데, 토큰화는 Shiki가 문법을 불러온 뒤에 끝난다 — 테스트
 * 파일 백 개가 동시에 도는 전체 실행에서는 그보다 늦는 날이 있었고, 그때 색이 아직 안 입은
 * 상태로 단언해서 **간헐적으로 빨개졌다.** 단독 실행과 CI는 통과해서 원인이 안 잡혔다.
 */
const colored = (instance: Editor) => instance.view.dom.querySelectorAll('span[style*="color"]');

const untilColored = (instance: Editor) =>
  vi.waitFor(() => expect(colored(instance).length).toBeGreaterThan(0), {
    timeout: 5000,
    interval: 25,
  });

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("CodeHighlight", () => {
  it("코드에 색이 입는다 — 쓰는 자리에서 보인다(ADR-001)", async () => {
    const instance = open('<pre><code class="language-ts">const a = 1;</code></pre>');

    await untilColored(instance);
  });

  /**
   * 두 블록을 한 문서에 넣는 이유는 **기다릴 신호를 만들기 위해서**다. 언어를 모르는 블록만
   * 두고 "색이 없다"를 단언하면, 토큰화가 아직 안 끝났을 때도 통과한다 — 아무것도 확인하지
   * 못한 채 초록인 테스트다. 아는 언어가 색을 입은 뒤에 물어야 그 답이 뜻을 가진다.
   */
  it("언어를 모르면 색을 입히지 않는다 — 코드는 그대로 보인다", async () => {
    const instance = open(
      '<pre><code class="language-ts">const a = 1;</code></pre>' +
        "<pre><code>그냥 글자</code></pre>",
    );

    await untilColored(instance);

    const blocks = instance.view.dom.querySelectorAll("pre");
    expect(blocks[1]?.querySelectorAll('span[style*="color"]')).toHaveLength(0);
    expect(blocks[1]?.textContent).toContain("그냥 글자");
  });

  it("토큰화 중에 에디터를 파괴해도 터지지 않는다", async () => {
    const onRejection = vi.fn();
    window.addEventListener("unhandledrejection", onRejection);

    const instance = open('<pre><code class="language-tsx">const b = <div />;</code></pre>');
    instance.destroy();
    editor = null;

    // 여기서는 기다릴 신호가 없다 — 확인하려는 것이 "아무 일도 일어나지 않음"이기 때문이다.
    // 토큰화가 끝나고도 남을 만큼 넉넉히 준다. 늦게 터지면 이 대기 밖이라 놓치지만,
    // 놓친 실패는 다음 실행에서 잡히고 여기서 빨개지는 것은 진짜 실패뿐이다
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(onRejection).not.toHaveBeenCalled();
    window.removeEventListener("unhandledrejection", onRejection);
  });
});
