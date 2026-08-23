import Link from "next/link";

/**
 * 페이지네이션 (02 §2.2·§2.3). 링크뿐이다 — 공개 페이지에 JS를 늘리지 않는다(04 §3.6).
 * 한 페이지뿐이면 놓지 않는다.
 */
export function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="페이지" className="flex items-center justify-center gap-4 pt-2">
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          rel="prev"
          className="font-typewriter text-[11px] text-faint hover:text-ink"
        >
          ← 이전
        </Link>
      ) : (
        <span className="font-typewriter text-[11px] text-faint opacity-40">← 이전</span>
      )}

      <span className="font-typewriter text-[11px] text-ink-soft">
        {page} / {pageCount}
      </span>

      {page < pageCount ? (
        <Link
          href={hrefFor(page + 1)}
          rel="next"
          className="font-typewriter text-[11px] text-faint hover:text-ink"
        >
          다음 →
        </Link>
      ) : (
        <span className="font-typewriter text-[11px] text-faint opacity-40">다음 →</span>
      )}
    </nav>
  );
}
