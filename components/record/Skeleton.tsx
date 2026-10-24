import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 불러오는 동안 서는 자리 표시 (`loading.tsx`가 쓴다).
 *
 * **200ms 안에 오면 보이지 않는다.** 리전을 DB 옆으로 옮긴 뒤 대부분의 이동이 0.3초 안팎이라,
 * 회색 덩어리를 곧바로 띄우면 "기다리라"는 신호가 아니라 깜빡임이 된다(2026-10-25). 그래서
 * 덩어리만 늦게 페이드인하고, 진짜로 그릴 수 있는 것(관리 네비·지면 헤더·푸터)은 바로 그린다 —
 * 그 줄이 그대로 남아 있는 것만으로 "이동은 됐고 내용이 오는 중"이 읽힌다.
 *
 * 전부 서버 컴포넌트이고 CSS만으로 움직인다(`.skeleton-*`, globals.css) — 공개 지면의
 * 아일랜드를 늘리지 않는다(04 §3.6). 공개·관리가 같이 쓰므로 `components/record`에 둔다.
 */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton-block", className)} />;
}

/**
 * 테두리 칸처럼 **색을 채우지 않는** 자리. 칸은 덩어리와 같은 박자로 늦게 나타난다 —
 * 칸만 먼저 서면 빈 상자들이 200ms 동안 "글이 없다"로 읽힌다.
 */
export function SkeletonFrame({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div aria-hidden className={cn("skeleton-reveal", className)}>
      {children}
    </div>
  );
}

/**
 * 불러오는 지면 전체를 감싼다. 화면 읽기에는 한 번만 말한다 — 덩어리마다 숨기고(aria-hidden)
 * 여기서 `불러오는 중이에요` 한 줄이다.
 */
export function LoadingRegion({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div aria-busy="true" className={className}>
      <p role="status" className="sr-only">
        불러오는 중이에요
      </p>
      {children}
    </div>
  );
}
