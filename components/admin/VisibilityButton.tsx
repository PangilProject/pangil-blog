"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { publishPost, unpublishPost } from "@/lib/actions/posts";

/**
 * 발행↔비공개 전환 (02 §2.4 A-03).
 *
 * **확인을 묻지 않는다.** 삭제와 달리 되돌릴 수 있고, 같은 버튼이 되돌리는 길이다 —
 * 되돌릴 수 있는 동작에 확인을 붙이면 매번 두 번 누르는 일만 늘어난다(02 §3.4는 삭제에
 * 대한 규칙이다).
 *
 * 다시 공개하는 길은 `publishPost`다. status를 PUBLISHED로 바꾸는 경로는 발행 게이트 하나여야
 * 하므로(05 §3.4) 여기서 상태만 되돌리지 않는다. 그래서 **재공개도 실패할 수 있다** —
 * content가 스키마를 통과하지 못하는 상태라면. 그 사유를 화면에 남긴다.
 */
export function VisibilityButton({
  postId,
  title,
  isPublished,
}: {
  postId: string;
  title: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const label = title.trim() || "제목 없음";
  const action = isPublished ? "비공개로" : "공개로";

  if (error) {
    return (
      <button
        type="button"
        onClick={() => setError(null)}
        aria-label={`${label} ${action} 실패 — ${error}`}
        className="font-typewriter text-[10.5px] text-(--accent)"
      >
        {error}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = isPublished ? await unpublishPost(postId) : await publishPost(postId);

          if (!result.ok) {
            // 재공개가 막히는 사유는 대개 content다. 조용히 실패하면 왜 안 바뀌는지 모른다
            setError(result.reason === "not-found" ? "이미 지워졌어요" : "바꾸지 못했어요");
            return;
          }

          // 상태 배지와 목록을 다시 읽는다
          router.refresh();
        })
      }
      aria-label={`${label} ${action}`}
      className="font-typewriter text-[10.5px] text-faint hover:text-ink disabled:opacity-50"
    >
      {isPending ? "바꾸는 중…" : action}
    </button>
  );
}
