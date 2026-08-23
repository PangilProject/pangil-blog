"use client";

import type { Editor } from "@tiptap/react";

import { useEditorFocus } from "@/components/editor/EditorFocusContext";
import {
  type BlockStyle,
  EditorToolbar,
  type EditorToolbarVariant,
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
    case "blockquote":
      chain.toggleBlockquote().run();
      break;
    case "horizontalRule":
      chain.setHorizontalRule().run();
      break;
  }
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
    />
  );
}
