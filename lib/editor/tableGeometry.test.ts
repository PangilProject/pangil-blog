import { getSchema } from "@tiptap/core";
import { TableKit } from "@tiptap/extension-table";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";

import { hasMergedCells, moveAxis } from "@/lib/editor/tableCommands";
import { cellPosition, columnCount, rowCount } from "@/lib/editor/tableGeometry";

/**
 * **자리 계산이 틀리면 엉뚱한 행이 지워진다.** 손잡이는 "이 행"을 가리키는데 명령은
 * 선택이 놓인 칸을 보므로, 그 사이를 잇는 셈이 맞아야 한다.
 *
 * 화면 없이 고정한다 — 진짜 스키마로 문서를 짓고 자리만 본다.
 */
const schema = getSchema([StarterKit, TableKit]);

/** `rows × cols` 표 하나만 있는 문서. 칸에는 좌표를 적어 어느 칸인지 알아본다 */
function tableDoc(rows: number, cols: number) {
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [
      {
        type: "table",
        content: Array.from({ length: rows }, (_, row) => ({
          type: "tableRow",
          content: Array.from({ length: cols }, (_, col) => ({
            type: row === 0 ? "tableHeader" : "tableCell",
            content: [{ type: "paragraph", content: [{ type: "text", text: `${row}-${col}` }] }],
          })),
        })),
      },
    ],
  });

  // 표 노드 자신의 자리. 문서 맨 앞 블록이므로 0이다
  return { table: doc.child(0), tablePos: 0, doc };
}

describe("columnCount · rowCount", () => {
  it("첫 줄로 열 수를 센다", () => {
    const { table } = tableDoc(3, 4);

    expect(rowCount(table)).toBe(3);
    expect(columnCount(table)).toBe(4);
  });
});

describe("cellPosition — 가리킨 칸에 선택을 놓기 위한 자리", () => {
  it("센 자리가 실제로 그 칸 안이다", () => {
    const { table, tablePos, doc } = tableDoc(3, 3);

    for (const [row, col] of [
      [0, 0],
      [1, 2],
      [2, 1],
    ] as const) {
      const pos = cellPosition(table, tablePos, row, col);
      if (pos === null) throw new Error("자리를 못 찾았다");

      // 그 자리의 조상 중에 칸이 있고, 그 칸의 글자가 우리가 적어둔 좌표다
      expect(doc.resolve(pos).parent.textContent).toBe(`${row}-${col}`);
    }
  });

  it("범위 밖이면 null이다 — 없는 자리를 세어 엉뚱한 곳을 고치지 않는다", () => {
    const { table, tablePos } = tableDoc(2, 2);

    expect(cellPosition(table, tablePos, 2, 0)).toBeNull();
    expect(cellPosition(table, tablePos, 0, 2)).toBeNull();
    expect(cellPosition(table, tablePos, -1, 0)).toBeNull();
  });

  it("표가 문서 앞쪽에 밀려 있어도 맞는다 — tablePos를 더해 센다", () => {
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "앞 문단" }] },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "머리" }] }],
                },
              ],
            },
          ],
        },
      ],
    });

    const tablePos = doc.child(0).nodeSize;
    const pos = cellPosition(doc.child(1), tablePos, 0, 0);
    if (pos === null) throw new Error("자리를 못 찾았다");

    expect(doc.resolve(pos).parent.textContent).toBe("머리");
  });
});

describe("moveAxis — 손잡이를 끌어 자리 바꾸기", () => {
  /** 내용을 다시 짜서 통째로 갈아끼운다. 자리 셈을 손으로 하면 한 번 틀렸을 때 표가 깨진다 */
  function editorFor(rows: number, cols: number) {
    const { table, doc } = tableDoc(rows, cols);
    const dispatched: { doc: ProseMirrorNode }[] = [];

    const state = { doc, tr: EditorState.create({ doc }).tr };
    const editor = {
      state,
      view: { dispatch: (tr: { doc: ProseMirrorNode }) => dispatched.push(tr) },
      commands: { focus: () => true },
    } as unknown as Parameters<typeof moveAxis>[0];

    return { editor, table, dispatched };
  }

  it("행을 아래로 옮긴다", () => {
    const { editor, table, dispatched } = editorFor(3, 2);

    expect(moveAxis(editor, table, 0, "row", 0, 2)).toBe(true);

    const moved = dispatched[0]?.doc.child(0);
    expect(moved?.child(2).textContent).toBe("0-00-1");
    expect(moved?.child(0).textContent).toBe("1-01-1");
  });

  it("열을 오른쪽으로 옮긴다 — 모든 줄에서 같이 움직인다", () => {
    const { editor, table, dispatched } = editorFor(2, 3);

    expect(moveAxis(editor, table, 0, "column", 0, 2)).toBe(true);

    const moved = dispatched[0]?.doc.child(0);
    expect(moved?.child(0).child(2).textContent).toBe("0-0");
    expect(moved?.child(1).child(2).textContent).toBe("1-0");
  });

  it("제자리면 아무 일도 하지 않는다", () => {
    const { editor, table, dispatched } = editorFor(3, 2);

    expect(moveAxis(editor, table, 0, "row", 1, 1)).toBe(false);
    expect(dispatched).toHaveLength(0);
  });

  it("범위 밖으로는 못 옮긴다", () => {
    const { editor, table } = editorFor(3, 2);

    expect(moveAxis(editor, table, 0, "row", 0, 3)).toBe(false);
    expect(moveAxis(editor, table, 0, "column", 0, -1)).toBe(false);
  });
});

describe("hasMergedCells — 합친 표는 순서를 바꾸지 않는다", () => {
  /**
   * 3행짜리 칸을 한 줄만 옮기면 그 칸이 무엇을 덮어야 하는지 답이 없다.
   * 조용히 표를 망가뜨리느니 못 한다고 말하는 편이 낫다.
   */
  it("합친 칸이 없으면 거짓이다", () => {
    expect(hasMergedCells(tableDoc(2, 2).table)).toBe(false);
  });

  it("rowspan이 있으면 참이다", () => {
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  attrs: { rowspan: 2 },
                  content: [{ type: "paragraph" }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(hasMergedCells(doc.child(0))).toBe(true);
  });
});
