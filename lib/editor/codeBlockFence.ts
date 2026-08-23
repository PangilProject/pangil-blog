import { Extension } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

/**
 * ``` + Enter로 코드 블록 (02 §5.5 지원 블록 · ADR-001 마크다운 병행).
 *
 * Tiptap 기본 규칙은 입력 규칙(input rule)이라 **글자가 입력될 때만** 발동한다. 규칙이
 * "```lang + 공백/줄바꿈"을 요구하는데, 울타리를 치고 나서 사람이 누르는 건 Enter다.
 * Enter는 글자 입력이 아니라 입력 규칙이 아예 돌지 않는다 — 그래서 ```을 치고 Enter를 눌러도
 * 아무 일도 일어나지 않았다(실제로 그랬다: 코드가 문단 글자로 남아 그대로 저장됐다).
 *
 * `# `·`- `·`> `는 공백으로 끝나 기본 규칙이 잡는다. 울타리만 이렇게 따로 받는다.
 *
 * 문단을 코드 블록으로 **한 트랜잭션에** 갈아끼운다. 명령을 이어 붙이면(chain) 앞 명령이
 * 문서를 바꾼 뒤의 위치를 뒤 명령이 옛 좌표로 가리켜 범위 오류가 난다.
 */
const FENCE = /^(?:```|~~~)([\w+#-]*)$/;

export const CodeBlockFenceOnEnter = Extension.create({
  name: "codeBlockFenceOnEnter",
  // StarterKit의 기본 Enter(문단 나누기)보다 먼저 봐야 한다
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      Enter: () =>
        this.editor.commands.command(({ tr, state, dispatch }) => {
          const { $from, empty } = state.selection;
          if (!empty) return false;
          if ($from.parent.type.name !== "paragraph") return false;

          const match = FENCE.exec($from.parent.textContent.trim());
          if (!match) return false;

          // slim 구성에는 코드 블록이 없다 — 그때는 기본 Enter가 그대로 돈다
          const codeBlock = state.schema.nodes.codeBlock;
          if (!codeBlock) return false;

          if (dispatch) {
            const from = $from.before();
            const language = match[1];

            tr.replaceWith(from, $from.after(), codeBlock.create(language ? { language } : null));
            // 커서를 새 블록 안에 둔다 — 바로 코드를 이어 치는 흐름이다
            tr.setSelection(TextSelection.create(tr.doc, from + 1));
          }

          return true;
        }),
    };
  },
});
