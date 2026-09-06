import { SectionBlock } from "@/components/editor/SectionBlock";
import { RichTextBody } from "@/components/public/RichTextBody";
import { YouTubeLite } from "@/components/public/YouTubeLite";
import { type PostContent, praiseMeditationBlocks } from "@/lib/content/schema";
import { sectionOrdinals } from "@/lib/editor/praiseForm";
import { parseYouTubeId } from "@/lib/praise/youtube";

/**
 * F-03 찬양 상세 (02 §2.3 · 03 §5.2).
 *
 * 섹션 라벨(타자기) + 가사(세리프) + 묵상과 기도. Verse 번호는 저장값이 아니라 파생 계산이다
 * (04 §2.5) — 에디터와 **같은 함수**를 쓴다. 전에는 규칙을 여기에 한 벌 더 적어 뒀는데,
 * 되풀이되는 절의 번호를 고칠 때 한쪽만 고쳐질 자리였다.
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

  // 번호 매기는 규칙은 에디터와 한 곳에서 나온다. 여기서 다시 세면 두 화면이 어긋난다
  const ordinals = sectionOrdinals(
    content.sections.map((section) => ({
      label: typeof section.label === "string" ? section.label : section.label.custom,
      lyrics: section.lyrics,
    })),
  );

  return (
    <>
      {videoId && <YouTubeLite videoId={videoId} title={title} />}

      <div className="flex flex-col gap-2.5">
        {content.sections.map((section, index) => {
          const label = typeof section.label === "string" ? section.label : section.label.custom;

          return (
            <SectionBlock
              key={section.id}
              label={label}
              ordinal={ordinals[index]}
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
        {/* 블록은 쓰는 사람이 끊어둔 자리다. 여백으로만 나눈다 — 소제목이 없는 덩이에
            구분선을 그으면 없는 절이 생긴다 */}
        <div className="flex flex-col gap-4">
          {praiseMeditationBlocks(content.meditationAndPrayer).map((block, index) => (
            // 블록에는 id가 없다. 순서가 곧 자리이고, 이 목록은 다시 정렬되지 않는다
            // biome-ignore lint/suspicious/noArrayIndexKey: 순서가 유일한 식별자다
            <RichTextBody key={index} doc={block} />
          ))}
        </div>
      </section>
    </>
  );
}
