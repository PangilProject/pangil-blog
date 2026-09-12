"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * 표 줄 — 툴바 아래에 **인라인으로 펼쳐지는** 한 줄 (ADR-001 §5).
 *
 * 떠다니는 팝업이 아니다. 툴바가 한 줄 늘어나며 레이아웃을 밀어낸다 — 문단 스타일 목록과
 * 같은 근거다(툴바에 고정된 것이므로 "떠다니는 UI 금지"에 어긋나지 않는다).
 *
 * 두 얼굴을 한 자리에서 쓴다. **커서가 표 밖이면** 크기를 고르는 격자,
 * **표 안이면** 행·열을 더하고 지우는 줄이다 — 툴바가 현재 블록을 따라간다는 규칙
 * (ADR-001 §3 양방향 반영)을 표에도 그대로 적용한 것이다.
 *
 * 표 안에서 Tab은 다음 칸으로 간다(Tiptap 기본). **지우는 길이 없던 것**이 실제 불편이었다.
 */

/** 격자 크기. 블로그 글의 표는 이보다 커지는 일이 드물고, 커지면 행·열을 더하면 된다 */
const MAX_ROWS = 5;
const MAX_COLS = 6;

/** 자리 번호가 아니라 값으로 돌린다 — 격자는 재정렬되지 않지만 키에 인덱스를 쓰지 않는다 */
const ROW_SIZES = Array.from({ length: MAX_ROWS }, (_, index) => index + 1);
const COL_SIZES = Array.from({ length: MAX_COLS }, (_, index) => index + 1);

export type TableCommand =
  | "addRowAfter"
  | "deleteRow"
  | "addColumnAfter"
  | "deleteColumn"
  | "deleteTable";

const TABLE_COMMAND_LABELS: Record<TableCommand, string> = {
  addRowAfter: "행 추가",
  deleteRow: "행 삭제",
  addColumnAfter: "열 추가",
  deleteColumn: "열 삭제",
  deleteTable: "표 삭제",
};

export function TableToolbarRow({
  inTable = false,
  onInsertTable,
  onTableCommand,
}: {
  /** 커서가 표 안에 있는가 */
  inTable?: boolean;
  onInsertTable?: (rows: number, cols: number) => void;
  onTableCommand?: (command: TableCommand) => void;
}) {
  const [isPicking, setIsPicking] = useState(false);
  // 마우스가 지나간 칸까지 물들인다 — 끌지 않아도 "여기까지"가 보인다
  const [hover, setHover] = useState<{ rows: number; cols: number } | null>(null);

  if (inTable) {
    return (
      <Row>
        {(Object.keys(TABLE_COMMAND_LABELS) as TableCommand[]).map((command) => (
          <button
            key={command}
            type="button"
            onClick={() => onTableCommand?.(command)}
            className={cn(
              "border border-edge bg-paper px-2 py-[3px] font-typewriter text-[11px] text-ink-soft",
              "hover:border-ink-soft hover:text-ink",
              command === "deleteTable" && "ml-auto text-(--accent)",
            )}
          >
            {TABLE_COMMAND_LABELS[command]}
          </button>
        ))}
      </Row>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-expanded={isPicking}
        onClick={() => setIsPicking((open) => !open)}
        className={cn(
          "border px-1.5 py-[3px] font-typewriter text-[11.5px]",
          isPicking
            ? "border-ink-soft bg-paper text-ink"
            : "border-transparent text-ink-soft hover:border-edge hover:text-ink",
        )}
      >
        ⊞ 표
      </button>

      {isPicking && (
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
                        setIsPicking(false);
                        setHover(null);
                      }}
                      className={cn(
                        "size-[13px] border border-edge",
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
      )}
    </>
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
