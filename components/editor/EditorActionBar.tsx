"use client";

import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/public/ThemeToggle";
import { useKeyboardInset } from "@/lib/editor/useKeyboardInset";

/**
 * 에디터 띠 — 밝기 · 저장 상태 / 작성 취소 · 임시저장 · 발행 (2026-10-07).
 *
 * 에디터에는 따로 된 헤더가 없으므로 밝기 토글도 여기 선다 — 왼쪽 끝, 저장 상태 앞.
 *
 * **글 길이와 무관하게 늘 보인다.** 발행이 시트 끝에 있을 때는 긴 글에서 끝까지 내려가야
 * 했고, 헤더의 임시저장은 스크롤하면 사라졌다. 그래서 둘을 한 줄로 모아 툴바 위에 둔다 —
 * 붙는 것은 셸이 띠와 툴바를 한 덩어리로 묶어서 한다(EditorShell).
 *
 * **모바일에서 키보드가 떠 있으면 숨긴다.** 그때는 서식 툴바가 키보드 위에 붙으므로
 * (ToolbarDock) 띠까지 서면 좁은 화면을 두 줄이 먹는다.
 */
export function EditorActionBar({
  status,
  actions,
}: {
  /** 저장 상태·오류 안내 — 왼쪽, 밝기 토글 다음 */
  status: ReactNode;
  /** 작성 취소·임시저장·발행 — 오른쪽, 발행이 맨 끝 */
  actions: ReactNode;
}) {
  const keyboardOpen = useKeyboardInset() > 0;

  return (
    <div
      data-editor-action-bar
      hidden={keyboardOpen}
      className="flex flex-wrap items-center justify-between gap-3 border-edge border-b bg-paper px-[5%] py-[11px]"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <ThemeToggle />
        {status}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
    </div>
  );
}
