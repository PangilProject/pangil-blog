"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * 다크모드 토글 — 공개 지면 아일랜드 중 하나 (04 §3.6).
 *
 * OS 기본값을 따르고 수동 전환을 기억한다(Phase 8 결정). 첫 페인트 전 테마 클래스를 심는 일은
 * next-themes의 인라인 스크립트가 한다 — 그래서 화면이 번쩍이지 않는다.
 *
 * **글자(`밤`/`낮`) 대신 해와 달을 그린다.** 헤더의 다른 글자들과 같은 크기·같은 색이라
 * 이것만 버튼이라는 것이 읽히지 않았다 — 옆의 `글쓰기`처럼 어딘가로 가는 링크로 보였다.
 * 도형은 그 줄에서 혼자 다른 것이라 누를 것으로 읽힌다.
 *
 * 아이콘은 **지금 누르면 될 상태**를 그린다: 어두우면 해(밝게 가는 길), 밝으면 달. 지금
 * 상태를 그리면 "달이니까 지금이 밤"과 "달을 누르면 밤"이 매번 갈린다.
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
      className="text-faint transition-colors duration-150 hover:text-ink"
    >
      {/* 마운트 전에는 자리만 잡는다 — 아이콘을 골라 그리면 하이드레이션이 어긋난다 */}
      {mounted ? isDark ? <SunIcon /> : <MoonIcon /> : <span className="block size-[15px]" />}
    </button>
  );
}

/** 서고의 밤 — 03 §2.1 "밤의 서고" */
function MoonIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[15px]"
    >
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[15px]"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </svg>
  );
}
