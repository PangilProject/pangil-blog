import type { ReactNode } from "react";

import type { ScriptureSegment } from "@/lib/record/scriptureVerses";
import { cn } from "@/lib/utils";

/**
 * 말씀 인용 (03 §5.2) — QT는 붉은 세로 괘 + 세리프, 설교는 인용 블록.
 *
 * 신성한 텍스트는 항상 세리프(Gowun Batang)로 적고 행간을 2.15로 벌린다(03 §2.2).
 * 위계는 서체 크기가 아니라 역할 교체로 만든다.
 */

export type ScriptureBlockVariant = "qt" | "sermon";

export type ScriptureBlockProps = {
  variant?: ScriptureBlockVariant;
  /** 말씀 범위 — "열왕기상 2장 41~46절" */
  reference: string;
  /** 절 단위로 넘기면 절 번호를 타자기체로 앞에 세운다 */
  verses?: { number?: string | number; text: string; segments?: ScriptureSegment[] }[];
  /** 절 분해 없이 통째로 넣을 때 */
  children?: ReactNode;
  className?: string;
};

export function ScriptureBlock({
  variant = "qt",
  reference,
  verses,
  children,
  className,
}: ScriptureBlockProps) {
  return (
    <figure
      className={cn(
        "py-5",
        variant === "qt"
          ? "border-(--accent) border-l-2 pl-[22px]"
          : "border-edge border-l bg-crawl px-[22px]",
        className,
      )}
    >
      <figcaption className="mb-2 font-typewriter text-[11px] text-(--accent)">
        {reference}
      </figcaption>
      <div className="font-serif text-[15px] leading-scripture text-ink">
        {verses?.map((verse) => (
          <p key={`${verse.number ?? ""}-${verse.text.slice(0, 12)}`} className="mb-2">
            {verse.number !== undefined && (
              <span className="mr-2 align-[7px] font-code text-[10px] text-(--accent)">
                {verse.number}
              </span>
            )}
            {/*
              강조는 글자 안의 표시로 실려 온다(`**굵게**` · `__밑줄__`, lib/record/scriptureVerses).
              표시가 없는 절은 덩이 하나뿐이라 예전과 같은 글자가 나온다.
            */}
            {(verse.segments ?? [{ text: verse.text }]).map((segment, index) => (
              <span
                // 같은 글자가 한 절에 두 번 나올 수 있어 자리 번호까지 쓴다
                // biome-ignore lint/suspicious/noArrayIndexKey: 덩이는 다시 정렬되지 않는다
                key={`${index}-${segment.text.slice(0, 8)}`}
                className={cn(
                  segment.bold && "font-bold",
                  segment.underline && "underline decoration-(--accent) underline-offset-[3px]",
                )}
              >
                {segment.text}
              </span>
            ))}
          </p>
        ))}
        {children}
      </div>
    </figure>
  );
}
