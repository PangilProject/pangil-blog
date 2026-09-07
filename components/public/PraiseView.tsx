import { SectionBlock } from "@/components/editor/SectionBlock";
import { CopyButton } from "@/components/public/CopyButton";
import {
  HiddenMeditationBlocks,
  MeditationCopyButton,
  OwnerMeditation,
} from "@/components/public/OwnerMeditation";
import { RichTextBody } from "@/components/public/RichTextBody";
import { YouTubeLite } from "@/components/public/YouTubeLite";
import { loadHiddenMeditation } from "@/lib/actions/praise";
import { type PostContent, praiseMeditationBlocks } from "@/lib/content/schema";
import { sectionOrdinals } from "@/lib/editor/praiseForm";
import { parseYouTubeId } from "@/lib/praise/youtube";
import { tiptapToCopyText } from "@/lib/render/plainText";

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
  postId,
}: {
  content: Extract<PostContent, { kind: "PRAISE" }>;
  /** 감춘 덩이를 본인이 볼 때 따로 받아 오는 데 쓴다(OwnerMeditation) */
  postId: string;
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

  const blocks = praiseMeditationBlocks(content.meditationAndPrayer);
  const meditation = blocks.filter((block) => !block.hidden);
  const hasHidden = blocks.some((block) => block.hidden);

  /**
   * 복사용 평문. 문단이 곧 의미라 줄바꿈을 살리고(`tiptapToCopyText`) 덩이 사이는 빈 줄로
   * 끊는다 — 에디터에서 끊어둔 자리가 붙여넣은 곳에서도 그대로 남는다.
   */
  const copyText = meditation
    .map((block) => tiptapToCopyText(block.doc))
    .filter((text) => text !== "")
    .join("\n\n");

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

      {/*
        묵상 절은 **감춘 덩이만 있는 글에서도** 세운다. 본인이 보면 그 덩이가 나오기
        때문이다 — 공개된 덩이가 없다고 절을 지우면 내 지면에서 그 글이 사라진다.
      */}
      {(meditation.length > 0 || hasHidden) && (
        <OwnerMeditation postId={postId} load={loadHiddenMeditation}>
          <section className="border-edge border-t pt-5">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-serif font-bold text-[15px]">묵상과 기도</h2>
              {/* 읽는 사람에게는 공개된 글자만, 본인에게는 감춘 덩이까지 */}
              <MeditationCopyButton publicText={copyText} />
            </div>

            {/* 블록은 쓰는 사람이 끊어둔 자리다. 여백으로만 나눈다 — 소제목이 없는 덩이에
                구분선을 그으면 없는 절이 생긴다 */}
            <div className="flex flex-col gap-4">
              {meditation.map((block, index) => (
                // 블록에는 id가 없다. 순서가 곧 자리이고, 이 목록은 다시 정렬되지 않는다
                // biome-ignore lint/suspicious/noArrayIndexKey: 순서가 유일한 식별자다
                <div key={index} className="flex flex-col gap-1.5">
                  {/* 덩이마다 복사한다 — 묵상 한 덩이, 기도 한 덩이가 따로 옮겨진다.
                      끊어 쓴 자리가 곧 복사 단위다 */}
                  <div className="flex justify-end">
                    <CopyButton
                      text={tiptapToCopyText(block.doc)}
                      label={`묵상과 기도 ${index + 1} 복사`}
                    />
                  </div>
                  <RichTextBody doc={block.doc} />
                </div>
              ))}
            </div>

            <HiddenMeditationBlocks />
          </section>
        </OwnerMeditation>
      )}
    </>
  );
}
