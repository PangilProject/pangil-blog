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
        "border-x border-dashed border-[rgb(160_145_90_/_40%)] bg-[rgb(233_222_168_/_55%)]",
        className,
      )}
    />
  );
}
