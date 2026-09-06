import { RichTextBody } from "@/components/public/RichTextBody";
import { ScriptureBlock } from "@/components/record/ScriptureBlock";
import type { PostContent } from "@/lib/content/schema";
import { toScriptureVerses } from "@/lib/record/scriptureVerses";

/**
 * F-03 설교 상세 (02 §2.3 · 03 §5.2).
 * 제목·말씀 인용 블록·본문·요약. 요약은 예배 후 선택이므로 없으면 자리도 만들지 않는다.
 *
 * 설교 제목은 말씀 블록 바로 위에 선다(02 §5.3). 글 제목과 떨어져 있어 메타가 아니라 글의
 * 일부처럼 읽힌다 — 실제로 그렇다. 이관해 온 글에는 없으므로 없으면 자리도 만들지 않는다.
 */
export function SermonView({ content }: { content: Extract<PostContent, { kind: "SERMON" }> }) {
  return (
    <>
      {content.sermonTitle && (
        <p className="font-serif font-bold text-[17px] leading-body">{content.sermonTitle}</p>
      )}

      {/*
        **큐티와 같은 길로 쪼갠다.** 전에는 본문 문자열을 통째로 넘겼는데, 그러면 줄바꿈이
        HTML에서 공백으로 접혀 **절이 한 줄로 이어져 나왔다.** 조판은 둘 다 같은 모양이어야
        하고(03 §5.2), 그 규칙은 이미 `toScriptureVerses`에 있었다 — 설교만 안 쓰고 있었다.
      */}
      <ScriptureBlock
        variant="sermon"
        reference={content.scriptureRef}
        verses={toScriptureVerses(content.scriptureBody)}
      />

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
