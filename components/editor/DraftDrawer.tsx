"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import type { RecordType } from "@/lib/record/callNumber";

/**
 * 에디터의 초안함 — 그 에디터 종류의 초안을 골라 불러온다 (ADR-006 후속).
 *
 * 전에는 에디터를 열 때 브라우저에 남은 저장 안 된 내용이 있으면 복구 배너가 곧바로 떴다.
 * 서버 임시저장이 3분 주기가 된 뒤로는 그 배너가 거의 매번 뜬다 — 그리고 **서버 데이터가
 * 우선**이다. 그래서 배너를 걷고, 버튼을 눌렀을 때만 뜨는 모달로 옮겼다.
 *
 * 브라우저에만 남은 내용은 버리지 않는다(프리모템 #2). 목록 맨 위에 한 줄로 두어 원할 때
 * 불러온다.
 */

export type DraftItem = { id: string; title: string; updatedAt: Date };

const WRITE_PATH: Record<RecordType, string> = {
  QT: "qt",
  SERMON: "sermon",
  PRAISE: "praise",
  TECH: "tech",
};

const TIME = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

/** 툴바 줄의 버튼 — 브라우저에 남은 내용도 개수에 넣는다 */
export function DraftDrawerButton({
  count,
  open,
  onToggle,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={onToggle}>
      초안함 ({count})
    </Button>
  );
}

/**
 * 초안함 모달 — 화면 가운데, 오버레이 위에 뜬다.
 *
 * 처음에는 툴바 아래로 펼쳐지는 목록이었는데, 펼칠 때마다 본문이 아래로 밀렸다(레이아웃 시프트).
 * 화면 위에 띄우면 아무것도 움직이지 않는다. 좁은 화면에서도 가운데다 — 양옆 16px만 남기고
 * 높이가 넘치면 목록만 스크롤한다.
 *
 * 누를 때만 뜨고 쓰는 중에 저절로 뜨지 않는다 — 설교 라이브 속기를 방해하지 않는다.
 * native `<dialog>`를 쓰지 않는 이유는 ConfirmDialog와 같다(jsdom이 `showModal()`을 모른다).
 * ESC와 배경 클릭도 닫기다.
 */
export function DraftDrawerModal({
  type,
  drafts,
  currentId,
  local,
  onRestoreLocal,
  onClose,
}: {
  type: RecordType;
  drafts: DraftItem[];
  currentId: string | null;
  /** 서버에 안 올라간 브라우저 사본 — 없으면 null */
  local: { updatedAt: string } | null;
  onRestoreLocal: () => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const empty = drafts.length === 0 && !local;

  useEffect(() => {
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    // 뒤 에디터가 따라 스크롤되면 목록을 내리다 본문이 움직인다
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      {/* 배경은 버튼이다 — 같은 일을 하는 `닫기`가 안에 있으므로 접근성 트리에서는 뺀다 */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-drawer-title"
        className="relative flex max-h-[80dvh] w-full max-w-[520px] flex-col border border-edge bg-paper shadow-card"
      >
        <header className="flex items-center justify-between border-edge border-b px-4 py-3">
          <h2 id="draft-drawer-title" className="font-semibold text-sm text-ink">
            초안함
          </h2>
          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            className="font-typewriter text-[10.5px] text-faint hover:text-ink"
          >
            닫기 ✕
          </button>
        </header>

        {empty ? (
          <p className="px-4 py-6 text-center text-[13px] text-faint">초안이 없어요</p>
        ) : (
          <ul className="divide-y divide-edge overflow-y-auto">
            {local && (
              <li className="flex items-center gap-3 px-4 py-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                  <span className="text-[13px] text-ink">
                    {currentId ? "이 글의 저장 안 된 내용" : "새 글의 저장 안 된 내용"}
                  </span>
                  <span className="font-typewriter text-[11px] text-faint">
                    브라우저 · {TIME.format(new Date(local.updatedAt))}
                  </span>
                </span>
                <Button size="sm" type="button" onClick={onRestoreLocal}>
                  불러오기
                </Button>
              </li>
            )}
            {drafts.map((draft) => (
              <li key={draft.id}>
                {draft.id === currentId ? (
                  <span className="flex items-center gap-3 bg-ink/4 px-4 py-3">
                    <DraftRow draft={draft} />
                    <span className="shrink-0 font-typewriter text-[11px] text-(--accent)">
                      지금 편집 중
                    </span>
                  </span>
                ) : (
                  <Link
                    href={`/admin/write/${WRITE_PATH[type]}/${draft.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-ink/4"
                  >
                    <DraftRow draft={draft} />
                    <span aria-hidden className="text-faint">
                      →
                    </span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DraftRow({ draft }: { draft: DraftItem }) {
  // 좁은 화면에서는 제목 아래로 시각을 내린다 — 한 줄에 다 넣으면 제목이 몇 글자만 남는다
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="truncate text-[13px] text-ink">{draft.title.trim() || "(제목 없음)"}</span>
      <span className="shrink-0 font-typewriter text-[11px] text-faint">
        {TIME.format(draft.updatedAt)}
      </span>
    </span>
  );
}
