"use client";

import { useState } from "react";

/**
 * 코드 복사 버튼 — 공개 지면의 아일랜드 4개 중 하나 (04 §3.6).
 *
 * 이 버튼만 클라이언트다. 하이라이팅은 서버에서 이미 끝나 있다.
 * 복사 실패(권한·비보안 컨텍스트)는 조용히 두지 않고 문구로 알린다 — 눌렀는데 아무 일도
 * 안 일어나는 것이 가장 나쁘다.
 */
export function CopyButton({ code }: { code: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setState("copied");
        } catch {
          setState("failed");
        }
        // 잠시 뒤 원래대로 — 버튼이 계속 "복사됨"이면 다음 복사가 됐는지 알 수 없다
        setTimeout(() => setState("idle"), 1600);
      }}
      aria-label="코드 복사"
      className="font-typewriter text-[10.5px] text-[#8B8474] transition-colors duration-150 hover:text-[#F3EFE4]"
    >
      {state === "copied" ? "복사됨" : state === "failed" ? "복사 안 됨" : "복사"}
    </button>
  );
}
