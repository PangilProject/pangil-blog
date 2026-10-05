"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PostRowMenu } from "@/components/admin/PostRowMenu";
import { BulkButton, SelectionBar, useSelection } from "@/components/admin/SelectionBar";
import { ConfirmDialog } from "@/components/record/ConfirmDialog";
import {
  type BulkPostsResult,
  type BulkRepublishResult,
  deletePosts,
  republishPosts,
  unpublishPosts,
} from "@/lib/actions/posts";
import { cn } from "@/lib/utils";

export type AdminPostRow = {
  id: string;
  title: string;
  /** 청구기호 표기 — 서버가 만든다(formatCallNumber). 번호가 없는 글은 null이다 */
  callLabel: string | null;
  editorHref: string;
  status: "PUBLISHED" | "PRIVATE";
};

type Pending = "unpublish" | "republish" | "delete" | null;

/**
 * 글 관리 목록 — 골라서 한꺼번에 비공개·공개로 전환하거나 지운다 (A-03).
 *
 * 한 편씩의 동작은 줄 끝의 점 세 개 메뉴에 있다(PostRowMenu).
 *
 * **일괄 동작은 모두 확인을 받는다.** 삭제는 되돌릴 수 없다(02 §3.4). 전환은 되돌릴 수 있지만
 * 한 번에 스무 편의 공개 지면이 바뀐다 — 확인창은 무엇이 몇 편 바뀌는지를 적는다.
 *
 * `비공개 전환`은 고른 것 중 공개 중인 글이, `공개 전환`은 내려둔 글이 있을 때만 켜진다.
 * 할 일이 없는 버튼은 꺼 둔다. 삭제가 가장 무거우므로 액센트는 삭제에만 준다.
 *
 * 공개 전환은 글마다 발행 게이트를 지난다(05 §3.4) — 내용이 덜 채워진 글은 공개되지 않고,
 * 확인창이 그 수를 알린다.
 */
export function AdminPostList({ posts }: { posts: AdminPostRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  /** 일괄 처리가 끝난 뒤에도 남겨야 할 말 — 일부만 공개된 경우. 확인창은 이미 닫혔다 */
  const [notice, setNotice] = useState<string | null>(null);
  const selection = useSelection(posts.map((post) => post.id));

  const chosenPublished = posts.filter(
    (post) => post.status === "PUBLISHED" && selection.isChosen(post.id),
  );
  const chosenPrivate = posts.filter(
    (post) => post.status === "PRIVATE" && selection.isChosen(post.id),
  );
  const count = selection.chosen.length;

  const close = () => {
    setConfirming(null);
    setError(null);
  };

  const run = (task: () => Promise<BulkPostsResult | BulkRepublishResult>) =>
    startTransition(async () => {
      const result = await task();
      if (!result.ok) {
        // 모달을 닫지 않는다 — 닫으면 무엇이 잘못됐는지가 함께 사라진다
        setError("바꾸지 못했어요");
        return;
      }

      // 일부만 공개됐으면 그 사실을 목록 위에 남긴다. 확인창에 두면 고른 것이 비워진 뒤
      // "0편을 공개로 전환할까요?"로 바뀐 창이 남는다
      setNotice(
        "failed" in result && result.failed > 0
          ? `${result.failed}편은 내용이 덜 채워져 공개하지 못했어요. 그 글은 열어서 채운 뒤 공개해 주세요`
          : null,
      );
      setConfirming(null);
      selection.clear();
      router.refresh();
    });

  const scope = (matched: number) =>
    matched === count ? `${count}편을` : `고른 ${count}편 중 ${matched}편을`;

  return (
    <div className="flex flex-col gap-2">
      <SelectionBar count={count} allChosen={selection.allChosen} onToggleAll={selection.toggleAll}>
        <BulkButton
          quiet
          enabled={chosenPublished.length > 0 && !isPending}
          onClick={() => setConfirming("unpublish")}
        >
          비공개 전환
        </BulkButton>
        <BulkButton
          quiet
          enabled={chosenPrivate.length > 0 && !isPending}
          onClick={() => setConfirming("republish")}
        >
          공개 전환
        </BulkButton>
        <BulkButton enabled={count > 0 && !isPending} onClick={() => setConfirming("delete")}>
          선택 삭제
        </BulkButton>
      </SelectionBar>

      {/* 상태 영역은 늘 그려 둔다 — 비어 있다가 생긴 글을 화면 읽기가 알린다. 누르면 지운다 */}
      <div role="status" className="self-start pl-4">
        {notice && (
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-left font-typewriter text-[10.5px] text-(--accent)"
          >
            {notice}
          </button>
        )}
      </div>

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
              <PostRowMenu
                postId={post.id}
                title={post.title}
                isPublished={post.status === "PUBLISHED"}
              />
            </li>
          );
        })}
      </ul>

      {confirming === "unpublish" && (
        <ConfirmDialog
          title="글 관리"
          message={`${scope(chosenPublished.length)} 비공개로 전환할까요?`}
          confirmLabel="비공개 전환"
          pendingLabel="바꾸는 중…"
          isPending={isPending}
          error={error}
          onCancel={close}
          onConfirm={() => run(() => unpublishPosts(chosenPublished.map((post) => post.id)))}
        />
      )}

      {confirming === "republish" && (
        <ConfirmDialog
          title="글 관리"
          message={`${scope(chosenPrivate.length)} 공개로 전환할까요?`}
          confirmLabel="공개 전환"
          pendingLabel="바꾸는 중…"
          isPending={isPending}
          error={error}
          onCancel={close}
          onConfirm={() => run(() => republishPosts(chosenPrivate.map((post) => post.id)))}
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
