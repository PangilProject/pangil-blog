"use client";

import { useEffect, useRef } from "react";

/**
 * 확인 모달 (02 §3.4 "글 지우기는 두 번 눌러야 한다").
 *
 * **의존성 없이 직접 만든다.** Radix Dialog를 들이면 그게 공개 상세의 번들에 들어간다 —
 * 이 지면에서 하는 일은 "묻고 두 버튼을 그린다"뿐이므로 10KB를 살 이유가 없다(04 §3.6 취지).
 * native `<dialog>`도 쓰지 않는다: jsdom이 `showModal()`을 지원하지 않아 삭제라는 되돌릴 수
 * 없는 동작을 브라우저 없이 검증할 수 없게 된다.
 *
 * 되돌릴 수 없는 동작에만 쓴다. 발행에는 확인을 두지 않는다(02 §3.4) — 그 결정은 그대로다.
 *
 * 열리면 **취소**에 포커스가 간다. 파괴적인 쪽에 커서를 두면 열자마자 누른 Enter가 곧
 * 삭제가 된다. ESC와 배경 클릭도 취소다 — 나가는 길을 좁혀 두지 않는다.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  pendingLabel,
  isPending = false,
  error,
  onConfirm,
  onCancel,
}: {
  /** 무엇에 대한 확인인지 — 글 제목 */
  title: string;
  message: string;
  confirmLabel: string;
  pendingLabel: string;
  isPending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };

    document.addEventListener("keydown", onKeyDown);
    // 뒤 지면이 따라 스크롤되면 모달이 떠 있는지가 흐려진다
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      {/* 배경은 버튼이다 — div에 클릭을 달면 키보드로는 닿지 않는 조작이 하나 생긴다.
          접근성 트리에서는 뺀다: 같은 일을 하는 `취소` 버튼이 안에 있어서, 여기 이름을 주면
          스크린리더에 `취소`가 둘로 들린다. ESC도 같은 일을 한다 */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onCancel}
        className="absolute inset-0 bg-ink/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${title} ${confirmLabel}`}
        className="relative w-full max-w-[320px] border border-edge bg-card px-5 py-4 shadow-card"
      >
        <p className="font-serif text-sm leading-body text-ink">{message}</p>
        <p className="mt-1.5 font-typewriter text-[11px] text-faint">{title}</p>

        {error && (
          <p role="alert" className="mt-3 font-typewriter text-[11px] text-(--accent)">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3 font-typewriter text-[11.5px]">
          <button
            type="button"
            ref={cancelRef}
            onClick={onCancel}
            className="px-1 text-faint hover:text-ink"
          >
            취소
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="border border-edge px-2.5 py-1 text-(--accent) hover:bg-paper disabled:opacity-50"
          >
            {isPending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
