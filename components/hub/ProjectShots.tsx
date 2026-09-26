import Image from "next/image";
import type { CSSProperties } from "react";

import type { ProjectShot } from "@/lib/site/projectContent";

/**
 * 작업물 화면 캐러셀 (H-03 · H-04 · ADR-005).
 *
 * **클라이언트 코드가 없다.** 숨긴 라디오 한 무리가 "몇 번째 장인가"를 들고, 화살표와
 * 썸네일은 그 라디오를 가리키는 `<label>`이다 — 사이드바 접기를 푼 것과 같은 수법이다
 * (04 §3.6). 자동 전환도 CSS다: **아무 라디오도 안 켜져 있는 동안만** 애니메이션이 돌고,
 * 손이 닿는 순간(`:has(input:checked)`) 멈춘 뒤 다시 켜지지 않는다. 규칙은 globals.css의
 * `[data-shots]`에 있다.
 *
 * 그래서 첫 장에 `defaultChecked`를 주지 않는다 — 주면 자동 전환이 시작부터 꺼진다.
 *
 * **장 번호는 칸 안에 있다.** 밖에 한 벌 두고 `:checked`로 갈아 끼우면 자동 전환 중에는
 * 켜진 라디오가 없어 아무 숫자도 못 쓴다. 칸에 넣으면 번호가 칸과 함께 움직이므로
 * 자동이든 손이든 항상 맞다.
 */

/** 목록은 작게, 상세는 크게. 둘은 크기만 다르고 도는 방식이 같다 */
export type ProjectShotsVariant = "detail" | "list";

export function ProjectShots({
  slug,
  shots,
  variant = "detail",
}: {
  slug: string;
  shots: ProjectShot[];
  variant?: ProjectShotsVariant;
}) {
  if (shots.length === 0) return null;

  const many = shots.length > 1;
  const list = variant === "list";
  const id = (index: number) => `${slug}-${variant}-shot-${index}`;

  const arrow = list
    ? "size-7 text-[11px] opacity-0 transition-opacity group-hover/shots:opacity-100 focus-visible:opacity-100"
    : "size-9 text-[13px]";

  return (
    /*
      `fieldset`인 이유: 라디오 한 무리에 이름을 붙이는 자리가 원래 여기다. `div`에
      `role="radiogroup"`을 얹으면 한 장뿐일 때 라디오 없는 라디오 무리가 되고,
      조건부로 붙이면 정적 검사가 `aria-label`을 지원하지 않는 요소로 읽는다.
      `legend`는 `input`이 아니라 `nth-of-type` 셈에 끼어들지 않는다.
    */
    <fieldset
      data-shots
      data-shot-n={shots.length}
      style={{ "--shot-last": shots.length - 1 } as CSSProperties}
      className="group/shots flex min-w-0 flex-col gap-3"
    >
      <legend className="sr-only">화면</legend>

      {many &&
        shots.map((shot, index) => (
          <input
            key={shot.src}
            id={id(index)}
            name={`${slug}-${variant}-shot`}
            type="radio"
            className="sr-only"
            aria-label={`${index + 1}번째 화면`}
          />
        ))}

      {/* 무대. 넘치는 쪽을 잘라 한 장만 세운다 */}
      <div className="relative overflow-hidden border border-line has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-site-accent has-[:focus-visible]:outline-offset-2">
        <ul data-shot-track>
          {shots.map((shot, index) => (
            <li key={shot.src} data-shot-slide>
              <Image
                src={shot.src}
                alt={shot.alt}
                width={shot.width}
                height={shot.height}
                className="h-auto w-full"
                sizes={list ? "(min-width: 640px) 260px, 88vw" : "(min-width: 1024px) 860px, 88vw"}
                priority={!list && index === 0}
              />

              {many && index > 0 && (
                <label
                  htmlFor={id(index - 1)}
                  className={`absolute top-1/2 left-2 flex -translate-y-1/2 cursor-pointer items-center justify-center border border-edge-strong bg-paper font-typewriter text-ink hover:bg-surface-sheet ${arrow}`}
                >
                  ←<span className="sr-only">이전 화면</span>
                </label>
              )}

              {many && index < shots.length - 1 && (
                <label
                  htmlFor={id(index + 1)}
                  className={`absolute top-1/2 right-2 flex -translate-y-1/2 cursor-pointer items-center justify-center border border-edge-strong bg-paper font-typewriter text-ink hover:bg-surface-sheet ${arrow}`}
                >
                  →<span className="sr-only">다음 화면</span>
                </label>
              )}

              {many && (
                <p className="absolute right-2 bottom-2 border border-edge-strong bg-paper px-1.5 py-0.5 font-typewriter text-[10px] text-ink-soft">
                  {index + 1} / {shots.length}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/*
        썸네일. 누르면 그 장으로 간다.

        **줄을 바꾸지 않고 옆으로 민다.** 열 장까지 받는데 줄바꿈을 두면 장수에 따라
        아래 글이 한 줄씩 밀려 내려가고, 그러면 같은 지면이 작업물마다 다른 높이로 선다.
      */}
      {many && !list && (
        <ul
          data-shot-thumbs
          className="-mx-[6%] flex snap-x gap-2 overflow-x-auto px-[6%] pb-1 lg:mx-0 lg:px-0"
        >
          {shots.map((shot, index) => (
            <li key={shot.src} className="shrink-0 snap-start">
              <label htmlFor={id(index)} data-shot-thumb className="block cursor-pointer border">
                <Image
                  src={shot.src}
                  alt=""
                  width={shot.width}
                  height={shot.height}
                  sizes="120px"
                  className="h-14 w-auto"
                />
              </label>
            </li>
          ))}
        </ul>
      )}

      {/* 설명은 장마다 다르므로 목록으로 둔다 — 넘길 때 같이 따라오면 글이 튄다 */}
      {!list && shots.some((shot) => shot.caption) && (
        <ol className="flex flex-col gap-1 font-typewriter text-[11px] text-faint">
          {shots.map((shot, index) =>
            shot.caption ? (
              <li key={shot.src}>
                {index + 1}. {shot.caption}
              </li>
            ) : null,
          )}
        </ol>
      )}
    </fieldset>
  );
}
