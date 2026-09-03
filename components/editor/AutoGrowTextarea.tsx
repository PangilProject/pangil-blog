"use client";

import { type ComponentPropsWithRef, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * 내용만큼 세로로 자라는 textarea (04 §2.1).
 *
 * 가사·말씀 본문·주석은 길이를 미리 알 수 없다. 고정 높이를 주면 긴 파트에서 칸 안 스크롤이
 * 생기고, 쓰는 사람은 방금 친 줄을 보려고 두 번 스크롤한다 — 타이핑 흐름이 거기서 끊긴다.
 *
 * 높이 계산은 렌더마다 한다. 값이 폼 상태로 흐르든(controlled) RHF register로 흐르든
 * 한 경로로 잡히기 때문이다. onInput을 함께 받는 이유는 register로 묶인 칸이 타이핑 중에
 * 리렌더되지 않아서다 — 그 경우 이벤트가 유일한 신호다.
 *
 * rows는 그대로 최소 높이로 남는다. 빈 칸이 한 줄로 쪼그라들면 여기에 뭘 적는 자리인지가
 * 화면에서 사라진다.
 */
export function AutoGrowTextarea({
  ref,
  className,
  onInput,
  ...props
}: ComponentPropsWithRef<"textarea">) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  // 의존성 배열이 없는 것은 의도다 — 렌더마다 맞춘다
  useEffect(() => {
    fitHeight(innerRef.current);
  });

  return (
    <textarea
      {...props}
      ref={(node) => {
        innerRef.current = node;
        // RHF register가 넘긴 ref와 함께 쓴다. 여기서 끊으면 폼이 이 칸을 못 읽는다
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      onInput={(event) => {
        fitHeight(event.currentTarget);
        onInput?.(event);
      }}
      // 손잡이 드래그로 정한 높이는 다음 타이핑에서 덮어써진다 — 안 되는 손잡이를 보여주지 않는다
      className={cn("resize-none overflow-hidden", className)}
    />
  );
}

function fitHeight(el: HTMLTextAreaElement | null) {
  if (!el) return;
  // auto로 한 번 접어야 줄을 지웠을 때도 높이가 따라 줄어든다
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}
