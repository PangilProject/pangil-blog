"use client";

import { updateColumns } from "@tiptap/extension-table";
import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  cellColorClass,
  TABLE_CELL_COLOR_LABELS,
  TABLE_CELL_COLORS,
  type TableCellColor,
} from "@/lib/editor/tableCellColors";
import {
  clearAxis,
  duplicateAxis,
  hasMergedCells,
  moveAxis,
  selectAndRun,
} from "@/lib/editor/tableCommands";
import { columnCount, rowCount } from "@/lib/editor/tableGeometry";
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
 * **`NodeViewContent`가 `<table>`이어야 한다.**
 *
 * Tiptap은 이 요소 **안에** 제 content 요소를 하나 더 만들어 넣는다. `as="tbody"`로 두면
 * `<tbody><div><tr>…`이 되고, 표 안의 `<div>`는 브라우저가 표 밖으로 밀어낸다 — 표 조판이
 * 깨지고 `table.rows`가 비어 손잡이도 못 그린다. 실제로 그렇게 만들었다가 고쳤다.
 *
 * `<table>`로 두고 안쪽 content 요소를 `tbody`로 만들면(`contentDOMElementTag`)
 * `<table><tbody><tr>…`이 된다. `as`의 타입이 좁아 단언이 필요하다.
 */
const TableElement = NodeViewContent as unknown as React.FC<{ as: "table" }>;

/** 손잡이 두께. 표 테두리에 붙여 놓는다 — 떨어뜨리면 무엇에 달린 손잡이인지 흐려진다 */
const HANDLE = 8;

/** 칸이 이보다 좁아지지 않는다. `Table.configure`에 넘긴 값과 같아야 드래그 셈이 맞는다 */
const CELL_MIN_WIDTH = 48;

type Axis = "row" | "column";
type Target = { axis: Axis; index: number; offset: number; size: number };

const MENU_ITEMS: Record<Axis, { command: TableAction; label: string }[]> = {
  row: [
    { command: "addBefore", label: "위에 삽입" },
    { command: "addAfter", label: "아래에 삽입" },
    { command: "duplicate", label: "복제" },
    { command: "clear", label: "콘텐츠 삭제" },
    { command: "delete", label: "삭제" },
  ],
  column: [
    { command: "addBefore", label: "왼쪽에 삽입" },
    { command: "addAfter", label: "오른쪽에 삽입" },
    { command: "duplicate", label: "복제" },
    { command: "clear", label: "콘텐츠 삭제" },
    { command: "delete", label: "삭제" },
  ],
};

type TableAction = "addBefore" | "addAfter" | "duplicate" | "clear" | "delete";

/** 손잡이가 놓일 자리. 표의 실제 칸을 재서 얻는다 — 칸 너비를 짐작하지 않는다 */
type Offsets = {
  rows: { start: number; size: number }[];
  columns: { start: number; size: number }[];
};

export function TableNodeView({ editor, node, getPos }: NodeViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [offsets, setOffsets] = useState<Offsets>({ rows: [], columns: [] });
  const [target, setTarget] = useState<Target | null>(null);
  /** 끄는 중인 손잡이와, 지금 놓으면 갈 자리 */
  const [drag, setDrag] = useState<{ axis: Axis; from: number; to: number } | null>(null);
  /** 못 하는 일을 했을 때 한 줄로 알린다. 조용히 넘기면 고장으로 읽힌다 */
  const [notice, setNotice] = useState<string | null>(null);
  /** 방금 끌었는가. 끌린 뒤 따라오는 click 한 번을 삼킨다 */
  const draggedRef = useRef(false);

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

  /**
   * 표의 첫 자식을 `<colgroup>`으로 유지한다.
   *
   * 폭을 끌 때 prosemirror-tables는 **가장 가까운 `<table>`의 `firstChild`를 colgroup으로
   * 보고** 거기에 폭을 쓴다(`displayColumnWidth`). 기본 TableView 대신 우리 NodeView를
   * 쓰므로 그 자리를 우리가 만들어 줘야 한다 — 없으면 끄는 동안 아무 일도 일어나지 않는다.
   *
   * React가 만드는 자식이 아니다. Tiptap도 tbody를 이렇게 직접 붙인다.
   */
  useEffect(() => {
    const table = wrapperRef.current?.querySelector("table");
    if (!table) return;

    const first = table.firstChild;
    const colgroup =
      first instanceof HTMLTableColElement && first.tagName === "COLGROUP"
        ? first
        : table.insertBefore(document.createElement("colgroup"), table.firstChild);

    updateColumns(node, colgroup, table, CELL_MIN_WIDTH);
    measure();
  }, [node, measure]);

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

  // 안내는 잠시 뒤 스스로 사라진다 — 지우는 일을 사람에게 시키지 않는다
  useEffect(() => {
    if (notice === null) return;

    const timer = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

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

    if (action === "duplicate") duplicateAxis(editor, node, pos, axis, index);
    else if (action === "clear") clearAxis(editor, node, pos, axis, index);
    else {
      selectAndRun(editor, node, pos, axis, index, (chain) => {
        if (axis === "row") {
          if (action === "addBefore") chain.addRowBefore().run();
          else if (action === "addAfter") chain.addRowAfter().run();
          else chain.deleteRow().run();
        } else {
          if (action === "addBefore") chain.addColumnBefore().run();
          else if (action === "addAfter") chain.addColumnAfter().run();
          else chain.deleteColumn().run();
        }
      });
    }

    setTarget(null);
  };

  /**
   * 손잡이를 끌어 자리를 바꾼다.
   *
   * 누르는 것과 끄는 것을 **움직인 거리로** 가른다(가사 섹션의 드래그와 같은 기준, 4px).
   * 그렇게 안 하면 메뉴를 열려고 누를 때마다 줄이 흔들린다.
   *
   * 메뉴는 `click`이 연다. 끌기를 `pointerdown`에만 매달면 **키보드로는 못 연다** —
   * Enter는 포인터 이벤트를 내지 않는다. 끌린 뒤에 따라오는 click만 한 번 삼킨다.
   */
  const startDrag = (axis: Axis, index: number, event: React.PointerEvent) => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos === null || pos === undefined) return;

    const lanes = axis === "row" ? offsets.rows : offsets.columns;
    const origin = axis === "row" ? event.clientY : event.clientX;
    const base = axis === "row" ? (lanes[index]?.start ?? 0) : (lanes[index]?.start ?? 0);
    let moved = false;
    let to = index;

    const onMove = (move: PointerEvent) => {
      const delta = (axis === "row" ? move.clientY : move.clientX) - origin;
      if (!moved && Math.abs(delta) < 4) return;
      moved = true;

      // 끌고 있는 자리가 어느 줄 위에 있나. 줄 한가운데를 넘으면 그 줄과 자리를 바꾼다
      const at = base + delta + (lanes[index]?.size ?? 0) / 2;
      to = lanes.findIndex((lane) => at >= lane.start && at < lane.start + lane.size);
      if (to < 0) to = at < 0 ? 0 : lanes.length - 1;

      setDrag({ axis, from: index, to });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDrag(null);

      // 움직이지 않았으면 누른 것이다. 뒤따라올 click이 메뉴를 연다
      if (!moved) return;

      draggedRef.current = true;
      if (!moveAxis(editor, node, pos, axis, index, to) && hasMergedCells(node)) {
        setNotice("칸을 합친 표는 순서를 바꿀 수 없어요");
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const openMenu = (axis: Axis, index: number) => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }

    const lane = (axis === "row" ? offsets.rows : offsets.columns)[index];
    setTarget({ axis, index, offset: lane?.start ?? 0, size: lane?.size ?? 0 });
  };

  /** 색은 고른 줄 전체에 칠한다 — 손잡이가 가리킨 것이 줄이기 때문이다 */
  const paint = (axis: Axis, index: number, color: TableCellColor) => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos === null || pos === undefined) return;

    selectAndRun(editor, node, pos, axis, index, (chain) => {
      chain.setCellAttribute("backgroundColor", color === "none" ? null : color).run();
    });
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
      <TableElement as="table" />

      {/* 열 손잡이 — 표 위에 가로로 눕는다 */}
      {offsets.columns.map((column, index) => (
        <Handle
          // 열은 자리가 곧 정체다 — 다시 정렬되지 않는다
          // biome-ignore lint/suspicious/noArrayIndexKey: 자리 번호가 식별자다
          key={index}
          axis="column"
          label={`${index + 1}번째 열`}
          style={{ left: column.start, width: column.size, top: -HANDLE }}
          active={target?.axis === "column" && target.index === index}
          dropping={drag?.axis === "column" && drag.to === index}
          onPress={(event) => startDrag("column", index, event)}
          onOpen={() => openMenu("column", index)}
        />
      ))}

      {/* 행 손잡이 — 표 왼쪽에 세로로 선다 */}
      {offsets.rows.map((row, index) => (
        <Handle
          // biome-ignore lint/suspicious/noArrayIndexKey: 자리 번호가 식별자다
          key={index}
          axis="row"
          label={`${index + 1}번째 행`}
          style={{ top: row.start, height: row.size, left: -HANDLE }}
          active={target?.axis === "row" && target.index === index}
          dropping={drag?.axis === "row" && drag.to === index}
          onPress={(event) => startDrag("row", index, event)}
          onOpen={() => openMenu("row", index)}
        />
      ))}

      {/* 끝에 하나 더 붙이는 띠. 손잡이를 열지 않고도 늘릴 수 있다 */}
      <AddStrip
        label="행 추가"
        className="-bottom-[10px] inset-x-0 h-[9px]"
        onClick={() => run("row", rows - 1, "addAfter")}
      >
        +
      </AddStrip>
      <AddStrip
        label="열 추가"
        className="-right-[10px] inset-y-0 w-[9px]"
        onClick={() => run("column", columns - 1, "addAfter")}
      >
        +
      </AddStrip>

      {/* 고른 행·열을 감싼다 — 메뉴가 어디에 대한 것인지 글자 없이 보여야 한다 */}
      {target && (
        <div
          aria-hidden
          style={
            target.axis === "row"
              ? { top: target.offset, height: target.size, left: 0, right: 0 }
              : { left: target.offset, width: target.size, top: 0, bottom: 0 }
          }
          className="pointer-events-none absolute z-[5] border border-(--accent) bg-(--accent)/8"
        />
      )}

      {notice && (
        <p
          role="alert"
          className="absolute -top-7 right-0 z-20 border border-edge bg-card px-2 py-1 font-typewriter text-[11px] text-(--accent)"
        >
          {notice}
        </p>
      )}

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

          {/* 색은 세 칸뿐이라 이름 대신 견본을 늘어놓는다 — 고르는 데 한 번이면 된다 */}
          <li className="flex items-center gap-1.5 border-edge border-t px-3 pt-2 pb-1">
            <span className="font-typewriter text-[10.5px] text-faint">색</span>
            {TABLE_CELL_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={TABLE_CELL_COLOR_LABELS[color]}
                title={TABLE_CELL_COLOR_LABELS[color]}
                onClick={() => paint(target.axis, target.index, color)}
                className={cn("size-[14px] border border-edge", cellColorClass(color) ?? "bg-card")}
              />
            ))}
          </li>
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
  dropping,
  onPress,
  onOpen,
}: {
  axis: Axis;
  label: string;
  style: React.CSSProperties;
  active: boolean;
  /** 지금 놓으면 여기로 온다 */
  dropping: boolean;
  onPress: (event: React.PointerEvent) => void;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${label} 다루기`}
      // 손잡이가 무엇을 하는 것인지 글자로도 말한다 — 8px짜리 띠는 눌러 보기 전에는 모른다
      title={`${label} · 눌러서 삽입·삭제, 끌어서 자리 옮기기`}
      aria-haspopup="menu"
      aria-expanded={active}
      style={style}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPress(event);
      }}
      onClick={onOpen}
      className={cn(
        "absolute z-10 border border-edge transition-opacity duration-150",
        axis === "column" ? "h-[8px] cursor-pointer" : "w-[8px] cursor-pointer",
        active || dropping
          ? "bg-(--accent) opacity-100"
          : "bg-paper opacity-0 hover:bg-edge group-hover/table:opacity-100 focus-visible:opacity-100",
      )}
    />
  );
}

function AddStrip({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={`눌러서 ${label.replace(" 추가", "")} 하나 추가`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      className={cn(
        "absolute z-10 flex items-center justify-center border border-edge bg-paper",
        "font-typewriter text-[11px] text-faint opacity-0 transition-opacity duration-150",
        "hover:bg-edge hover:text-ink group-hover/table:opacity-100 focus-visible:opacity-100",
        className,
      )}
    >
      {children}
    </button>
  );
}
