"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/record/ConfirmDialog";
import { deletePost, publishPost, unpublishPost } from "@/lib/actions/posts";

/**
 * 글 한 줄의 동작 메뉴 (A-03).
 *
 * 줄마다 `비공개로 전환`·`삭제`를 늘어놓으면 스무 줄에 버튼이 마흔 개가 서고, 청구기호·제목보다
 * 그게 먼저 눈에 들어왔다. 점 세 개 하나로 접어 둔다 — 고르기(체크박스)와 일괄 버튼이 생긴 뒤로
 * 한 편씩의 동작은 가끔 쓰는 길이다.
 *
 * - **전환은 확인을 묻지 않는다.** 되돌릴 수 있고, 같은 메뉴가 되돌리는 길이다(02 §3.4는 삭제에
 *   대한 규칙이다). 다시 공개하는 길은 `publishPost` — 발행 게이트를 지나므로(05 §3.4) **실패할 수
 *   있고**, 그 사유를 줄에 남긴다.
 * - **삭제는 확인을 받는다.** 되돌릴 수 없다.
 *
 * Radix DropdownMenu다(이미 쓰는 `radix-ui` 묶음 — 의존성이 늘지 않는다). 키보드로 열고 고르는
 * 것, 밖을 누르면 닫히는 것을 직접 만들지 않는다.
 */
export function PostRowMenu({
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
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const label = title.trim() || "제목 없음";
  const toggleLabel = isPublished ? "비공개로 전환" : "공개로 전환";

  const toggle = () =>
    startTransition(async () => {
      const result = isPublished ? await unpublishPost(postId) : await publishPost(postId);

      if (!result.ok) {
        // 재공개가 막히는 사유는 대개 내용이다. 한 문구로 덮으면 손쓸 방법이 없다
        setError(
          result.reason === "not-found"
            ? "이미 삭제된 글이에요"
            : isPublished
              ? "비공개로 바꾸지 못했어요"
              : "내용이 덜 채워져 공개할 수 없어요",
        );
        return;
      }

      setError(null);
      router.refresh();
    });

  return (
    <>
      {error && (
        <button
          type="button"
          onClick={() => setError(null)}
          aria-label={`${label} ${toggleLabel} 실패 — ${error}`}
          className="font-typewriter text-[10.5px] text-(--accent)"
        >
          {error}
        </button>
      )}

      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger
          disabled={isPending}
          aria-label={`${label} 메뉴`}
          className="-my-1 px-1 py-1 text-faint hover:text-ink disabled:opacity-50 data-[state=open]:text-ink"
        >
          <MoreHorizontalIcon aria-hidden className="size-4" />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-[128px] border border-edge bg-card py-1 font-typewriter text-[11px] shadow-card"
          >
            <DropdownMenu.Item
              onSelect={toggle}
              className="cursor-pointer px-3 py-1.5 text-ink outline-none data-[highlighted]:bg-paper"
            >
              {toggleLabel}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => setIsConfirmingDelete(true)}
              className="cursor-pointer px-3 py-1.5 text-(--accent) outline-none data-[highlighted]:bg-paper"
            >
              삭제
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {isConfirmingDelete && (
        <ConfirmDialog
          title={label}
          message="이 글을 삭제할까요? 되돌릴 수 없어요."
          confirmLabel="삭제"
          pendingLabel="삭제 중…"
          isPending={isPending}
          error={deleteError}
          onCancel={() => {
            setIsConfirmingDelete(false);
            setDeleteError(null);
          }}
          onConfirm={() =>
            startTransition(async () => {
              const result = await deletePost(postId);

              if (!result.ok) {
                // 모달을 닫지 않는다 — 닫으면 무엇이 잘못됐는지가 함께 사라진다
                setDeleteError(
                  result.reason === "not-found" ? "이미 삭제된 글이에요" : "삭제하지 못했어요",
                );
                return;
              }

              setIsConfirmingDelete(false);
              router.refresh();
            })
          }
        />
      )}
    </>
  );
}
