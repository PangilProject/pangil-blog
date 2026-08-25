import { cn } from "@/lib/utils";

/**
 * 점선 주석 상자 (03 §3·§5.2) — 365qt 원문의 주석 블록.
 *
 * 이건 사용자 창작이 아니라 "가져온 것"이다(02 결정 로그 #12). 그래서 본문과 같은 지면에
 * 두되 점선 상자로 층을 나눈다. 주석이 없는 날도 정상이므로(0개 허용) 이 컴포넌트는
 * 항목이 있을 때만 놓인다.
 */
export type Annotation = {
  term: string;
  verseRef?: string | null;
  body: string;
};

export function AnnotationBox({
  annotations,
  className,
}: {
  annotations: Annotation[];
  className?: string;
}) {
  if (annotations.length === 0) return null;

  return (
    <div
      className={cn(
        "border border-dashed border-edge-strong bg-crawl px-[17px] py-[15px]",
        "text-[13px] leading-[1.85] text-ink-soft",
        className,
      )}
    >
      <ul className="flex flex-col gap-2.5">
        {annotations.map((annotation) => (
          <li key={annotation.term}>
            <b className="text-ink">{annotation.term}</b>
            {annotation.verseRef && (
              <span className="ml-1.5 font-typewriter text-[10.5px] text-faint">
                {annotation.verseRef}
              </span>
            )}
            <span className="mx-1.5">—</span>
            {annotation.body}
          </li>
        ))}
      </ul>
    </div>
  );
}
