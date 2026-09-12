import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 노란 메모지 (03 §3) — "거슬림 목록"의 UI화(프리모템 #3). A-01 대시보드에 붙는다.
 * 개선 욕구를 여기에 적어두고 미루는 것이 완벽주의 억제 장치다.
 */
export function PostIt({
  label,
  children,
  className,
}: {
  label?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-[190px] -rotate-2 bg-postit px-[15px] pt-[13px] pb-4 shadow-[0_6px_14px_rgb(60_50_35_/_18%)]",
        // 글자는 토큰이다. 하드코딩이던 동안 다크에서 어두운 글자가 올리브 위에 얹혀
        // 본문 1.23:1 · 라벨 1.95:1이었다 — 메모지는 관리 화면에만 있어 오래 안 보였다
        "font-serif text-[12.5px] leading-[1.85] text-ink",
        className,
      )}
    >
      {label && <div className="mb-[5px] font-typewriter text-[10px] text-ink-soft">{label}</div>}
      {children}
    </div>
  );
}
