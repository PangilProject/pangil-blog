import { SectionBlock } from "@/components/editor/SectionBlock";
import { RichTextBody } from "@/components/public/RichTextBody";
import { YouTubeLite } from "@/components/public/YouTubeLite";
import type { PostContent } from "@/lib/content/schema";
import { parseYouTubeId } from "@/lib/praise/youtube";

/**
 * F-03 찬양 상세 (02 §2.3 · 03 §5.2).
 *
 * 섹션 라벨(타자기) + 가사(세리프) + 묵상과 기도. Verse 번호는 저장값이 아니라 파생 계산이다
 * (04 §2.5) — 에디터와 같은 규칙을 쓴다.
 *
 * 영상은 클릭 전에는 썸네일 한 장이고, 누르면 그 자리에서 재생된다(04 §3.6 YouTube lite).
 * 지면을 열자마자 유튜브 스크립트를 받지 않는다.
 */
export function PraiseView({
  content,
  title,
}: {
  content: Extract<PostContent, { kind: "PRAISE" }>;
  /** 임베드의 접근성 이름에 쓴다 — URL을 읽어주면 아무 도움이 안 된다 */
  title: string;
}) {
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
      {videoId && <YouTubeLite videoId={videoId} title={title} />}

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
              // 공개 지면에는 에디터 안내 문구를 두지 않는다 — 빈 섹션은 연주 구간이고
              // "가사를 적어보세요"는 읽는 사람에게 할 말이 아니다
              emptyLabel={null}
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
