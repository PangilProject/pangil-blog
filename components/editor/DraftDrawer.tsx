"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { RecordType } from "@/lib/record/callNumber";

/**
 * 에디터의 초안함 — 그 에디터 종류의 초안을 골라 불러온다 (ADR-006 후속).
 *
 * 전에는 에디터를 열 때 브라우저에 남은 저장 안 된 내용이 있으면 복구 배너가 곧바로 떴다.
 * 서버 임시저장이 3분 주기가 된 뒤로는 그 배너가 거의 매번 뜬다 — 그리고 **서버 데이터가
 * 우선**이다. 그래서 배너를 걷고, 버튼을 눌렀을 때만 펼쳐지는 목록으로 옮겼다.
 *
 * 브라우저에만 남은 내용은 버리지 않는다(프리모템 #2). 목록 맨 위에 한 줄로 두어 원할 때
 * 불러온다. 저절로 펼쳐지지 않고 화면을 덮지 않는다 — 설교 에디터의 "팝업 금지"를 지킨다.
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
    <Button type="button" aria-expanded={open} aria-controls="draft-drawer" onClick={onToggle}>
      초안함 ({count})
    </Button>
  );
}

/** 펼쳐진 목록 — 에디터 셸의 배너 자리에 선다 */
export function DraftDrawerList({
  type,
  drafts,
  currentId,
  local,
  onRestoreLocal,
}: {
  type: RecordType;
  drafts: DraftItem[];
  currentId: string | null;
  /** 서버에 안 올라간 브라우저 사본 — 없으면 null */
  local: { updatedAt: string } | null;
  onRestoreLocal: () => void;
}) {
  const empty = drafts.length === 0 && !local;

  return (
    <section
      id="draft-drawer"
      aria-label="초안함"
      className="mx-auto w-full max-w-[720px] border border-edge bg-card"
    >
      {empty ? (
        <p className="px-4 py-3 text-[13px] text-faint">초안이 없어요</p>
      ) : (
        <ul className="divide-y divide-edge">
          {local && (
            <li className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex-1 text-[13px] text-ink">
                {currentId ? "이 글의 저장 안 된 내용" : "새 글의 저장 안 된 내용"}
                <span className="ml-2 font-typewriter text-[11px] text-faint">
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
                <span className="flex items-center gap-3 bg-ink/4 px-4 py-2.5">
                  <DraftRow draft={draft} />
                  <span className="font-typewriter text-[11px] text-(--accent)">지금 편집 중</span>
                </span>
              ) : (
                <Link
                  href={`/admin/write/${WRITE_PATH[type]}/${draft.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-ink/4"
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
    </section>
  );
}

function DraftRow({ draft }: { draft: DraftItem }) {
  return (
    <span className="flex min-w-0 flex-1 items-baseline gap-3">
      <span className="truncate text-[13px] text-ink">{draft.title.trim() || "(제목 없음)"}</span>
      <span className="shrink-0 font-typewriter text-[11px] text-faint">
        {TIME.format(draft.updatedAt)}
      </span>
    </span>
  );
}
