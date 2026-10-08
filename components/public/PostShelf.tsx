import Link from "next/link";

import type { PostShelf as Shelf, ShelfPost } from "@/lib/db/publicPosts";
import { formatCallNumber } from "@/lib/record/callNumber";
import { siteOf } from "@/lib/revalidate/tags";
import { postHref } from "@/lib/site/publicUrl";
import { cn } from "@/lib/utils";

/**
 * 같은 축의 다른 글 + 떠오르는 이전·다음 글 (F-03 · 2026-10-08).
 *
 * 전에는 본문 끝에 이전 글·다음 글 링크 둘뿐이었다. 티스토리의 "카테고리의 다른 글" 상자와
 * 떠오르는 이전·다음 카드를 이 지면 결로 옮겼다. **둘 다 서버가 그린다** — 떠오르는 것은
 * CSS 스크롤 타임라인이, 닫는 것은 숨긴 체크박스가 한다(아일랜드 예산, 04 §3.6).
 *
 * 축 라벨을 함께 적는다 — 왜 이 글들이 묶였는지가 화면에서 설명돼야 한다. 라벨이 없으면
 * "설교를 읽었는데 왜 찬양이 다음글인가"를 읽는 사람이 혼자 추측한다.
 */
export function PostShelf({
  shelf,
  axisLabel,
  allHref,
}: {
  shelf: Shelf;
  /** "설교" · "FE" 처럼 지금 잇고 있는 축의 이름 */
  axisLabel: string;
  /** 그 축의 목록 */
  allHref: string;
}) {
  // 축에 이 글 하나뿐이면 보여 줄 다른 글이 없다
  if (shelf.items.length <= 1) return null;

  return (
    <>
      <ShelfList shelf={shelf} axisLabel={axisLabel} allHref={allHref} />
      <FloatingNeighbors previous={shelf.previous} next={shelf.next} axisLabel={axisLabel} />
    </>
  );
}

/**
 * 목록 상자. **넓은 화면과 좁은 화면이 모양이 다르다.**
 *
 * - 넓은 화면: 액센트 괘를 위에 그은 상자에 한 줄씩 — 번호 · 제목 · →.
 * - 좁은 화면: 티스토리 모바일처럼 덩이 — 굵은 제목 두 줄 · 요약 두 줄 · 날짜. 번호와 →는
 *   손가락 화면에서 읽을 것이 아니라 숨긴다. 썸네일 자리는 없다(썸네일은 걷어냈다).
 *
 * 지금 글 줄은 누를 수 없고 액센트 괘로 표시한다 — 창의 가운데라 "어디쯤인지"를 말한다.
 */
function ShelfList({
  shelf,
  axisLabel,
  allHref,
}: {
  shelf: Shelf;
  axisLabel: string;
  allHref: string;
}) {
  return (
    <section
      aria-labelledby="post-shelf-heading"
      className="lg:border-(--accent) lg:border-t-2 lg:bg-card lg:ring-1 lg:ring-edge"
    >
      <header className="flex items-baseline justify-between gap-3 pb-2.5 lg:border-edge lg:border-b lg:px-[18px] lg:pt-3.5 lg:pb-3">
        <h2 id="post-shelf-heading" className="font-bold text-base lg:font-semibold lg:text-sm">
          '<em className="text-(--accent) not-italic">{axisLabel}</em>' 칸의 다른 글
          <span className="ml-1.5 hidden font-normal font-typewriter text-[11px] text-faint lg:inline">
            {shelf.total}편
          </span>
        </h2>
        <Link
          href={allHref}
          className="shrink-0 font-typewriter text-[11.5px] text-faint hover:text-(--accent)"
        >
          전체 보기 →
        </Link>
      </header>

      <ol className="lg:py-1.5">
        {shelf.items.map((item) => (
          <li key={item.slug} className="border-edge border-b last:border-b-0 lg:border-b-0">
            {item.current ? (
              <span
                aria-current="page"
                className={cn(
                  ROW,
                  "bg-(--accent)/7 pl-3 shadow-[inset_2px_0_0_var(--accent)] lg:pl-[18px]",
                )}
              >
                <RowBody item={item} current />
                <span className="hidden font-typewriter text-(--accent) text-[10.5px] lg:inline">
                  ← 지금
                </span>
              </span>
            ) : (
              <Link
                href={postHref(item.type, item.slug, siteOf(item.type))}
                className={cn(ROW, "group lg:hover:bg-ink/4")}
              >
                <RowBody item={item} />
                <span
                  aria-hidden
                  className="hidden text-faint transition-transform duration-200 ease-(--ease-record) group-hover:translate-x-[3px] group-hover:text-(--accent) lg:inline"
                >
                  →
                </span>
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** 좁은 화면은 세로 덩이, 넓은 화면은 번호 · 제목 · 끝 표시 세 칸 */
const ROW = cn(
  "flex flex-col gap-1.5 py-4",
  "lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-baseline lg:gap-3 lg:px-[18px] lg:py-[9px]",
);

function RowBody({ item, current = false }: { item: ShelfPost; current?: boolean }) {
  const number = formatCallNumber({ type: item.type, callNumber: item.callNumber });
  const date = formatDate(item.publishedAt);

  return (
    <>
      <span
        className={cn(
          "hidden font-typewriter text-[11px] lg:inline",
          current ? "text-(--accent)" : "text-faint",
        )}
      >
        {number}
      </span>

      <span className="flex min-w-0 flex-col gap-1.5">
        <span
          className={cn(
            "line-clamp-2 font-bold text-[15.5px] text-ink leading-normal",
            "lg:line-clamp-none lg:text-sm",
            current
              ? "lg:font-semibold"
              : "lg:font-normal lg:text-ink-soft lg:group-hover:text-ink",
          )}
        >
          {item.title}
        </span>
        {item.excerpt && (
          <span className="line-clamp-2 text-[13px] text-faint leading-[1.65] lg:hidden">
            {item.excerpt}
          </span>
        )}
      </span>

      {/* 날짜는 좁은 화면에서만 — 넓은 화면의 한 줄에는 번호가 그 자리를 맡는다 */}
      <span className="flex gap-2 font-typewriter text-[11px] text-faint lg:hidden">
        {date && <span>{date}</span>}
        {current && <span className="text-(--accent)">· 지금 읽는 글</span>}
      </span>
    </>
  );
}

/**
 * 떠오르는 이전 글 · 다음 글 — **넓은 화면에서만.**
 *
 * 본문 끝 무렵(스크롤 72~82%)에 아래 양쪽 모서리에서 올라온다. 티스토리처럼 이전은 왼쪽,
 * 다음은 오른쪽이고 각자 ✕로 닫는다. 닫은 것은 그 지면에서만 유지된다 — 다른 글로 가면
 * 다시 나온다(기억하려면 스크립트가 필요하다).
 *
 * 좁은 화면에서는 띄우지 않는다. 화면 아래를 가리고, 바로 위 목록 덩이가 같은 일을 한다.
 * 스크롤 타임라인을 모르는 브라우저(Firefox)에서도 나오지 않는다 — 목록이 남으므로 잃는 것이
 * 없다. 생김새·등장·닫기는 globals.css `.shelf-float`.
 */
function FloatingNeighbors({
  previous,
  next,
  axisLabel,
}: {
  previous: ShelfPost | null;
  next: ShelfPost | null;
  axisLabel: string;
}) {
  if (!previous && !next) return null;

  return (
    <nav aria-label="이전 글 다음 글">
      {previous && <FloatingCard post={previous} side="left" kicker={`← ${axisLabel} · 이전 글`} />}
      {next && <FloatingCard post={next} side="right" kicker={`${axisLabel} · 다음 글 →`} />}
    </nav>
  );
}

function FloatingCard({
  post,
  side,
  kicker,
}: {
  post: ShelfPost;
  side: "left" | "right";
  kicker: string;
}) {
  // 두 장이 한 지면에 같이 서므로 방향으로 이름을 가른다
  const id = `shelf-float-${side}`;
  const date = formatDate(post.publishedAt);

  return (
    <>
      <input
        id={id}
        type="checkbox"
        className="shelf-dismiss sr-only"
        aria-label={`${side === "left" ? "이전" : "다음"} 글 카드 닫기`}
      />
      <div className={cn("shelf-float", side === "left" ? "left-4" : "right-4")}>
        <Link
          href={postHref(post.type, post.slug, siteOf(post.type))}
          rel={side === "left" ? "prev" : "next"}
          className={cn(
            "group block py-3",
            side === "left" ? "pr-10 pl-4" : "pr-4 pl-10 text-right",
          )}
        >
          <span className="block font-typewriter text-[10.5px] text-faint">{kicker}</span>
          <span className="mt-1 line-clamp-2 text-[13.5px] text-ink leading-normal group-hover:text-(--accent)">
            {post.title}
          </span>
          {date && (
            <span className="mt-1 block font-typewriter text-[10.5px] text-faint">{date}</span>
          )}
        </Link>
        {/* 오른쪽 카드는 ✕를 안쪽(왼쪽) 모서리에 둔다 — 화면 끝 모서리는 스크롤바와 붙는다 */}
        <label
          htmlFor={id}
          title="닫기"
          className={cn(
            "shelf-x absolute top-1.5 grid size-6 cursor-pointer place-items-center border border-transparent text-[11px] text-faint transition-colors duration-150 hover:border-edge-strong hover:text-ink",
            side === "left" ? "right-1.5" : "left-1.5",
          )}
        >
          <span aria-hidden>✕</span>
        </label>
      </div>
    </>
  );
}

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}
