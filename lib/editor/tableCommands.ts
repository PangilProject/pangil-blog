import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { CellSelection } from "@tiptap/pm/tables";

import { cellPosition } from "@/lib/editor/tableGeometry";

/**
 * 행·열 단위 조작 (02 §5.5).
 *
 * **먼저 그 행·열을 고르고 나서 명령을 부른다.** ProseMirror의 표 명령은 선택을 보고
 * 움직이므로, 칸 하나만 골라 두면 `색`이 그 칸에만 칠해진다 — 손잡이가 가리킨 것은 줄 전체다.
 * `CellSelection`이 줄 전체를 고르는 선택이고, 고른 칸에 `.selectedCell`이 붙어 화면에도
 * 무엇이 대상인지 드러난다.
 *
 * 복제·비우기는 Tiptap에 명령이 없어 트랜잭션을 직접 짠다. 뒤에서 앞으로 훑는 것은
 * 앞자리를 고치면 뒷자리가 밀리기 때문이다.
 */

export type Axis = "row" | "column";

/** 손잡이가 가리킨 줄 전체를 고른다. 못 고르면 아무 일도 하지 않는다 */
function selectAxis(
  editor: Editor,
  table: ProseMirrorNode,
  tablePos: number,
  axis: Axis,
  index: number,
): boolean {
  const anchor =
    axis === "row" ? cellPosition(table, tablePos, index, 0) : cellPosition(table, tablePos, 0, index);
  if (anchor === null) return false;

  const { state, view } = editor;
  // 칸 **안쪽**을 셌으므로 칸 자신의 자리는 한 칸 앞이다
  const $anchor = state.doc.resolve(anchor - 1);
  const selection =
    axis === "row" ? CellSelection.rowSelection($anchor) : CellSelection.colSelection($anchor);

  view.dispatch(state.tr.setSelection(selection));
  return true;
}

/** 그 줄의 칸들 — 문서 자리와 함께. 뒤에서 앞으로 돌려준다 */
function cellsOf(
  table: ProseMirrorNode,
  tablePos: number,
  axis: Axis,
  index: number,
): { pos: number; node: ProseMirrorNode }[] {
  const found: { pos: number; node: ProseMirrorNode }[] = [];

  const push = (rowIndex: number, columnIndex: number) => {
    const inside = cellPosition(table, tablePos, rowIndex, columnIndex);
    if (inside === null) return;

    const row = table.child(rowIndex);
    const cell = row.child(columnIndex);
    found.push({ pos: inside - 1, node: cell });
  };

  if (axis === "row") {
    const row = table.child(index);
    for (let column = 0; column < row.childCount; column += 1) push(index, column);
  } else {
    for (let rowIndex = 0; rowIndex < table.childCount; rowIndex += 1) push(rowIndex, index);
  }

  return found.reverse();
}

export function selectAndRun(
  editor: Editor,
  table: ProseMirrorNode,
  tablePos: number,
  axis: Axis,
  index: number,
  run: (chain: ReturnType<Editor["chain"]>) => void,
): void {
  if (!selectAxis(editor, table, tablePos, axis, index)) return;
  run(editor.chain().focus());
}

/**
 * 줄 하나를 그대로 한 벌 더 놓는다.
 *
 * 행은 줄 노드를 통째로 복사하면 되고, 열은 줄마다 칸 하나씩 끼워야 한다 — 뒤에서 앞으로
 * 끼운다. 앞자리에 먼저 끼우면 뒷자리 셈이 어긋난다.
 */
export function duplicateAxis(
  editor: Editor,
  table: ProseMirrorNode,
  tablePos: number,
  axis: Axis,
  index: number,
): void {
  const { state, view } = editor;
  const tr = state.tr;

  if (axis === "row") {
    let pos = tablePos + 1;
    for (let rowIndex = 0; rowIndex < index; rowIndex += 1) pos += table.child(rowIndex).nodeSize;

    const row = table.child(index);
    tr.insert(pos + row.nodeSize, row);
  } else {
    for (const { pos, node } of cellsOf(table, tablePos, axis, index)) {
      tr.insert(pos + node.nodeSize, node);
    }
  }

  view.dispatch(tr);
  editor.commands.focus();
}

/** 줄은 남기고 글자만 비운다. 표를 지우지 않고 다시 채우고 싶을 때다 */
export function clearAxis(
  editor: Editor,
  table: ProseMirrorNode,
  tablePos: number,
  axis: Axis,
  index: number,
): void {
  const { state, view } = editor;
  const tr = state.tr;
  const empty = state.schema.nodes.paragraph?.create();
  if (!empty) return;

  for (const { pos, node } of cellsOf(table, tablePos, axis, index)) {
    tr.replaceWith(pos + 1, pos + node.nodeSize - 1, empty);
  }

  view.dispatch(tr);
  editor.commands.focus();
}
