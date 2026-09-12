import type { RecordCounts } from "@/lib/db/publicLists";
import { cn } from "@/lib/utils";

/**
 * 목록 상단 (03 §5.1) — 월 표기 + "이번 달 N장 · 통산 N장".
 *
 * 제목은 **지금 보고 있는 목록의 이름**이다 — `전체 글`·`큐티`·`#태그`·검색어. 한동안 지면
 * 이름("믿음의 기록")을 적고 화면에서 감춰 뒀는데, 그건 헤더가 같은 말을 하고 있어서였다.
 * 이제 그 이름은 사이드바가 말하므로 이 자리는 제 몫을 한다.
 *
 * 링크가 아니다. 목록을 갈아 끼우는 길은 사이드바에 있고, 지금 보고 있는 것을 누르면 지금
 * 보고 있는 것이 나오는 링크는 누를 이유가 없다.
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
}: {
  title: string;
  /** "8월" */
  month: string;
  counts: RecordCounts;
  /** 검색 폼이 향할 경로 (D-04 / F-05) */
  searchAction: string;
  searchQuery?: string;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-serif text-[clamp(19px,3vw,23px)]">{title}</h1>

        <p className="font-typewriter text-[11px] text-faint">
          {month} <b className="text-ink">{counts.thisMonth}장</b> · 통산{" "}
          <b className="text-ink">{counts.total}장</b>
        </p>
      </div>

      {/* 검색은 폼 하나다 — 공개 페이지에 클라이언트 JS를 늘리지 않는다(04 §3.6) */}
      {/*
        포커스는 **괘선이 받는다.** 입력에 `outline-none`만 두었더니 키보드로 들어와도 화면에
        아무 일이 없었다(옆의 `찾기` 버튼은 표시가 있어서 더 어긋나 보였다). 네모 링을 씌우는
        대신 이 줄의 밑줄이 잉크색이 된다 — 종이 위의 밑줄이 이 지면의 문법이다.
      */}
      <form
        action={searchAction}
        className={cn(
          "flex items-center gap-2 border-edge border-b pb-1.5",
          "has-[:focus-visible]:border-(--accent)",
        )}
      >
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
