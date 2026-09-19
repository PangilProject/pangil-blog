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
  idle = "복사",
  className,
}: {
  text: string;
  /** 무엇을 복사하는지 — 화면 글자보다 길게 적는다. 읽어 주는 이름이 된다 */
  label?: string;
  /**
   * 화면에 적을 말. **같은 화면에 복사 버튼이 둘 이상 설 때만** 바꾼다 — 나란히 선 둘이
   * 똑같이 `복사`이면 무엇이 다른지 단서가 `aria-label`에만 있고, 그건 눈으로 안 보인다.
   */
  idle?: string;
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
      {copyLabel(state, idle)}
    </button>
  );
}
