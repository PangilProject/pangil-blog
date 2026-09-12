import { cn } from "@/lib/utils";

/**
 * 반투명 마스킹테이프 (03 §3). 허브 카드·오늘의 카드에 붙는다.
 * 물성 표현 전용이라 포인터 이벤트를 받지 않는다.
 */
export function Tape({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute -top-[9px] left-1/2 h-[19px] w-[70px] -translate-x-1/2 -rotate-2",
        // 메모지와 같은 종이다 — 토큰을 반투명으로 쓰면 테마를 따라간다.
        // 노란색을 박아 두었던 동안 다크에서 카드와 4.51:1로 갈려 밝은 덩이로 남았다.
        // 지금은 라이트 1.07 · 다크 1.22 — 양쪽에서 물성으로만 읽힌다
        "border-x border-dashed border-ink/15 bg-postit/55",
        className,
      )}
    />
  );
}
