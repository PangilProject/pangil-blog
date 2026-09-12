import type { Editor } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
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
    axis === "row"
      ? cellPosition(table, tablePos, index, 0)
      : cellPosition(table, tablePos, 0, index);
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

/**
 * 칸을 합친 표인가.
 *
 * 합친 칸이 있으면 **순서를 바꾸지 않는다.** 3행짜리 칸을 한 줄만 옮기면 그 칸이 무엇을
 * 덮어야 하는지 답이 없다 — 조용히 표를 망가뜨리느니 못 한다고 말하는 편이 낫다.
 */
export function hasMergedCells(table: ProseMirrorNode): boolean {
  for (let rowIndex = 0; rowIndex < table.childCount; rowIndex += 1) {
    const row = table.child(rowIndex);

    for (let cellIndex = 0; cellIndex < row.childCount; cellIndex += 1) {
      const { colspan, rowspan } = row.child(cellIndex).attrs;
      if ((colspan ?? 1) > 1 || (rowspan ?? 1) > 1) return true;
    }
  }

  return false;
}

/** 배열에서 하나를 빼서 다른 자리에 꽂는다 */
function moved<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [picked] = next.splice(from, 1);
  if (picked === undefined) return items;

  next.splice(to, 0, picked);
  return next;
}

/**
 * 행·열의 자리를 바꾼다.
 *
 * 자리 셈을 하지 않고 **표의 내용을 다시 짜서 통째로 갈아끼운다.** 옮기는 동안 앞자리가
 * 바뀌면 뒷자리가 밀리는데, 그 셈을 손으로 하면 한 번 틀렸을 때 표가 깨진 채로 저장된다.
 * 되돌리기도 한 걸음이 된다.
 */
export function moveAxis(
  editor: Editor,
  table: ProseMirrorNode,
  tablePos: number,
  axis: Axis,
  from: number,
  to: number,
): boolean {
  if (from === to || hasMergedCells(table)) return false;

  const rows: ProseMirrorNode[] = [];
  for (let index = 0; index < table.childCount; index += 1) rows.push(table.child(index));

  let next: ProseMirrorNode[];

  if (axis === "row") {
    if (to < 0 || to >= rows.length) return false;
    next = moved(rows, from, to);
  } else {
    const width = rows[0]?.childCount ?? 0;
    if (to < 0 || to >= width) return false;

    next = rows.map((row) => {
      const cells: ProseMirrorNode[] = [];
      for (let index = 0; index < row.childCount; index += 1) cells.push(row.child(index));

      return row.copy(Fragment.fromArray(moved(cells, from, to)));
    });
  }

  const { state, view } = editor;
  view.dispatch(
    state.tr.replaceWith(tablePos + 1, tablePos + 1 + table.content.size, Fragment.fromArray(next)),
  );
  editor.commands.focus();
  return true;
}
