import { SectionBlock } from "@/components/editor/SectionBlock";
import { RichTextBody } from "@/components/public/RichTextBody";
import type { PostContent } from "@/lib/content/schema";
import { parseYouTubeId } from "@/lib/praise/youtube";

/**
 * F-03 찬양 상세 (02 §2.3 · 03 §5.2).
 *
 * 섹션 라벨(타자기) + 가사(세리프) + 묵상과 기도. Verse 번호는 저장값이 아니라 파생 계산이다
 * (04 §2.5) — 에디터와 같은 규칙을 쓴다.
 *
 * 영상은 지금 **썸네일 링크**다. 클릭 전 iframe을 심지 않는 것이 아일랜드 예산(04 §3.6)의
 * YouTube lite 방침이고, 클릭 후 재생까지는 M3 슬라이스 5에서 붙인다. 그때까지도 영상으로
 * 가는 길은 끊기지 않는다.
 */
export function PraiseView({ content }: { content: Extract<PostContent, { kind: "PRAISE" }> }) {
  const videoId = parseYouTubeId(content.youtubeUrl);

  const labels = content.sections.map((section) =>
    typeof section.label === "string" ? section.label : section.label.custom,
  );
  const totals = labels.reduce<Map<string, number>>(
    (map, label) => map.set(label, (map.get(label) ?? 0) + 1),
    new Map(),
  );
  const seen = new Map<string, number>();

  return (
    <>
      {videoId && (
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative block border border-edge"
        >
          {/* biome-ignore lint/performance/noImgElement: 외부 썸네일 — next/image 전환은 M3 슬라이스 5 */}
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt="찬양 영상 썸네일"
            loading="lazy"
            className="aspect-video w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="border border-card/40 bg-ink/70 px-3 py-1.5 font-typewriter text-[11px] text-card transition-transform duration-200 ease-record group-hover:scale-105">
              ▶ 유튜브에서 듣기
            </span>
          </span>
        </a>
      )}

      <div className="flex flex-col gap-2.5">
        {content.sections.map((section, index) => {
          const label = labels[index] ?? "";
          const next = (seen.get(label) ?? 0) + 1;
          seen.set(label, next);

          return (
            <SectionBlock
              key={section.id}
              label={label}
              ordinal={(totals.get(label) ?? 0) > 1 ? next : undefined}
              lyrics={section.lyrics}
            />
          );
        })}
      </div>

      <section className="border-edge border-t pt-5">
        <h2 className="mb-2 font-serif font-bold text-[15px]">묵상과 기도</h2>
        <RichTextBody doc={content.meditationAndPrayer} />
      </section>
    </>
  );
}
