"use client";

import { copyLabel, useCopyText } from "@/lib/ui/useCopyText";
import { cn } from "@/lib/utils";

/**
 * 복사 버튼 — 공개 지면의 아일랜드 하나 (04 §3.6).
 *
 * 코드 블록과 묵상 지면이 함께 쓴다. 무엇을 복사하는지는 부르는 쪽이 정하고, 여기서 하는
 * 일은 그 글자를 클립보드에 넣는 것까지다(동작은 `useCopyText`).
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
  const { state, copy } = useCopyText();

  return (
    <button
      type="button"
      onClick={() => void copy(text)}
      aria-label={label}
      className={cn(
        "font-typewriter text-[10.5px] text-faint transition-colors duration-150 hover:text-ink",
        className,
      )}
    >
      {copyLabel(state, "복사")}
    </button>
  );
}
