"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { DeletePostButton } from "@/components/admin/DeletePostButton";
import { BulkButton, SelectionBar, useSelection } from "@/components/admin/SelectionBar";
import { VisibilityButton } from "@/components/admin/VisibilityButton";
import { ConfirmDialog } from "@/components/record/ConfirmDialog";
import { type BulkPostsResult, deletePosts, unpublishPosts } from "@/lib/actions/posts";
import { cn } from "@/lib/utils";

export type AdminPostRow = {
  id: string;
  title: string;
  /** 청구기호 표기 — 서버가 만든다(formatCallNumber). 번호가 없는 글은 null이다 */
  callLabel: string | null;
  editorHref: string;
  status: "PUBLISHED" | "PRIVATE";
};

type Pending = "unpublish" | "delete" | null;

/**
 * 글 관리 목록 — 골라서 한꺼번에 비공개로 내리거나 지운다 (A-03).
 *
 * 한 편씩의 버튼(비공개·삭제)은 그대로 둔다. 고르기는 여러 편을 치울 때의 길이다.
 *
 * **두 일괄 동작 모두 확인을 받는다.** 삭제는 되돌릴 수 없고(02 §3.4), 비공개는 한 편이면 같은
 * 버튼으로 바로 되돌리지만 여러 편은 한 편씩 다시 공개해야 한다 — 다시 공개하는 길이 발행
 * 게이트 하나이기 때문이다(05 §3.4). 확인창은 무엇이 몇 편 바뀌는지를 적는다.
 *
 * `비공개로`는 고른 것 중 공개 중인 글이 있을 때만 켜진다. 이미 내린 글만 골랐으면 할 일이 없다.
 * 삭제가 더 무거운 동작이므로 액센트는 삭제에 주고, 비공개는 조용한 버튼이다.
 */
export function AdminPostList({ posts }: { posts: AdminPostRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const selection = useSelection(posts.map((post) => post.id));

  const chosenPublished = posts.filter(
    (post) => post.status === "PUBLISHED" && selection.isChosen(post.id),
  );
  const count = selection.chosen.length;

  const close = () => {
    setConfirming(null);
    setError(null);
  };

  const run = (task: () => Promise<BulkPostsResult>) =>
    startTransition(async () => {
      const result = await task();
      if (!result.ok) {
        // 모달을 닫지 않는다 — 닫으면 무엇이 잘못됐는지가 함께 사라진다
        setError("바꾸지 못했어요");
        return;
      }
      setConfirming(null);
      selection.clear();
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-2">
      <SelectionBar count={count} allChosen={selection.allChosen} onToggleAll={selection.toggleAll}>
        <BulkButton
          quiet
          enabled={chosenPublished.length > 0 && !isPending}
          onClick={() => setConfirming("unpublish")}
        >
          비공개로
        </BulkButton>
        <BulkButton enabled={count > 0 && !isPending} onClick={() => setConfirming("delete")}>
          선택 삭제
        </BulkButton>
      </SelectionBar>

      <ul className="flex flex-col divide-y divide-edge border border-edge bg-card">
        {posts.map((post) => {
          const title = post.title || "제목 없음";

          return (
            <li
              key={post.id}
              className={cn(
                "flex flex-wrap items-baseline gap-3 px-4 py-3",
                selection.isChosen(post.id) && "bg-paper",
              )}
            >
              <input
                type="checkbox"
                checked={selection.isChosen(post.id)}
                onChange={() => selection.toggle(post.id)}
                aria-label={`${title} 선택`}
                className="translate-y-[1px] accent-(--accent)"
              />
              {/* TECH는 카테고리를 청구기호에 병기한다 — 공개 목록과 같은 표기다(03 §5.2) */}
              <span className="w-[120px] font-typewriter text-[10.5px] text-(--accent)">
                {post.callLabel}
              </span>
              <Link href={post.editorHref} className="flex-1 text-[14px] hover:underline">
                {title}
              </Link>
              {/* 발행된 글이 대다수라 상태를 매 줄에 적으면 그게 배경이 된다.
                  내려둔 글만 표시한다 — 03 §7 문구 규약: 구현 용어(PRIVATE)는 쓰지 않는다 */}
              {post.status === "PRIVATE" && (
                <span className="font-typewriter text-[10.5px] text-(--accent)">비공개</span>
              )}
              <VisibilityButton
                postId={post.id}
                title={post.title}
                isPublished={post.status === "PUBLISHED"}
              />
              <DeletePostButton postId={post.id} title={post.title} />
            </li>
          );
        })}
      </ul>

      {confirming === "unpublish" && (
        <ConfirmDialog
          title="글 관리"
          message={
            chosenPublished.length === count
              ? `${count}편을 비공개로 내릴까요? 다시 공개하려면 한 편씩 공개해야 해요.`
              : `고른 ${count}편 중 공개 중인 ${chosenPublished.length}편을 비공개로 내릴까요? 다시 공개하려면 한 편씩 공개해야 해요.`
          }
          confirmLabel="비공개로"
          pendingLabel="내리는 중…"
          isPending={isPending}
          error={error}
          onCancel={close}
          onConfirm={() => run(() => unpublishPosts(chosenPublished.map((post) => post.id)))}
        />
      )}

      {confirming === "delete" && (
        <ConfirmDialog
          title="글 관리"
          message={`${count}편을 삭제할까요? 되돌릴 수 없어요.`}
          confirmLabel="삭제"
          pendingLabel="삭제 중…"
          isPending={isPending}
          error={error}
          onCancel={close}
          onConfirm={() => run(() => deletePosts(selection.chosen))}
        />
      )}
    </div>
  );
}
