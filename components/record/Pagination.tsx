import Link from "next/link";

import { pageWindow } from "@/lib/record/pageWindow";

/**
 * 페이지네이션 (02 §2.2·§2.3). 링크뿐이다 — 공개 페이지에 JS를 늘리지 않는다(04 §3.6).
 * 한 페이지뿐이면 놓지 않는다.
 *
 * 번호를 놓는 이유는 기술 지면이 43페이지이기 때문이다(514편÷12). 이전·다음만으로는
 * 뒤쪽으로 가는 길이 사실상 없다. 창은 5개로 고정하고(lib/record/pageWindow),
 * 창이 양 끝을 물지 않을 때만 `처음`·`끝`을 놓는다 — 이미 보이는 자리로 가는 링크를
 * 두 번 두지 않는다.
 *
 * 공개 목록과 관리자 글 관리가 함께 쓴다. 그래서 components/public이 아니라 여기 있다.
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

  const numbers = pageWindow(page, pageCount);
  const first = numbers[0] ?? 1;
  const last = numbers[numbers.length - 1] ?? pageCount;

  return (
    <nav aria-label="페이지" className="flex flex-wrap items-center justify-center gap-2 pt-2">
      {first > 1 && <Step href={hrefFor(1)}>처음</Step>}

      {page > 1 ? (
        <Step href={hrefFor(page - 1)} rel="prev">
          ← 이전
        </Step>
      ) : (
        <span className="px-1 font-typewriter text-[11px] text-faint opacity-40">← 이전</span>
      )}

      <ul className="flex items-center gap-1">
        {numbers.map((number) => (
          <li key={number}>
            {number === page ? (
              // 현재 페이지는 링크가 아니다 — 누를 데가 없어야 지금 어디인지가 분명하다
              <span
                aria-current="page"
                className="inline-block border border-edge bg-card px-2 py-0.5 font-typewriter text-[11px] text-(--accent)"
              >
                {number}
              </span>
            ) : (
              <Link
                href={hrefFor(number)}
                aria-label={`${number}페이지`}
                className="inline-block border border-transparent px-2 py-0.5 font-typewriter text-[11px] text-faint hover:border-edge hover:text-ink"
              >
                {number}
              </Link>
            )}
          </li>
        ))}
      </ul>

      {page < pageCount ? (
        <Step href={hrefFor(page + 1)} rel="next">
          다음 →
        </Step>
      ) : (
        <span className="px-1 font-typewriter text-[11px] text-faint opacity-40">다음 →</span>
      )}

      {last < pageCount && <Step href={hrefFor(pageCount)}>끝</Step>}
    </nav>
  );
}

function Step({ href, rel, children }: { href: string; rel?: "prev" | "next"; children: string }) {
  return (
    <Link
      href={href}
      rel={rel}
      className="px-1 font-typewriter text-[11px] text-faint hover:text-ink"
    >
      {children}
    </Link>
  );
}
