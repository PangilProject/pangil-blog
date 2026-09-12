"use client";

import { useEffect, useState } from "react";

import type { RichTextHeading } from "@/lib/render/richText";
import { cn } from "@/lib/utils";

/**
 * 기술 글 목차 (04 §3.4) — "책 여백의 메모".
 *
 * 위치 확정: **데스크탑은 우측 여백 sticky, 모바일은 본문 상단 접이식.**
 * 현재 섹션 하이라이트가 아일랜드 4개 중 하나다(04 §3.6) — 목록 자체는 서버가 보낸 데이터로
 * 그리고, 이 컴포넌트는 스크롤에 따라 어디를 읽고 있는지만 표시한다.
 *
 * 제목이 하나뿐이면 목차를 놓지 않는다. 항목 한 줄짜리 목차는 지면만 먹는다.
 */
export function Toc({ headings }: { headings: RichTextHeading[] }) {
  const [activeId, setActiveId] = useState<string | null>(headings[0]?.id ?? null);

  useEffect(() => {
    if (headings.length === 0) return;

    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => element !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 화면에 걸린 것 중 가장 위를 현재로 본다 — 아래로 읽어 내려가는 흐름에 맞다
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]) setActiveId(visible[0].target.id);
      },
      /**
       * 제목이 화면 상단 근처에 왔을 때를 "읽는 중"으로 본다.
       *
       * **위쪽 여백은 0이어야 한다.** `-10%`였을 때 띠가 화면의 10~30% 구간이었는데, 목차를
       * 누르면 그 제목이 화면 **맨 위(0%)** 로 올라간다 — 띠 밖이라 관찰자가 못 보고,
       * 대신 띠에 들어온 **다음** 제목이 활성으로 잡혔다. 눌렀는데 다른 줄에 불이 들어왔다.
       */
      { rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  const list = (
    <ol className="flex flex-col gap-1.5">
      {headings.map((heading) => (
        <li key={heading.id} className={heading.level === 3 ? "pl-3" : undefined}>
          <a
            href={`#${heading.id}`}
            /**
             * 누른 줄을 **즉시** 활성으로 만든다. 관찰자만 믿으면 두 경우가 새는다 —
             * 스크롤이 끝나기 전의 짧은 사이, 그리고 **글 끝 제목**이다. 마지막 제목은
             * 아래에 남은 지면이 없어 아무리 눌러도 띠까지 올라오지 못한다.
             */
            onClick={() => setActiveId(heading.id)}
            aria-current={activeId === heading.id ? "location" : undefined}
            className={cn(
              "block text-[12px] leading-[1.5] transition-colors duration-150",
              activeId === heading.id ? "text-(--accent)" : "text-faint hover:text-ink-soft",
            )}
          >
            {heading.text}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      {/* 모바일: 본문 위 접이식 */}
      <details className="mb-6 border border-edge bg-card px-4 py-3 lg:hidden">
        <summary className="cursor-pointer font-typewriter text-[11px] text-faint">목차</summary>
        <div className="mt-3">{list}</div>
      </details>

      {/* 데스크탑: 우측 여백 sticky */}
      <nav
        aria-label="목차"
        // sticky는 이 요소가 아니라 바깥 flex 아이템에 걸린다(지면 라우트) — 여기 걸면 부모가
        // 이 높이만큼만 커서 붙을 자리가 없다.
        //
        // **폭이 여기 있다.** 지면 라우트가 들고 있으면 제목이 하나뿐이라 목차를 안 그릴 때도
        // 13rem이 비어 있었다. 접는 손잡이는 헤더에 있다(SiteHeader)
        className="hidden border-edge border-l pl-4 lg:block lg:w-[13rem]"
      >
        <p className="mb-2.5 font-typewriter text-[10.5px] tracking-[0.14em] text-faint">목차</p>
        {list}
      </nav>
    </>
  );
}
