"use client";

import { useState } from "react";

import { youtubeEmbedUrl } from "@/lib/praise/youtube";

/**
 * YouTube lite 임베드 — 공개 지면 아일랜드 4개 중 하나 (04 §3.6).
 *
 * **클릭 전에는 iframe을 심지 않는다.** 유튜브 임베드는 200KB가 넘는 스크립트와 쿠키를
 * 끌고 오는데, 찬양 지면을 열자마자 그걸 다 받을 이유가 없다. 클릭 전에는 썸네일 한 장이고,
 * 누르면 그 자리에서 재생된다.
 *
 * JS가 없거나 아직 로드되지 않았어도 링크로 동작한다 — 감싼 요소가 `<a>`이고, 클릭 핸들러가
 * 기본 동작을 막은 뒤 자리를 바꾼다. 재생이 안 되는 것보다 유튜브로 가는 편이 낫다.
 */
export function YouTubeLite({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <iframe
        // autoplay는 사용자가 방금 누른 결과다 — 자동 재생이 아니다
        src={`${youtubeEmbedUrl(videoId)}?autoplay=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        allowFullScreen
        className="aspect-video w-full border border-edge bg-ink"
      />
    );
  }

  return (
    <a
      href={`https://www.youtube.com/watch?v=${videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        // 새 창·중클릭은 그대로 유튜브로 보낸다 — 그렇게 열려던 사람의 의도를 가로채지 않는다
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        setPlaying(true);
      }}
      aria-label={`${title} 재생`}
      className="group relative block border border-edge"
    >
      {/* biome-ignore lint/performance/noImgElement: 외부 썸네일 — next/image 전환은 이미지 업로드와 함께 */}
      <img
        src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        className="aspect-video w-full object-cover"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="border border-card/40 bg-ink/70 px-3.5 py-2 font-typewriter text-[12px] text-card transition-transform duration-200 ease-record group-hover:scale-105">
          ▶ 재생
        </span>
      </span>
    </a>
  );
}
