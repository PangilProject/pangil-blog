import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/**
 * 표 안의 자리 계산 (02 §5.5 · ADR-001).
 *
 * 손잡이는 "이 행", "이 열"을 가리킨다. 그런데 ProseMirror 명령(`deleteRow` 등)은
 * **선택이 놓인 칸**을 보고 움직인다 — 그래서 손잡이를 누르면 먼저 그 칸으로 선택을
 * 옮겨야 한다. 그 자리를 여기서 센다.
 *
 * 순수 함수로 떼어 둔 이유: 자리 계산이 틀리면 **엉뚱한 행이 지워진다.** 화면 없이
 * 고정해 둘 수 있어야 한다.
 */

/** 표의 열 수. 첫 줄을 기준으로 본다 — 우리 표는 칸을 합치지 않는다 */
export function columnCount(table: ProseMirrorNode): number {
  return table.childCount === 0 ? 0 : (table.child(0)?.childCount ?? 0);
}

export function rowCount(table: ProseMirrorNode): number {
  return table.childCount;
}

/**
 * `rowIndex`행 `columnIndex`열 칸 **안쪽**의 문서 자리.
 *
 * `tablePos`는 표 노드 자신의 자리다(`getPos()`). 거기서 한 칸 들어가면 첫 줄이고,
 * 줄 안으로 한 칸 더 들어가면 첫 칸이다 — ProseMirror의 자리 셈이 그렇다.
 *
 * 범위 밖이면 `null`이다. 지우는 도중에 손잡이가 잠깐 남아 있을 수 있고, 그때 없는
 * 자리를 세어 엉뚱한 곳을 고치면 안 된다.
 */
export function cellPosition(
  table: ProseMirrorNode,
  tablePos: number,
  rowIndex: number,
  columnIndex: number,
): number | null {
  if (rowIndex < 0 || rowIndex >= table.childCount) return null;

  let pos = tablePos + 1;
  for (let index = 0; index < rowIndex; index += 1) {
    pos += table.child(index).nodeSize;
  }

  const row = table.child(rowIndex);
  if (columnIndex < 0 || columnIndex >= row.childCount) return null;

  pos += 1;
  for (let index = 0; index < columnIndex; index += 1) {
    pos += row.child(index).nodeSize;
  }

  return pos + 1;
}
