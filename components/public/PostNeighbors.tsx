import Link from "next/link";

import type { PostNeighbor } from "@/lib/db/publicPosts";
import { siteOf } from "@/lib/revalidate/tags";
import { postHref } from "@/lib/site/publicUrl";

/**
 * 이전글·다음글 (F-03). 정적 링크 둘이다.
 *
 * 축 라벨을 함께 적는다 — 왜 이 글이 앞뒤인지가 화면에서 설명돼야 한다. 라벨이 없으면
 * "설교를 읽었는데 왜 찬양이 다음글인가"를 읽는 사람이 혼자 추측한다.
 *
 * 한쪽이 없으면 그 자리를 비운다. 없는 방향에 회색 글씨를 놓아 봤자 누를 수 없는 것이
 * 하나 늘어난다 — 첫 글과 마지막 글에서는 원래 갈 곳이 없다.
 */
export function PostNeighbors({
  previous,
  next,
  axisLabel,
}: {
  previous: PostNeighbor | null;
  next: PostNeighbor | null;
  /** "설교" · "FE" 처럼 지금 잇고 있는 축의 이름 */
  axisLabel: string;
}) {
  if (!previous && !next) return null;

  return (
    <nav
      aria-label="이전 글 다음 글"
      className="grid gap-4 border-edge border-t pt-5 sm:grid-cols-2"
    >
      {previous ? (
        <Link
          href={postHref(previous.type, previous.slug, siteOf(previous.type))}
          rel="prev"
          className="group"
        >
          <span className="block font-typewriter text-[10.5px] text-faint">
            ← {axisLabel} · 이전 글
          </span>
          <span className="mt-1 block font-serif text-sm text-ink-soft group-hover:text-ink">
            {previous.title}
          </span>
        </Link>
      ) : (
        <span />
      )}

      {next && (
        <Link
          href={postHref(next.type, next.slug, siteOf(next.type))}
          rel="next"
          className="group sm:text-right"
        >
          <span className="block font-typewriter text-[10.5px] text-faint">
            {axisLabel} · 다음 글 →
          </span>
          <span className="mt-1 block font-serif text-sm text-ink-soft group-hover:text-ink">
            {next.title}
          </span>
        </Link>
      )}
    </nav>
  );
}
