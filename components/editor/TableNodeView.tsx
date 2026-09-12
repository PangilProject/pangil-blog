"use client";

import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cellPosition, columnCount, rowCount } from "@/lib/editor/tableGeometry";
import { cn } from "@/lib/utils";

/**
 * 표 손잡이 (02 §5.5).
 *
 * **조작 대상이 화면에 있어야 한다.** 툴바에 `열 삭제`를 두면 "커서가 어쩌다 놓인 열"이
 * 지워진다 — 어느 열이 지워질지 버튼만 봐서는 알 수 없다. 그래서 손잡이를 그 행·열 위에
 * 놓는다. 누른 자리가 곧 대상이다.
 *
 * ADR-001 §5는 팝업을 금한다. 그 조항의 근거는 **설교 에디터의 "방해 요소 제로"**이고,
 * 표는 `full`(기술·큐티)에만 있어 설교 화면에는 아예 없다 — 금지의 목적은 지켜진다.
 * 대신 두 가지를 지킨다: 손잡이는 **표에 손을 올렸을 때만** 나타나고, 메뉴는 **누른
 * 손잡이 옆**에만 선다(떠다니며 따라오지 않는다).
 *
 * 자리 계산은 `lib/editor/tableGeometry`가 한다 — 틀리면 엉뚱한 행이 지워지므로
 * 화면 없이 고정해 둘 수 있어야 한다.
 */

/**
 * `NodeViewContent`의 `as`가 좁게 선언돼 있다. 표의 내용은 줄이므로 `tbody`여야 하고,
 * 그 밖의 태그를 넣으면 ProseMirror가 표를 못 그린다.
 */
const TableBody = NodeViewContent as unknown as React.FC<{ as: "tbody" }>;

type Axis = "row" | "column";
type Target = { axis: Axis; index: number; offset: number };

const MENU_ITEMS: Record<Axis, { command: TableAction; label: string }[]> = {
  row: [
    { command: "addBefore", label: "위에 삽입" },
    { command: "addAfter", label: "아래에 삽입" },
    { command: "delete", label: "삭제" },
  ],
  column: [
    { command: "addBefore", label: "왼쪽에 삽입" },
    { command: "addAfter", label: "오른쪽에 삽입" },
    { command: "delete", label: "삭제" },
  ],
};

type TableAction = "addBefore" | "addAfter" | "delete";

/** 손잡이가 놓일 자리. 표의 실제 칸을 재서 얻는다 — 칸 너비를 짐작하지 않는다 */
type Offsets = {
  rows: { start: number; size: number }[];
  columns: { start: number; size: number }[];
};

export function TableNodeView({ editor, node, getPos }: NodeViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [offsets, setOffsets] = useState<Offsets>({ rows: [], columns: [] });
  const [target, setTarget] = useState<Target | null>(null);

  const measure = useCallback(() => {
    const table = wrapperRef.current?.querySelector("table");
    if (!table) return;

    const base = table.getBoundingClientRect();
    const rows = Array.from(table.rows).map((row) => {
      const rect = row.getBoundingClientRect();
      return { start: rect.top - base.top, size: rect.height };
    });
    const columns = Array.from(table.rows[0]?.cells ?? []).map((cell) => {
      const rect = cell.getBoundingClientRect();
      return { start: rect.left - base.left, size: rect.width };
    });

    setOffsets({ rows, columns });
  }, []);

  // 글자를 치면 칸 높이가 바뀐다. 재는 것을 한 번으로 끝내면 손잡이가 어긋난 자리에 남는다
  useEffect(() => {
    measure();

    const table = wrapperRef.current?.querySelector("table");
    if (!table || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);
    observer.observe(table);
    return () => observer.disconnect();
  }, [measure]);

  // 표가 늘거나 줄면 손잡이 수도 따라간다
  // biome-ignore lint/correctness/useExhaustiveDependencies: 노드가 바뀐 것이 신호다
  useEffect(() => {
    measure();
    setTarget(null);
  }, [node, measure]);

  useEffect(() => {
    if (target === null) return;

    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      setTarget(null);
    };

    document.addEventListener("keydown", close);
    // 바깥을 누르면 닫힌다 — 메뉴가 열린 채로 글을 쓰게 두지 않는다
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [target]);

  const run = (axis: Axis, index: number, action: TableAction) => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos === null || pos === undefined) return;

    const cell =
      axis === "row" ? cellPosition(node, pos, index, 0) : cellPosition(node, pos, 0, index);
    if (cell === null) return;

    const chain = editor.chain().focus().setTextSelection(cell);

    if (axis === "row") {
      if (action === "addBefore") chain.addRowBefore().run();
      else if (action === "addAfter") chain.addRowAfter().run();
      else chain.deleteRow().run();
    } else {
      if (action === "addBefore") chain.addColumnBefore().run();
      else if (action === "addAfter") chain.addColumnAfter().run();
      else chain.deleteColumn().run();
    }

    setTarget(null);
  };

  const columns = columnCount(node);
  const rows = rowCount(node);

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className="group/table relative my-5"
      // 손잡이는 표에 손을 올렸을 때만 나온다 — 쓰는 동안 늘 떠 있으면 그게 방해다
      data-table-handles=""
    >
      <table>
        <TableBody as="tbody" />
      </table>

      {/* 열 손잡이 — 표 위에 가로로 눕는다 */}
      {offsets.columns.map((column, index) => (
        <Handle
          key={`column-${index === 0 ? "first" : column.start}`}
          axis="column"
          label={`${index + 1}번째 열`}
          style={{ left: column.start, width: column.size, top: -11 }}
          active={target?.axis === "column" && target.index === index}
          onOpen={() => setTarget({ axis: "column", index, offset: column.start })}
        />
      ))}

      {/* 행 손잡이 — 표 왼쪽에 세로로 선다 */}
      {offsets.rows.map((row, index) => (
        <Handle
          key={`row-${index === 0 ? "first" : row.start}`}
          axis="row"
          label={`${index + 1}번째 행`}
          style={{ top: row.start, height: row.size, left: -11 }}
          active={target?.axis === "row" && target.index === index}
          onOpen={() => setTarget({ axis: "row", index, offset: row.start })}
        />
      ))}

      {/* 끝에 하나 더 붙이는 띠. 손잡이를 열지 않고도 늘릴 수 있다 */}
      <AddStrip
        label="행 추가"
        className="-bottom-[9px] inset-x-0 h-[7px]"
        onClick={() => run("row", rows - 1, "addAfter")}
      />
      <AddStrip
        label="열 추가"
        className="-right-[9px] inset-y-0 w-[7px]"
        onClick={() => run("column", columns - 1, "addAfter")}
      />

      {target && (
        <menu
          // 누른 손잡이 옆에만 선다 — 떠다니며 따라오지 않는다
          style={
            target.axis === "row"
              ? { top: target.offset, left: 0 }
              : { left: target.offset, top: 0 }
          }
          className="absolute z-20 flex min-w-[124px] flex-col border border-edge bg-card py-1 shadow-card"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {MENU_ITEMS[target.axis].map((item) => (
            <li key={item.command} className="contents">
              <button
                type="button"
                onClick={() => run(target.axis, target.index, item.command)}
                className={cn(
                  "px-3 py-1.5 text-left font-typewriter text-[11.5px] text-ink-soft hover:bg-paper hover:text-ink",
                  item.command === "delete" && "text-(--accent)",
                )}
              >
                {item.label}
              </button>
            </li>
          ))}
        </menu>
      )}
    </NodeViewWrapper>
  );
}

function Handle({
  axis,
  label,
  style,
  active,
  onOpen,
}: {
  axis: Axis;
  label: string;
  style: React.CSSProperties;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${label} 다루기`}
      aria-haspopup="menu"
      aria-expanded={active}
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onOpen}
      className={cn(
        "absolute z-10 rounded-[2px] border border-edge transition-opacity duration-150",
        axis === "column" ? "h-[7px]" : "w-[7px]",
        active
          ? "bg-(--accent) opacity-100"
          : "bg-edge opacity-0 group-hover/table:opacity-100 focus-visible:opacity-100",
      )}
    />
  );
}

function AddStrip({
  label,
  className,
  onClick,
}: {
  label: string;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      className={cn(
        "absolute z-10 rounded-[2px] bg-edge opacity-0 transition-opacity duration-150",
        "group-hover/table:opacity-60 hover:opacity-100 focus-visible:opacity-100",
        className,
      )}
    />
  );
}
