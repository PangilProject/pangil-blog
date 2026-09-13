"use client";

import type { Editor } from "@tiptap/react";

import { useEditorFocus } from "@/components/editor/EditorFocusContext";
import {
  type BlockStyle,
  EditorToolbar,
  type EditorToolbarVariant,
  type TableCommand,
  type ToolbarCommand,
} from "@/components/editor/EditorToolbar";

/**
 * M1의 표현용 툴바를 포커스된 Tiptap 인스턴스에 연결한다(ADR-001).
 *
 * 툴바는 커서가 놓인 블록의 스타일을 표시하고(양방향 반영), 선택하면 그 자리에서 변환한다.
 * 화면을 떠다니지 않으며, 미리보기 창을 열지 않는다.
 */

function currentBlockStyle(editor: Editor): BlockStyle {
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  if (editor.isActive("blockquote")) return "blockquote";
  if (editor.isActive("codeBlock")) return "pre";
  return "p";
}

function activeCommands(editor: Editor): ToolbarCommand[] {
  const commands: ToolbarCommand[] = [];
  if (editor.isActive("bold")) commands.push("bold");
  if (editor.isActive("italic")) commands.push("italic");
  if (editor.isActive("underline")) commands.push("underline");
  if (editor.isActive("bulletList")) commands.push("bulletList");
  if (editor.isActive("orderedList")) commands.push("orderedList");
  if (editor.isActive("blockquote")) commands.push("blockquote");
  return commands;
}

function applyBlockStyle(editor: Editor, style: BlockStyle) {
  const chain = editor.chain().focus();

  switch (style) {
    case "h2":
      chain.setNode("heading", { level: 2 }).run();
      break;
    case "h3":
      chain.setNode("heading", { level: 3 }).run();
      break;
    case "blockquote":
      chain.setBlockquote().run();
      break;
    case "pre":
      chain.setCodeBlock().run();
      break;
    default:
      chain.setParagraph().run();
  }
}

function applyCommand(editor: Editor, command: ToolbarCommand) {
  const chain = editor.chain().focus();

  switch (command) {
    case "bold":
      chain.toggleBold().run();
      break;
    case "italic":
      chain.toggleItalic().run();
      break;
    case "underline":
      // StarterKit에 underline이 없으면 조용히 무시된다 — 툴바가 죽지는 않는다
      chain.toggleMark("underline").run();
      break;
    case "bulletList":
      chain.toggleBulletList().run();
      break;
    case "orderedList":
      chain.toggleOrderedList().run();
      break;
    case "blockquote":
      chain.toggleBlockquote().run();
      break;
    case "horizontalRule":
      chain.setHorizontalRule().run();
      break;
  }
}

/**
 * 표에 하는 일. **행·열은 여기 없다** — 표 위의 손잡이가 맡는다(`TableNodeView`).
 * 툴바에 두면 "커서가 어쩌다 놓인 행"이 지워지고, 어느 행인지 버튼만 봐서는 알 수 없다.
 */
function applyTableCommand(editor: Editor, command: TableCommand) {
  const chain = editor.chain().focus();

  switch (command) {
    case "toggleHeaderRow":
      chain.toggleHeaderRow().run();
      break;
    case "mergeCells":
      chain.mergeCells().run();
      break;
    case "splitCell":
      chain.splitCell().run();
      break;
    case "deleteTable":
      chain.deleteTable().run();
      break;
  }
}

/**
 * 표에 지금 할 수 있는 일. **없으면 묻지도 않는다.**
 *
 * 표 확장은 full 구성에만 붙는다(RichTextField). slim 편집기(설교·찬양)의 `can()`에는
 * `mergeCells` 자체가 없어서, 있는지 보지 않고 부르면 렌더 도중에 터지고 — 렌더라서
 * 툴바만 죽는 게 아니라 페이지가 통째로 error boundary로 넘어간다. 실제로 찬양 글을
 * 열고 묵상 칸에 커서를 넣는 순간 그렇게 됐다.
 *
 * variant로 가르지 않는 이유: 표 줄을 그리는 조건(variant)과 표 명령이 있는 조건(확장)은
 * 지금 우연히 같을 뿐 다른 것이다. 있는 것을 보고 판단한다.
 */
function tableAvailability(
  editor: Editor | null,
): Partial<Record<TableCommand, boolean>> | undefined {
  if (!editor || typeof editor.can().mergeCells !== "function") return undefined;

  // 병합은 칸을 여럿 골랐을 때만, 나누기는 합쳐진 칸에서만 된다
  return {
    mergeCells: editor.can().mergeCells(),
    splitCell: editor.can().splitCell(),
  };
}

export function ConnectedEditorToolbar({
  variant = "full",
  hint,
}: {
  variant?: EditorToolbarVariant;
  hint?: string;
}) {
  // version은 커서 이동·트랜잭션마다 올라간다. 이 값을 읽어야 툴바가 현재 블록을 따라간다
  const { editor, version } = useEditorFocus();
  void version;

  return (
    <EditorToolbar
      variant={variant}
      hint={hint}
      blockStyle={editor ? currentBlockStyle(editor) : "p"}
      activeCommands={editor ? activeCommands(editor) : []}
      onBlockStyleChange={(style) => editor && applyBlockStyle(editor, style)}
      onCommand={(command) => editor && applyCommand(editor, command)}
      inTable={editor?.isActive("table") ?? false}
      onInsertTable={(rows, cols) =>
        editor
          ?.chain()
          .focus()
          // 머리 줄은 늘 붙인다 — 표의 첫 줄이 이름인 경우가 대부분이고, 아니면 지우면 된다
          .insertTable({ rows, cols, withHeaderRow: true })
          .run()
      }
      onTableCommand={(command) => editor && applyTableCommand(editor, command)}
      canTable={tableAvailability(editor)}
    />
  );
}
