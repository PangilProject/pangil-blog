"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * 복사 버튼 — 공개 지면의 아일랜드 하나 (04 §3.6).
 *
 * 코드 블록과 묵상 지면이 함께 쓴다. 무엇을 복사하는지는 부르는 쪽이 정하고, 여기서 하는
 * 일은 클립보드에 넣고 그 결과를 말해 주는 것까지다.
 *
 * 복사 실패(권한·비보안 컨텍스트)는 조용히 두지 않고 문구로 알린다 — 눌렀는데 아무 일도
 * 안 일어나는 것이 가장 나쁘다.
 */
export function CopyButton({
  text,
  label = "복사",
  className,
}: {
  text: string;
  /** 무엇을 복사하는지 — 화면에는 "복사"만 적히므로 여기에 목적어를 둔다 */
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("copied");
        } catch {
          setState("failed");
        }
        // 잠시 뒤 원래대로 — 버튼이 계속 "복사됨"이면 다음 복사가 됐는지 알 수 없다
        setTimeout(() => setState("idle"), 1600);
      }}
      aria-label={label}
      className={cn(
        "font-typewriter text-[10.5px] text-faint transition-colors duration-150 hover:text-ink",
        className,
      )}
    >
      {state === "copied" ? "복사됨" : state === "failed" ? "복사 안 됨" : "복사"}
    </button>
  );
}
