"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * 표 줄 — 툴바 아래에 **인라인으로 펼쳐지는** 한 줄 (ADR-001 §5).
 *
 * 떠다니는 팝업이 아니다. 툴바가 한 줄 늘어나며 레이아웃을 밀어낸다 — 문단 스타일 목록과
 * 같은 근거다(툴바에 고정된 것이므로 "떠다니는 UI 금지"에 어긋나지 않는다).
 *
 * 두 얼굴을 한 자리에서 쓴다. **커서가 표 밖이면** 크기를 고르는 격자, **표 안이면**
 * 표를 지우는 줄이다 — 툴바가 현재 블록을 따라간다는 규칙(ADR-001 §3)을 표에도 적용한 것이다.
 *
 * 행과 열은 여기 없다. 표 위의 손잡이가 맡는다(`TableNodeView`) — 조작 대상이 화면에
 * 있어야 하기 때문이다.
 */

/** 격자 크기. 블로그 글의 표는 이보다 커지는 일이 드물고, 커지면 행·열을 더하면 된다 */
const MAX_ROWS = 5;
const MAX_COLS = 6;

/** 자리 번호가 아니라 값으로 돌린다 — 격자는 재정렬되지 않지만 키에 인덱스를 쓰지 않는다 */
const ROW_SIZES = Array.from({ length: MAX_ROWS }, (_, index) => index + 1);
const COL_SIZES = Array.from({ length: MAX_COLS }, (_, index) => index + 1);

/**
 * 표 **전체**나 **고른 칸**에 하는 일만 남는다. 행·열은 손잡이가 맡는다(TableNodeView) —
 * 툴바에 두면 "커서가 어쩌다 놓인 행"이 지워지고, 어느 행인지 버튼만 봐서는 알 수 없다.
 *
 * 여기 남은 것들은 그 모호함이 없다. 커서가 놓인 표는 하나뿐이고, 병합·나누기는 **고른 칸**이
 * 대상이라 화면에 이미 드러나 있다(`.selectedCell`).
 */
export type TableCommand = "toggleHeaderRow" | "mergeCells" | "splitCell" | "deleteTable";

const TABLE_COMMAND_LABELS: Record<TableCommand, string> = {
  toggleHeaderRow: "머리 줄",
  mergeCells: "칸 병합",
  splitCell: "칸 나누기",
  deleteTable: "표 삭제",
};

/**
 * 지금 할 수 있는 일인가. **할 수 없는 버튼은 눌리지 않아야 한다** — 누르고 아무 일도
 * 안 일어나면 고장으로 읽힌다(02 §3.4). 병합은 칸을 여럿 골라야 하고, 나누기는 이미
 * 합쳐진 칸에서만 된다.
 */
const REQUIREMENTS: Partial<Record<TableCommand, string>> = {
  mergeCells: "칸을 두 개 이상 끌어서 골라 주세요",
  splitCell: "합쳐진 칸에서 쓸 수 있어요",
};

/** `⊞ 표` — 크기 격자를 펴고 접는다. 툴바의 서식 줄에 선다(모바일에서는 가로 스크롤 줄) */
export function TableToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={cn(
        "h-8 shrink-0 border px-1.5 font-typewriter text-[11.5px] max-md:h-11 max-md:px-2.5",
        open
          ? "border-ink-soft bg-paper text-ink"
          : "border-transparent text-ink-soft hover:border-edge hover:text-ink",
      )}
    >
      ⊞ 표
    </button>
  );
}

/**
 * 툴바 아래에 펼쳐지는 표 줄. 표 안이면 표를 만지는 줄, 표 밖에서 `⊞ 표`를 눌렀으면 크기 격자다.
 *
 * 펴고 접는 상태는 툴바가 든다 — 단추(`TableToggle`)와 이 줄이 툴바의 다른 자리에 서기
 * 때문이다. 모바일에서는 단추가 가로 스크롤 줄 안에 있고, 이 줄은 그 밖에서 전체 폭을 쓴다.
 */
export function TablePanel({
  inTable = false,
  open,
  can,
  onInsertTable,
  onTableCommand,
  onClose,
}: {
  /** 커서가 표 안에 있는가 */
  inTable?: boolean;
  /** 크기 격자가 펴져 있는가 */
  open: boolean;
  /** 지금 할 수 있는 일들. 모르면 다 열어 둔다 */
  can?: Partial<Record<TableCommand, boolean>>;
  onInsertTable?: (rows: number, cols: number) => void;
  onTableCommand?: (command: TableCommand) => void;
  /** 크기를 골랐으면 접는다 — 한 번 하는 일이다 */
  onClose: () => void;
}) {
  // 마우스가 지나간 칸까지 물들인다 — 끌지 않아도 "여기까지"가 보인다
  const [hover, setHover] = useState<{ rows: number; cols: number } | null>(null);

  if (inTable) {
    return (
      <Row>
        {(Object.keys(TABLE_COMMAND_LABELS) as TableCommand[]).map((command) => {
          const allowed = can?.[command] ?? true;

          return (
            <button
              key={command}
              type="button"
              disabled={!allowed}
              // 왜 못 누르는지 말한다. 회색 버튼만 두면 고장인지 조건인지 알 수 없다
              title={allowed ? undefined : REQUIREMENTS[command]}
              onClick={() => onTableCommand?.(command)}
              className={cn(
                "border border-edge bg-paper px-2 py-[3px] font-typewriter text-[11px] text-ink-soft max-md:h-10 max-md:px-3",
                "hover:border-ink-soft hover:text-ink disabled:opacity-40 disabled:hover:border-edge",
                command === "deleteTable" && "ml-auto text-(--accent)",
              )}
            >
              {TABLE_COMMAND_LABELS[command]}
            </button>
          );
        })}
      </Row>
    );
  }

  if (!open) return null;

  return (
    <Row>
      <fieldset
        className="flex flex-col gap-[3px]"
        onMouseLeave={() => setHover(null)}
        aria-label="표 크기"
      >
        {ROW_SIZES.map((rows) => (
          <div key={rows} className="flex gap-[3px]">
            {COL_SIZES.map((cols) => {
              const filled = hover !== null && rows <= hover.rows && cols <= hover.cols;

              return (
                <button
                  key={`cell-${rows}-${cols}`}
                  type="button"
                  aria-label={`${rows}행 ${cols}열 표 넣기`}
                  onMouseEnter={() => setHover({ rows, cols })}
                  // 키보드로 옮겨도 같은 자리가 물든다 — 마우스만의 기능이 아니다
                  onFocus={() => setHover({ rows, cols })}
                  onClick={() => {
                    onInsertTable?.(rows, cols);
                    onClose();
                    setHover(null);
                  }}
                  className={cn(
                    "size-[13px] border border-edge max-md:size-7",
                    filled ? "bg-(--accent)" : "bg-card",
                  )}
                />
              );
            })}
          </div>
        ))}
      </fieldset>

      <span className="font-typewriter text-[10.5px] text-faint">
        {hover ? `${hover.rows} × ${hover.cols}` : "크기를 고르세요"}
      </span>
    </Row>
  );
}

/** 툴바 아래에 붙는 줄. 떠 있지 않고 자리를 차지한다 */
function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2 border-edge border-t border-dashed pt-2">
      {children}
    </div>
  );
}
