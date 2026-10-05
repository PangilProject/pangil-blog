"use client";

import { type ReactNode, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * 목록에서 여러 줄을 고르는 상태 (A-02 초안함 · A-03 글 관리).
 *
 * `chosen`은 **지금 보이는 줄 중에서** 고른 것이다. 지운 뒤 새 목록이 오면 없어진 id는
 * 고른 것에서도 빠져야 한다 — 안 그러면 "3편 선택됨"이 화면에 없는 글을 센다.
 */
export function useSelection(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = new Set(ids);
  const chosen = [...selected].filter((id) => visible.has(id));
  const allChosen = ids.length > 0 && chosen.length === ids.length;

  return {
    chosen,
    allChosen,
    isChosen: (id: string) => selected.has(id),
    toggle: (id: string) =>
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    toggleAll: () => setSelected(allChosen ? new Set() : new Set(ids)),
    clear: () => setSelected(new Set()),
  };
}

/**
 * 목록 위의 한 줄 — 전체 선택 · 고른 수 · 일괄 버튼.
 *
 * 왼쪽은 아래 행과 같은 세로줄에 서야 한다. 행은 목록 테두리(1px) 안에 있으므로 여기도 투명한
 * 테두리로 같은 자리를 비우고, 체크박스와 글자 사이도 행과 같은 gap-3이다. 오른쪽은 여백 없이
 * 목록의 바깥 테두리에 붙인다 — 버튼이 목록 상자의 끝선과 한 줄이 된다.
 *
 * 고른 수는 버튼 밖에 따로 적는다. 버튼 안에 `선택 삭제 2`로 넣었더니 이름과 숫자가 붙어
 * 읽혔다 — 수는 상태이고 버튼은 동작이다.
 */
export function SelectionBar({
  count,
  allChosen,
  onToggleAll,
  children,
}: {
  count: number;
  allChosen: boolean;
  onToggleAll: () => void;
  /** 일괄 버튼들(BulkButton) */
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-transparent border-l pl-4">
      <label className="flex items-center gap-3 font-typewriter text-[10.5px] text-faint">
        <input
          type="checkbox"
          checked={allChosen}
          onChange={onToggleAll}
          className="accent-(--accent)"
        />
        전체 선택
      </label>

      {count > 0 && (
        <span aria-live="polite" className="font-typewriter text-[10.5px] text-ink-soft">
          {count}편 선택됨
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}

/**
 * 일괄 버튼. 할 수 있을 때만 켜진다(설정의 `분류 추가`와 같은 규칙) — 켜지면 액센트로 채워
 * "이제 누를 수 있다"가 보이게 한다. `quiet`는 같은 줄의 두 번째 버튼이다: 둘 다 채우면
 * 어느 쪽이 무거운 동작인지가 안 보인다.
 */
export function BulkButton({
  enabled,
  quiet = false,
  onClick,
  children,
}: {
  enabled: boolean;
  quiet?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      className={cn(
        "border px-3 py-1 font-typewriter text-[11px] transition-colors duration-150",
        !enabled && "cursor-not-allowed border-edge text-faint",
        enabled &&
          (quiet
            ? "border-ink-soft bg-card text-ink hover:border-ink"
            : "border-(--accent) bg-(--accent) font-bold text-paper hover:brightness-90"),
      )}
    >
      {children}
    </button>
  );
}
