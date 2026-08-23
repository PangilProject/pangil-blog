import { RichTextBody } from "@/components/public/RichTextBody";
import { ScriptureBlock } from "@/components/record/ScriptureBlock";
import type { PostContent } from "@/lib/content/schema";

/**
 * F-03 설교 상세 (02 §2.3 · 03 §5.2).
 * 제목·말씀 인용 블록·본문·요약. 요약은 예배 후 선택이므로 없으면 자리도 만들지 않는다.
 */
export function SermonView({ content }: { content: Extract<PostContent, { kind: "SERMON" }> }) {
  return (
    <>
      <ScriptureBlock variant="sermon" reference={content.scriptureRef}>
        {content.scriptureBody}
      </ScriptureBlock>

      <RichTextBody doc={content.body} />

      {content.summary && (
        <section className="border-edge border-t pt-5">
          <h2 className="mb-2 font-serif font-bold text-[15px]">예배 후 요약</h2>
          <RichTextBody doc={content.summary} />
        </section>
      )}
    </>
  );
}
