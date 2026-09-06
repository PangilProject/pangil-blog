import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BlockSplitOnDoubleEnter } from "@/lib/editor/blockSplit";

/**
 * 리치 텍스트 칸을 블록 목록의 한 칸으로 쓸 때의 키보드 계약 (찬양 묵상, 02 §5.4).
 * 손이 키보드를 떠나지 않아야 하고, **글 중간의 엔터는 그냥 문단 나누기여야** 한다.
 */
let editor: Editor | null = null;

function open(html: string, handlers: { onSplit?: () => void; onRemove?: () => void } = {}) {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: [
      StarterKit,
      BlockSplitOnDoubleEnter.configure({
        onSplit: handlers.onSplit ?? (() => {}),
        onRemove: handlers.onRemove ?? (() => {}),
      }),
    ],
    content: html,
  });
  return editor;
}

const enter = (instance: Editor) => instance.commands.keyboardShortcut("Enter");

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("BlockSplitOnDoubleEnter", () => {
  it("엔터 두 번이면 다음 블록으로 넘긴다", () => {
    const onSplit = vi.fn();
    const instance = open("<p>가사 묵상</p>", { onSplit });
    instance.commands.focus("end");

    enter(instance);
    expect(onSplit).not.toHaveBeenCalled();

    enter(instance);
    expect(onSplit).toHaveBeenCalledTimes(1);
  });

  /** 빈 문단 하나를 남기지 않는다 — 그 자리를 새 블록으로 바꾼다 */
  it("넘길 때 빈 문단을 남기지 않는다", () => {
    const instance = open("<p>가사 묵상</p>");
    instance.commands.focus("end");

    enter(instance);
    expect(instance.state.doc.childCount).toBe(2);

    enter(instance);
    expect(instance.state.doc.childCount).toBe(1);
  });

  /**
   * 묵상 안에서 문단을 나누는 일이 블록을 나누는 일보다 훨씬 잦다. 글 중간에서 누른 엔터가
   * 블록을 넘기면 쓰던 글이 두 칸으로 찢어진다.
   */
  it("글 중간의 엔터는 문단 나누기다", () => {
    const onSplit = vi.fn();
    const instance = open("<p>첫 문단</p><p>둘째 문단</p>", { onSplit });
    instance.commands.focus(4);

    enter(instance);

    expect(onSplit).not.toHaveBeenCalled();
    expect(instance.state.doc.childCount).toBe(3);
  });

  /** 문단이 하나뿐일 때 넘기면, 빈 블록에서 엔터를 한 번 눌렀을 뿐인데 블록이 늘어난다 */
  it("문단이 하나면 넘기지 않는다", () => {
    const onSplit = vi.fn();
    const instance = open("<p></p>", { onSplit });
    instance.commands.focus("end");

    enter(instance);

    expect(onSplit).not.toHaveBeenCalled();
  });

  it("빈 블록에서 Backspace는 그 블록을 지운다", () => {
    const onRemove = vi.fn();
    const instance = open("<p></p>", { onRemove });
    instance.commands.focus("end");

    instance.commands.keyboardShortcut("Backspace");

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("글이 있으면 Backspace는 글자를 지운다", () => {
    const onRemove = vi.fn();
    const instance = open("<p>가</p>", { onRemove });
    instance.commands.focus("end");

    instance.commands.keyboardShortcut("Backspace");

    expect(onRemove).not.toHaveBeenCalled();
  });
});
