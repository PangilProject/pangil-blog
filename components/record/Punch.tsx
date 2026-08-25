import { cn } from "@/lib/utils";

/**
 * 천공 (03 §3) — 카드·지면 하단의 구멍. 서고에 꽂혔던 흔적이다.
 */
export function Punch({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute bottom-[13px] left-1/2 size-[13px] -translate-x-1/2 rounded-full",
        "border border-edge-strong bg-paper shadow-[inset_0_1px_2px_rgb(0_0_0_/_15%)]",
        className,
      )}
    />
  );
}
