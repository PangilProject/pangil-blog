"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * 다크모드 토글 — 공개 지면 아일랜드 4개 중 하나 (04 §3.6).
 *
 * OS 기본값을 따르고 수동 전환을 기억한다(Phase 8 결정). 첫 페인트 전 테마 클래스를 심는 일은
 * next-themes의 인라인 스크립트가 한다 — 그래서 화면이 번쩍이지 않는다.
 *
 * 마운트 전에는 현재 테마를 알 수 없다(서버는 OS 설정을 모른다). 그때 아이콘을 골라 그리면
 * 하이드레이션이 어긋나므로, 자리만 잡아두고 마운트 뒤에 채운다.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={mounted ? (isDark ? "밝은 화면으로" : "어두운 화면으로") : "화면 밝기 전환"}
      className="font-typewriter text-[11px] text-faint transition-colors duration-150 hover:text-ink"
    >
      {/* 서고의 낮과 밤 — 03 §2.1 "밤의 서고" */}
      {mounted ? isDark ? "낮" : "밤" : <span className="opacity-0">밤</span>}
    </button>
  );
}
