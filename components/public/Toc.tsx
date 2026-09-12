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
      {/*
        모바일: 상단에 붙는 한 줄. **차례를 감추는 대신 지금 어디를 읽는지 말한다.**
        전에는 `목차`라고만 적힌 상자가 글 제목 위에 서 있었다 — 무슨 글인지 알기 전에 그
        글의 차례부터 보는 꼴이었고, 정작 차례가 필요한 순간(읽는 도중)에는 맨 위까지
        올라가야 닿았다.
        붙어 있으므로 읽는 내내 닿고, 값은 이미 관찰자가 들고 있던 것이다 — 여태 넓은
        화면에서만 쓰였다.
      */}
      {/*
        모바일: **평소에는 없다.** 상단 띠의 `목차`를 눌러야 이 판이 띠 아래로 내려온다.
        한동안 "지금 · <절>"을 적은 띠를 늘 띄워 두었는데, 이미 붙어 있는 띠 아래에 또
        하나가 겹치면서 바탕이 두 겹으로 보였다 — 지면이 종이 한 장으로 읽히지 않았다.

        지금 읽는 절은 판 안에서 그대로 표시된다(`aria-current`) — 읽다가 열면 어디쯤인지
        바로 보인다.

        `data-toc`는 **여기 목차가 있다**는 표식이다. 상단 띠는 이 표식을 보고 손잡이를
        내놓는다 — 제목이 하나뿐인 글에 눌러도 아무 일 없는 버튼을 남기지 않는다.
      */}
      <div
        data-toc
        className={cn(
          "hidden border-edge border-b bg-paper pt-4 pb-5 lg:hidden",
          /**
           * **화면 끝까지 채운다.** 이 판은 본문 통 안(좌우 6%)에 있어서 바탕이 그만큼 좁게
           * 깔렸는데, 같은 띠에서 내려오는 분류 판은 레이아웃에 있어 화면 끝까지 간다 —
           * 나란히 놓고 보면 목차만 여백이 뚫려 보였다.
           *
           * `50% - 50vw`로 통 밖까지 밀어낸다. 통의 절반과 화면의 절반 차이가 곧 그 6%라,
           * 숫자를 따로 적지 않아도 여백과 정확히 맞는다. 안쪽 여백은 vw로 되돌린다 —
           * 퍼센트로 적으면 통 너비를 기준으로 재서 띠의 글자와 어긋난다.
           */
          "mx-[calc(50%-50vw)] w-screen px-[6vw]",
          "group-has-[#panel-toc:checked]/site:block",
        )}
      >
        {list}
      </div>

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
