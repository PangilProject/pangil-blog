import { RichTextBody } from "@/components/public/RichTextBody";
import { AnnotationBox } from "@/components/record/AnnotationBox";
import { GroupTab } from "@/components/record/GroupTab";
import { ScriptureBlock } from "@/components/record/ScriptureBlock";
import type { PostContent } from "@/lib/content/schema";
import { toScriptureVerses } from "@/lib/record/scriptureVerses";

/**
 * F-03 큐티 상세 (02 §2.3 · 03 §5.2).
 *
 * 조판 규칙 그대로: 말씀 = 붉은 세로 괘 + 세리프 / 주석 = 점선 상자 / 질문 그룹 = 칸막이 탭.
 * 답변이 빈 질문은 **질문만** 남긴다 — 그날 일부만 쓴 것도 기록이고(02 §5.2), 빈 칸을
 * 지우면 무엇을 건너뛰었는지가 사라진다.
 */
export function QtView({ content }: { content: Extract<PostContent, { kind: "QT" }> }) {
  return (
    <>
      {/* 절 번호는 조판 요소다(03 §5.2) — 본문 문자열을 절로 나눠 번호를 세운다 */}
      <ScriptureBlock
        reference={content.scriptureRef}
        verses={toScriptureVerses(content.scriptureBody)}
      />

      {content.annotations.length > 0 && (
        <AnnotationBox
          annotations={content.annotations.map((annotation) => ({
            term: annotation.term,
            verseRef: annotation.verseRef ?? null,
            body: annotation.body,
          }))}
        />
      )}

      {content.questionGroups.map((group) => (
        <section key={group.group} className="flex flex-col">
          <GroupTab>{group.group}</GroupTab>

          <div className="flex flex-col gap-4 border border-edge bg-[#fffefa] px-[18px] py-4">
            {group.questions.map((question) => (
              <div key={question.label} className="flex flex-col gap-1.5">
                <p className="flex gap-2 font-bold text-[14px] leading-[1.7]">
                  <span className="flex-none font-typewriter text-[11px] text-(--accent)">
                    {question.label}.
                  </span>
                  {question.text}
                </p>
                <RichTextBody doc={question.answer} className="pl-[22px]" />
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="border-edge border-t pt-5">
        <h2 className="mb-2 font-serif font-bold text-[15px]">오늘의 요약</h2>
        <RichTextBody doc={content.summary} />
      </section>
    </>
  );
}
