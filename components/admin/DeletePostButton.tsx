"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/record/ConfirmDialog";
import { deletePost } from "@/lib/actions/posts";

/**
 * 글 삭제 버튼 (02 §2.4 A-03 · 02 §3.4).
 *
 * **확인을 모달로 받는다.** 삭제는 되돌릴 수 없어서 두 번 물어야 하는데(02 §3.4), 버튼이
 * 스스로 "정말 삭제할까요?"로 바뀌는 방식은 목록에서 줄이 흔들리고 어느 글에 대한 확인인지가
 * 흐렸다. 모달은 삭제할 글의 제목을 함께 보여준다.
 *
 * 모달은 의존성 없이 만든 것이다(components/record/ConfirmDialog) — 공개 상세에도 이 버튼이
 * 서므로, 라이브러리를 들이면 그게 읽는 사람의 번들에 들어간다.
 *
 * 지운 뒤 갈 곳은 부르는 쪽이 정한다. 목록에서는 그 자리에 남아 다시 읽으면 되지만,
 * **공개 상세에서 지우면 그 지면 자체가 없어진다** — 404를 보여주지 않고 목록으로 보낸다.
 */
export function DeletePostButton({
  postId,
  title,
  afterDelete,
}: {
  postId: string;
  title: string;
  /** 지운 뒤 이동할 경로. 없으면 그 자리를 다시 읽는다 */
  afterDelete?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = title.trim() || "제목 없음";

  const close = () => {
    setIsConfirming(false);
    setError(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        aria-label={`${label} 삭제`}
        className="font-typewriter text-[10.5px] text-faint hover:text-(--accent)"
      >
        삭제
      </button>

      {isConfirming && (
        <ConfirmDialog
          title={label}
          message="이 글을 삭제할까요? 되돌릴 수 없어요."
          confirmLabel="삭제"
          pendingLabel="삭제 중…"
          isPending={isPending}
          error={error}
          onCancel={close}
          onConfirm={() =>
            startTransition(async () => {
              const result = await deletePost(postId);

              if (!result.ok) {
                // 모달을 닫지 않는다 — 닫으면 무엇이 잘못됐는지가 함께 사라진다
                setError(
                  result.reason === "not-found" ? "이미 삭제된 글이에요" : "삭제하지 못했어요",
                );
                return;
              }

              setIsConfirming(false);

              if (afterDelete) {
                router.push(afterDelete);
                return;
              }

              // 서버 컴포넌트 목록을 다시 읽는다 — 지운 글이 화면에 남아 있으면 안 된다
              router.refresh();
            })
          }
        />
      )}
    </>
  );
}
