"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef } from "react";

/**
 * 글 하나의 추이를 목록 위에 띄우는 틀 (A-09).
 *
 * **통계 화면의 유일한 클라이언트 코드다.** 통계는 "클라이언트 JS 0"으로 시작했다(07 §3).
 * 그 울타리의 목적은 차트 라이브러리를 들이지 않고 화면을 앱으로 키우지 않는 것이었고,
 * 이 틀은 둘 다 하지 않는다 — 내용은 서버가 그리고(`PostStats`), 여기는 닫는 일만 한다.
 * 글을 볼 때마다 목록이 다시 그려지고 스크롤이 튀는 것을 이 정도 코드로 없앤다.
 *
 * **닫기는 뒤로 가기다.** 열 때 주소가 `/admin/stats/{id}`로 바뀌었으므로(intercepting
 * route) 닫을 때 그 한 칸을 되돌린다 — 그래야 브라우저의 뒤로 가기와 이 버튼이 같은 일을 한다.
 *
 * native `<dialog>`를 쓰지 않는 이유는 ConfirmDialog와 같다(jsdom이 `showModal()`을 모른다).
 * ESC와 배경 클릭도 닫기다.
 */
export function StatModal({ children }: { children: ReactNode }) {
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => router.back(), [router]);

  useEffect(() => {
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", onKeyDown);
    // 뒤 목록이 따라 스크롤되면 모달 안을 내리다 목록이 움직인다
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [close]);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:px-6 sm:py-10">
      {/* 배경은 버튼이다 — 같은 일을 하는 `닫기`가 안에 있으므로 접근성 트리에서는 뺀다 */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={close}
        className="absolute inset-0 bg-ink/40"
      />

      {/* 좁은 화면에서는 화면 전체를 쓴다 — 조회의 절반이 모바일이고, 가운데 띄운 상자는 그 폭에서 여백만 남는다 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-stats-title"
        className="relative flex w-full flex-col overflow-y-auto bg-paper shadow-card sm:max-h-full sm:max-w-[760px] sm:border sm:border-edge"
      >
        <div className="sticky top-0 z-10 flex justify-end bg-paper px-[5%] pt-4">
          <button
            type="button"
            ref={closeRef}
            onClick={close}
            className="font-typewriter text-[10.5px] text-faint hover:text-ink"
          >
            닫기 ✕
          </button>
        </div>

        <div className="flex flex-col gap-8 px-[5%] pt-2 pb-8">{children}</div>
      </div>
    </div>
  );
}
