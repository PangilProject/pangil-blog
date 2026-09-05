"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/record/ConfirmDialog";
import { discardDraft } from "@/lib/actions/posts";
import { ADMIN_HOME_PATH } from "@/lib/auth/adminPaths";

/**
 * 쓰던 글을 접고 나가기 (A-04~07).
 *
 * 에디터에 들어왔다가 안 쓰고 나가는 길이 없었다. 브라우저 뒤로가기뿐이었는데, 그러면
 * 자동 저장이 이미 만든 빈 초안이 초안함에 남는다 — 초안함이 "이어서 쓸 것"을 묻는 자리라
 * 빈 껍데기가 쌓이면 그 질문이 흐려진다(FaithFormatTabs가 서식을 바꿀 때 같은 정리를 한다).
 *
 * **초안이면 지운다.** 크롤러가 새벽에 만든 것이든 아까 자동 저장이 만든 것이든, 지금
 * 화면에 열린 초안을 지우고 나간다 — "오늘 큐티를 열어봤는데 안 쓰기로 했다"도 그 초안을
 * 남길 이유가 아니다. 지워도 `큐티 가져오기`로 다시 부를 수 있고, 확인 창이 먼저 묻는다.
 *
 * 처음에는 **이 세션에서 만든 초안만** 지우려고 `postId === null`을 신호로 삼았다. 그런데
 * 첫 자동 저장이 끝나면 에디터가 `router.replace`로 `[id]` 경로로 옮겨가면서 화면이 다시
 * 마운트되고, 그 순간 `postId`가 채워져 신호가 사라진다 — **정작 이 기능이 겨냥한 흐름에서만**
 * 확인 창이 안 떴다. 세션을 기억하려면 저장소를 하나 더 두거나 주소에 표시를 남겨야 하는데,
 * 둘 다 "초안이면 지운다"보다 비싸다.
 *
 * 발행된 글을 고치는 중이면 그리지 않는다. 그건 `작성`이 아니라 `수정`이고, 되돌아갈 곳도
 * 관리 홈이 아니라 그 글이다.
 *
 * 아직 저장된 것이 없으면 확인도 묻지 않는다. 물어봐야 할 것이 없는데 묻는 창은 그저 한 번 더
 * 누르게 하는 일이다.
 *
 * `onDiscard`는 밀린 저장을 끊고 로컬 사본을 비운다(`autosave.abandon`). 둘 다 필요하다 —
 * 끊지 않으면 취소를 누른 뒤 디바운스가 깨어나 **초안을 안 남기려고 누른 버튼이 초안을
 * 남기고**, 비우지 않으면 다음에 에디터를 열 때 복구 배너가 방금 버린 글을 되살리겠다고
 * 묻는다.
 */
export function CancelDraftButton({
  draftId,
  isDraft = true,
  onDiscard,
}: {
  /** 지금 열려 있는 글. 아직 한 번도 저장되지 않았으면 null이고, 그러면 지울 것이 없다 */
  draftId: string | null;
  /** 초안인가. 발행·비공개 글을 고치는 중이면 이 버튼은 서지 않는다 */
  isDraft?: boolean;
  /** 밀린 저장을 끊고 로컬 사본을 비운다 — 각 에디터의 autosave.abandon */
  onDiscard: () => void;
}) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 발행된 글을 고치는 중이다 — 여기서 할 일은 `작성 취소`가 아니다
  if (!isDraft) return null;

  const leave = () => {
    onDiscard();
    router.push(ADMIN_HOME_PATH);
  };

  const discard = () =>
    startTransition(async () => {
      if (!draftId) {
        leave();
        return;
      }

      const result = await discardDraft(draftId);

      if (!result.ok) {
        // 사유를 갈라 쓴다 — 이미 없는 것과 지울 수 없는 것은 다음에 할 일이 다르다(03 §7.3b)
        setError(
          result.reason === "not-found"
            ? "이미 삭제된 글이에요"
            : "발행된 글이라 삭제하지 않았어요",
        );
        return;
      }

      leave();
    });

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => (draftId ? setIsConfirming(true) : leave())}
        className="font-typewriter text-[11px] text-faint hover:text-ink disabled:opacity-50"
      >
        작성 취소
      </button>

      {isConfirming && (
        <ConfirmDialog
          title="쓰던 글"
          message="지금까지 쓴 것이 삭제돼요. 되돌릴 수 없어요."
          confirmLabel="삭제"
          pendingLabel="삭제 중…"
          isPending={isPending}
          error={error}
          onCancel={() => {
            setIsConfirming(false);
            setError(null);
          }}
          onConfirm={discard}
        />
      )}
    </>
  );
}
