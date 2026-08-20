import { Children, type CSSProperties, cloneElement, isValidElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 순차 등장 (03 §4) — 카드가 한 장씩 꽂히듯 나타난다. G(활판 낱장) 시안에서 계승한
 * 공통 모션이며, 이 시스템에서 모션은 물리 은유가 있는 곳에만 붙는다.
 *
 * 자식마다 --stagger-index만 심고 애니메이션은 CSS가 처리한다. JS 없이 끝나므로
 * 공개 페이지의 클라이언트 아일랜드 한도(04 §3.6)를 건드리지 않는다.
 * prefers-reduced-motion에서는 CSS가 애니메이션을 아예 걸지 않아 즉시 보인다.
 */
export function Stagger({
  children,
  /** 몇 번째부터 셀지 — 페이지네이션 2쪽부터 이어 세울 때 쓴다 */
  startIndex = 0,
  className,
}: {
  children: ReactNode;
  startIndex?: number;
  className?: string;
}) {
  return (
    <>
      {Children.map(children, (child, index) => {
        if (!isValidElement<{ className?: string; style?: CSSProperties }>(child)) return child;

        return cloneElement(child, {
          className: cn("record-appear", child.props.className, className),
          style: {
            ...child.props.style,
            "--stagger-index": startIndex + index,
          } as CSSProperties,
        });
      })}
    </>
  );
}
