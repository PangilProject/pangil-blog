import { type PostContent, praiseMeditationBlocks } from "@/lib/content/schema";
import { tiptapToMarkdown } from "@/lib/render/markdown";

/**
 * 글 하나를 마크다운 본문으로 (04 §3.1 마크다운 타깃).
 *
 * 타입별 구조(큐티 질문, 찬양 섹션)를 마크다운의 제목·인용·목록으로 편다. 구조를 JSON으로
 * 덧붙이지 않는다 — 이 글자는 **다른 도구에서 읽히는 것**이 목적이고, 우리 스키마를
 * 이해하는 도구는 없다.
 *
 * 두 곳이 쓴다: 내보내기 파일(07 §3)과 에디터의 전체 복사. 조판을 두 벌 적으면 한쪽만
 * 고쳐지고, 그러면 "내보낸 파일과 복사한 글자가 다르다"가 된다.
 */
export function postToMarkdown(content: PostContent): string {
  switch (content.kind) {
    case "QT": {
      const parts = [`> **${content.scriptureRef}**\n>\n> ${content.scriptureBody}`];

      if (content.annotations.length > 0) {
        parts.push(
          content.annotations
            .map(
              (annotation) =>
                `- **${annotation.term}**${annotation.verseRef ? ` (${annotation.verseRef})` : ""} — ${annotation.body}`,
            )
            .join("\n"),
        );
      }

      for (const group of content.questionGroups) {
        parts.push(`## ${group.group}`);
        for (const question of group.questions) {
          parts.push(`**${question.label}. ${question.text}**`);
          const answer = tiptapToMarkdown(question.answer);
          // 답을 안 쓴 질문도 남긴다 — 무엇을 건너뛰었는지가 기록이다(02 §5.2)
          if (answer) parts.push(answer);
        }
      }

      const summary = tiptapToMarkdown(content.summary);
      if (summary) parts.push(`## 오늘의 요약`, summary);

      return parts.join("\n\n");
    }

    case "SERMON": {
      const parts = [
        `> **${content.scriptureRef}**\n>\n> ${content.scriptureBody}`,
        tiptapToMarkdown(content.body),
      ];

      const summary = tiptapToMarkdown(content.summary);
      if (summary) parts.push("## 예배 후 요약", summary);

      return parts.filter(Boolean).join("\n\n");
    }

    case "PRAISE": {
      const parts = [content.youtubeUrl];

      for (const section of content.sections) {
        const label = typeof section.label === "string" ? section.label : section.label.custom;
        parts.push(`### ${label}`);
        if (section.lyrics) parts.push(section.lyrics);
      }

      // 블록 사이는 빈 줄로 끊는다 — 마크다운에서 문단이 갈리는 유일한 표시다
      // 감춘 블록도 담는다. 어느 덩이가 안 나갔는지는 앞에 적어 둔다
      const meditation = praiseMeditationBlocks(content.meditationAndPrayer)
        .map((block) => {
          const text = tiptapToMarkdown(block.doc);
          return text !== "" && block.hidden ? `*(숨김)* ${text}` : text;
        })
        .filter((text) => text !== "")
        .join("\n\n");
      if (meditation) parts.push("## 묵상과 기도", meditation);

      return parts.join("\n\n");
    }

    case "TECH":
      return tiptapToMarkdown(content.body);
  }
}
