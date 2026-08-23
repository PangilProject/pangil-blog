import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

import { looksLikeMarkdown, markdownToTiptapContent } from "@/lib/editor/markdown";

/**
 * 마크다운 붙여넣기 → 커서 자리에 즉시 서식 (02 §5.5 · ADR-001).
 *
 * 별도 미리보기도, 변환 버튼도 없다. 붙여넣는 순간 그 자리에 서식이 된다.
 *
 * 개입하지 않는 두 경우:
 * 1. 클립보드에 HTML이 함께 있으면 — 그건 이미 서식이 있는 복사다. Tiptap의 기본 경로가
 *    우리 파서보다 잘한다(웹페이지·문서에서 복사한 경우)
 * 2. 마크다운 신호가 없으면 — 평범한 글에서 별표를 서식으로 바꾸면 붙여넣기가 무서워진다
 */
export const MarkdownPaste = Extension.create({
  name: "markdownPaste",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        props: {
          handlePaste: (_view, event) => {
            const clipboard = event.clipboardData;
            if (!clipboard) return false;

            const html = clipboard.getData("text/html");
            if (html.trim() !== "") return false;

            const text = clipboard.getData("text/plain");
            if (text.trim() === "" || !looksLikeMarkdown(text)) return false;

            const content = markdownToTiptapContent(text);
            if (content.length === 0) return false;

            event.preventDefault();
            editor.commands.insertContent(content);
            return true;
          },
        },
      }),
    ];
  },
});
