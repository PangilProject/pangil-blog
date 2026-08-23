"use client";

import type { ReactNode } from "react";

import { useKeyboardInset } from "@/lib/editor/useKeyboardInset";

/**
 * 툴바를 키보드 위에 붙인다 (02 §5.2 모바일 대응 확정).
 *
 * 데스크탑에서는 아무것도 하지 않는다 — display:contents로 자리만 비켜주고 툴바의
 * 상단 sticky가 그대로 산다. 모바일에서 키보드가 올라오면 그 높이만큼 띄워 화면 아래에
 * 고정한다. 툴바 자체를 두 벌 만들지 않는다(ADR-001: 툴바는 하나다).
 */
export function ToolbarDock({ children }: { children: ReactNode }) {
  const inset = useKeyboardInset();
  const docked = inset > 0;

  return (
    <div
      className={docked ? "fixed inset-x-0 z-30 border-edge border-t shadow-card" : "contents"}
      style={docked ? { bottom: inset } : undefined}
    >
      {children}
    </div>
  );
}
