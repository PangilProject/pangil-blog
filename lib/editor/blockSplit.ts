import { Extension } from "@tiptap/core";

/**
 * 리치 텍스트 칸을 블록 목록의 한 칸으로 쓸 때의 키보드 계약 (찬양 묵상, 02 §5.4).
 *
 * 가사 섹션과 같은 규칙이다 — 손이 키보드를 떠나지 않아야 한다.
 * - 엔터 2회 → 다음 블록. 빈 문단 하나를 남기지 않고 그 자리를 새 블록으로 바꾼다
 * - 빈 블록에서 Backspace → 그 블록 삭제
 *
 * Enter를 가로채는 조건은 **문서 끝의 빈 문단**뿐이다. 글 중간에서 누른 Enter는 그냥
 * 문단 나누기여야 한다 — 묵상 안에서 문단을 나누는 일이 블록을 나누는 일보다 훨씬 잦다.
 *
 * 문단이 하나뿐일 때는 넘기지 않는다. 그 경우 첫 Enter가 곧 마지막 Enter가 되어,
 * 빈 블록에서 엔터를 한 번 눌렀을 뿐인데 블록이 늘어난다.
 */
export type BlockSplitOptions = {
  onSplit: () => void;
  onRemove: () => void;
};

export const BlockSplitOnDoubleEnter = Extension.create<BlockSplitOptions>({
  name: "blockSplitOnDoubleEnter",
  // StarterKit의 기본 Enter(문단 나누기)보다 먼저 봐야 한다
  priority: 1000,

  addOptions() {
    return { onSplit: () => {}, onRemove: () => {} };
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state } = this.editor;
        const { $from, empty } = state.selection;

        if (!empty) return false;
        if (state.doc.childCount < 2) return false;
        if ($from.parent.type.name !== "paragraph") return false;
        if ($from.parent.content.size > 0) return false;
        // 마지막 문단에서만. 글 중간의 빈 줄은 쓰는 사람이 일부러 둔 자리다
        if ($from.after() < state.doc.content.size) return false;

        this.editor.commands.deleteRange({ from: $from.before(), to: $from.after() });
        this.options.onSplit();
        return true;
      },

      Backspace: () => {
        if (!this.editor.isEmpty) return false;
        this.options.onRemove();
        return true;
      },
    };
  },
});
