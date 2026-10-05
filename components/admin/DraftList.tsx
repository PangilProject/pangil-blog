"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { DeletePostButton } from "@/components/admin/DeletePostButton";
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
 * `선택 삭제`는 하나라도 골라야 켜진다(설정의 `분류 추가`와 같은 규칙). 되돌릴 수 없으므로
 * 확인을 한 번 받는다(02 §3.4) — 몇 편인지를 그 자리에 적는다.
 *
 * 고른 수는 버튼 밖, `전체 선택` 옆에 따로 적는다. 버튼 안에 `선택 삭제 2`로 넣었더니 이름과
 * 숫자가 붙어 읽혔다 — 수는 상태이고 버튼은 동작이다.
 */
export function DraftList({ drafts }: { drafts: DraftRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 지운 뒤 새 목록이 오면 없어진 id는 고른 것에서도 빠져야 한다
  const visible = new Set(drafts.map((draft) => draft.id));
  const chosen = [...selected].filter((id) => visible.has(id));
  const allChosen = drafts.length > 0 && chosen.length === drafts.length;

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const close = () => {
    setIsConfirming(false);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {/*
        왼쪽은 아래 행과 같은 세로줄에 서야 한다. 행은 목록 테두리(1px) 안에 있으므로 여기도 투명한
        테두리로 같은 자리를 비우고, 체크박스와 글자 사이도 행과 같은 gap-3이다.
        오른쪽은 여백 없이 목록의 바깥 테두리에 붙인다 — 버튼이 목록 상자의 끝선과 한 줄이 된다
      */}
      <div className="flex items-center gap-3 border-transparent border-l pl-4">
        <label className="flex items-center gap-3 font-typewriter text-[10.5px] text-faint">
          <input
            type="checkbox"
            checked={allChosen}
            onChange={() =>
              setSelected(allChosen ? new Set() : new Set(drafts.map((draft) => draft.id)))
            }
            className="accent-(--accent)"
          />
          전체 선택
        </label>

        {chosen.length > 0 && (
          <span aria-live="polite" className="font-typewriter text-[10.5px] text-ink-soft">
            {chosen.length}편 선택됨
          </span>
        )}

        <button
          type="button"
          disabled={chosen.length === 0 || isPending}
          onClick={() => setIsConfirming(true)}
          className={cn(
            "ml-auto border px-3 py-1 font-typewriter text-[11px] transition-colors duration-150",
            chosen.length > 0
              ? "border-(--accent) bg-(--accent) font-bold text-paper hover:brightness-90 disabled:opacity-60"
              : "cursor-not-allowed border-edge text-faint",
          )}
        >
          선택 삭제
        </button>
      </div>

      <ul className="flex flex-col divide-y divide-edge border border-edge bg-card">
        {drafts.map((draft) => {
          const title = draft.title || "제목 없음";

          return (
            <li
              key={draft.id}
              className={cn(
                "flex flex-wrap items-baseline gap-3 px-4 py-3",
                selected.has(draft.id) && "bg-paper",
              )}
            >
              <input
                type="checkbox"
                checked={selected.has(draft.id)}
                onChange={() => toggle(draft.id)}
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
          message={`초안 ${chosen.length}편을 삭제할까요? 되돌릴 수 없어요.`}
          confirmLabel="삭제"
          pendingLabel="삭제 중…"
          isPending={isPending}
          error={error}
          onCancel={close}
          onConfirm={() =>
            startTransition(async () => {
              const result = await deleteDrafts(chosen);

              if (!result.ok) {
                // 모달을 닫지 않는다 — 닫으면 무엇이 잘못됐는지가 함께 사라진다
                setError("삭제하지 못했어요");
                return;
              }

              setIsConfirming(false);
              setSelected(new Set());
              router.refresh();
            })
          }
        />
      )}
    </div>
  );
}
