"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { DeletePostButton } from "@/components/admin/DeletePostButton";
import { SelectionBar, useSelection } from "@/components/admin/SelectionBar";
import { ConfirmDialog } from "@/components/record/ConfirmDialog";
import { deleteDrafts } from "@/lib/actions/posts";
import type { RecordType } from "@/lib/record/callNumber";
import { editorPath, RECORD_TYPE_LABELS } from "@/lib/record/todayCard";
import { cn } from "@/lib/utils";

export type DraftRow = {
  id: string;
  type: RecordType;
  title: string;
  /** 서버가 계산해 넘긴다 — 클라이언트에서 "방금 전"을 다시 세면 하이드레이션이 어긋난다 */
  updatedLabel: string;
};

/**
 * 초안 목록 — 골라서 한 번에 지운다 (A-02).
 *
 * 초안은 쌓인다. 크롤러가 매일 큐티 초안을 만들고, 쓰다 만 것도 남는다. 한 편씩 지우면 열 편에
 * 확인창이 열 번이다.
 *
 * **한 편 삭제는 그대로 둔다.** 고르기는 여러 편을 치울 때의 길이고, 눈앞의 한 편을 지우려고
 * 체크부터 하게 만들 이유는 없다.
 *
 * `선택 삭제`는 하나라도 골라야 켜진다. 되돌릴 수 없으므로 확인을 한 번 받는다(02 §3.4) —
 * 몇 편인지를 그 자리에 적는다. 고르는 줄의 모양은 글 관리와 같다(SelectionBar).
 */
export function DraftList({ drafts }: { drafts: DraftRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const selection = useSelection(drafts.map((draft) => draft.id));
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setIsConfirming(false);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <SelectionBar
        count={selection.chosen.length}
        allChosen={selection.allChosen}
        onToggleAll={selection.toggleAll}
        actions={[
          {
            label: "선택 삭제",
            enabled: selection.chosen.length > 0 && !isPending,
            onSelect: () => setIsConfirming(true),
            danger: true,
          },
        ]}
      />

      <ul className="flex flex-col divide-y divide-edge border border-edge bg-card">
        {drafts.map((draft) => {
          const title = draft.title || "제목 없음";

          return (
            <li
              key={draft.id}
              className={cn(
                "flex flex-wrap items-baseline gap-3 px-4 py-3",
                selection.isChosen(draft.id) && "bg-paper",
              )}
            >
              <input
                type="checkbox"
                checked={selection.isChosen(draft.id)}
                onChange={() => selection.toggle(draft.id)}
                aria-label={`${title} 선택`}
                className="translate-y-[1px] accent-(--accent)"
              />
              <span className="w-[68px] font-typewriter text-[10.5px] text-faint">
                {RECORD_TYPE_LABELS[draft.type]}
              </span>
              <Link
                href={editorPath(draft.type, draft.id)}
                className="flex-1 text-[14px] hover:underline"
              >
                {title}
              </Link>
              <span className="font-typewriter text-[10.5px] text-faint">{draft.updatedLabel}</span>
              <DeletePostButton postId={draft.id} title={draft.title} />
            </li>
          );
        })}
      </ul>

      {isConfirming && (
        <ConfirmDialog
          title="초안함"
          message={`초안 ${selection.chosen.length}편을 삭제할까요? 되돌릴 수 없어요.`}
          confirmLabel="삭제"
          pendingLabel="삭제 중…"
          isPending={isPending}
          error={error}
          onCancel={close}
          onConfirm={() =>
            startTransition(async () => {
              const result = await deleteDrafts(selection.chosen);

              if (!result.ok) {
                // 모달을 닫지 않는다 — 닫으면 무엇이 잘못됐는지가 함께 사라진다
                setError("삭제하지 못했어요");
                return;
              }

              setIsConfirming(false);
              selection.clear();
              router.refresh();
            })
          }
        />
      )}
    </div>
  );
}
