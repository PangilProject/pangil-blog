import { getSchema } from "@tiptap/core";
import { TableKit } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";

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
