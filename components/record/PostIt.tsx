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
        "font-serif text-[12.5px] leading-[1.85] text-[#5c5334]",
        className,
      )}
    >
      {label && <div className="mb-[5px] font-typewriter text-[10px] text-[#a0904e]">{label}</div>}
      {children}
    </div>
  );
}
