import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";

import { HeadingWithShiftedShortcuts } from "@/lib/editor/headingShortcuts";

/** ProseMirror inputRules 플러그인이 보는 것과 같은 경로로 한 글자를 "타이핑"한다 */
function typeChar(editor: Editor, char: string) {
  const { view } = editor;
  const { from } = view.state.selection;
  const handled = view.someProp("handleTextInput", (f) =>
    // 마지막 인자는 "규칙이 만든 트랜잭션을 조회하는 함수"다. 여기서는 쓰지 않는다
    f(view, from, from, char, () => view.state.tr),
  );
  if (!handled) editor.commands.insertContent(char);
}

function typeText(editor: Editor, text: string) {
  for (const char of text) typeChar(editor, char);
}

/** RichTextField와 같은 확장 구성 */
function makeEditor(variant: "full" | "slim") {
  return new Editor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: variant === "slim" ? false : {} }),
      HeadingWithShiftedShortcuts.configure({ levels: variant === "slim" ? [3] : [2, 3] }),
    ],
    content: { type: "doc", content: [] },
  });
}

function firstNode(editor: Editor) {
  const json = editor.getJSON();
  return json.content?.[0];
}

describe("마크다운 단축 입력 (02 §5.3 · ADR-001)", () => {
  it("full에서 # 는 지면 최상위 제목(h2)이 된다 — 작성자는 늘 #부터 쓴다", () => {
    const editor = makeEditor("full");
    typeText(editor, "# 오케이");

    expect(firstNode(editor)?.type).toBe("heading");
    expect(firstNode(editor)?.attrs?.level).toBe(2);
    editor.destroy();
  });

  it("full에서 ## 는 그 아래 제목(h3)이 된다", () => {
    const editor = makeEditor("full");
    typeText(editor, "## 오케이");

    expect(firstNode(editor)?.attrs?.level).toBe(3);
    editor.destroy();
  });

  it("slim(설교)에서 # 는 하나뿐인 소제목(h3)이 된다", () => {
    const editor = makeEditor("slim");
    typeText(editor, "# 오케이");

    expect(firstNode(editor)?.type).toBe("heading");
    expect(firstNode(editor)?.attrs?.level).toBe(3);
    editor.destroy();
  });

  it("- 는 목록이 된다", () => {
    const editor = makeEditor("slim");
    typeText(editor, "- 오케이");

    expect(firstNode(editor)?.type).toBe("bulletList");
    editor.destroy();
  });

  it("> 는 인용이 된다", () => {
    const editor = makeEditor("slim");
    typeText(editor, "> 오케이");

    expect(firstNode(editor)?.type).toBe("blockquote");
    editor.destroy();
  });

  it("본문 중간의 #은 변환하지 않는다 — 문단 시작에서만 서식이다", () => {
    const editor = makeEditor("full");
    typeText(editor, "설교 중 # 오케이");

    expect(firstNode(editor)?.type).toBe("paragraph");
    editor.destroy();
  });
});
