import Link from "next/link";

import type { RecordCounts } from "@/lib/db/publicLists";

/**
 * 목록 상단 (03 §5.1) — 월 표기 + "이번 달 N장 · 통산 N장".
 *
 * 통계 대시보드 없이 동기를 만드는 자리다(Backlog 대시보드의 선발대). 숫자가 늘어나는 것을
 * 보는 것 자체가 지속의 연료라서, 방문자 수가 0이어도 이 줄은 의미가 있다(프리모템 #4).
 */
export function ListHeader({
  title,
  month,
  counts,
  searchAction,
  searchQuery,
  titleHidden = false,
}: {
  title: string;
  /** "8월" */
  month: string;
  counts: RecordCounts;
  /** 검색 폼이 향할 경로 (D-04 / F-05) */
  searchAction: string;
  searchQuery?: string;
  /**
   * 제목을 화면에서만 감춘다. 지면 이름을 헤더가 이미 말하고 있을 때 쓴다 —
   * 같은 말이 두 번 찍히면 그중 하나는 장식이다.
   *
   * 지우지 않고 감추는 이유는 문서 구조다. h1이 없는 지면은 검색엔진과 스크린리더에게
   * "무엇에 대한 목록인지" 말해주지 않는다.
   */
  titleHidden?: boolean;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className={titleHidden ? "sr-only" : "font-serif text-[clamp(19px,3vw,23px)]"}>
          <Link href={searchAction} className="hover:text-(--accent)">
            {title}
          </Link>
        </h1>

        <p className="font-typewriter text-[11px] text-faint">
          {month} <b className="text-ink">{counts.thisMonth}장</b> · 통산{" "}
          <b className="text-ink">{counts.total}장</b>
        </p>
      </div>

      {/* 검색은 폼 하나다 — 공개 페이지에 클라이언트 JS를 늘리지 않는다(04 §3.6) */}
      <form action={searchAction} className="flex items-center gap-2 border-edge border-b pb-1.5">
        <input
          type="search"
          name="q"
          defaultValue={searchQuery}
          placeholder="제목·내용 검색"
          aria-label="검색어"
          className="min-w-0 flex-1 bg-transparent font-typewriter text-[12px] outline-none placeholder:text-faint"
        />
        <button type="submit" className="font-typewriter text-[11px] text-faint hover:text-ink">
          찾기
        </button>
      </form>
    </header>
  );
}
