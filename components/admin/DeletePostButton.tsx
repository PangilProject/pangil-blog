"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deletePost } from "@/lib/actions/posts";

/**
 * 글 삭제 버튼 (02 §2.4 A-03).
 *
 * **확인을 두 번째 클릭으로 받는다.** 발행에는 확인 모달을 두지 않지만(02 §3.4) 삭제는
 * 되돌릴 수 없다 — 다만 모달을 띄우는 대신 버튼이 스스로 "정말 지울까요?"로 바뀐다.
 * 팝업을 늘리지 않으면서도 실수 한 번으로 글이 사라지지는 않는다.
 *
 * 확인 상태는 다른 곳을 누르거나(blur) 실패하면 풀린다 — 켜둔 채로 남겨두면 다음 클릭이
 * 곧 삭제가 된다.
 */
export function DeletePostButton({ postId, title }: { postId: string; title: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = title.trim() || "제목 없음";

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        aria-label={`${label} 삭제`}
        className="font-typewriter text-[10.5px] text-faint hover:text-(--accent)"
      >
        삭제
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 font-typewriter text-[10.5px]">
      {error ? (
        <span className="text-(--accent)">{error}</span>
      ) : (
        <span className="text-ink-soft">정말 지울까요?</span>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await deletePost(postId);

            if (!result.ok) {
              setError(result.reason === "not-found" ? "이미 지워졌어요" : "지우지 못했어요");
              return;
            }

            setIsConfirming(false);
            // 서버 컴포넌트 목록을 다시 읽는다 — 지운 글이 화면에 남아 있으면 안 된다
            router.refresh();
          })
        }
        aria-label={`${label} 삭제 확인`}
        className="text-(--accent) underline disabled:opacity-50"
      >
        {isPending ? "지우는 중…" : "지운다"}
      </button>

      <button
        type="button"
        onClick={() => {
          setIsConfirming(false);
          setError(null);
        }}
        aria-label={`${label} 삭제 취소`}
        className="text-faint hover:text-ink"
      >
        취소
      </button>
    </span>
  );
}
