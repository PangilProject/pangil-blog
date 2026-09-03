import { type PostContent, praiseMeditationBlocks } from "@/lib/content/schema";
import type { ExportPost } from "@/lib/db/publicPosts";
import { formatCallNumber } from "@/lib/record/callNumber";
import { tiptapToMarkdown } from "@/lib/render/markdown";

/**
 * 글 하나를 마크다운 파일로 (07 M3 · §3 lock-in 방어).
 *
 * 프론트매터에는 **다시 만들 수 없는 것**만 넣는다: 언제 썼는지, 청구기호, 분류. 조판은 본문
 * 마크다운이 담고, 나머지는 이 블로그의 사정이다.
 *
 * 타입별 구조(큐티 질문, 찬양 섹션)는 마크다운의 제목·인용·목록으로 편다. 구조를 JSON으로
 * 덧붙이지 않는다 — 내보낸 파일은 **다른 도구에서 읽히는 것**이 목적이고, 우리 스키마를
 * 이해하는 도구는 없다.
 */

function escapeYaml(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function frontMatter(post: ExportPost): string {
  const lines = [
    `title: ${escapeYaml(post.title)}`,
    `slug: ${escapeYaml(post.slug)}`,
    `type: ${post.type}`,
  ];

  const callNumber = formatCallNumber({ type: post.type, callNumber: post.callNumber });
  if (callNumber) lines.push(`call_number: ${escapeYaml(callNumber)}`);
  if (post.publishedAt) lines.push(`date: ${post.publishedAt.toISOString()}`);
  if (post.categorySlug) lines.push(`category: ${escapeYaml(post.categorySlug)}`);
  if (post.tags.length > 0) {
    lines.push(`tags: [${post.tags.map(escapeYaml).join(", ")}]`);
  }
  if (post.excerpt) lines.push(`excerpt: ${escapeYaml(post.excerpt)}`);

  return `---\n${lines.join("\n")}\n---`;
}

/** 큐티·설교·찬양·기술의 구조를 마크다운 문법으로 편다 */
function body(content: PostContent): string {
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
      const meditation = praiseMeditationBlocks(content.meditationAndPrayer)
        .map((block) => tiptapToMarkdown(block))
        .filter((text) => text !== "")
        .join("\n\n");
      if (meditation) parts.push("## 묵상과 기도", meditation);

      return parts.join("\n\n");
    }

    case "TECH":
      return tiptapToMarkdown(content.body);
  }
}

export type MarkdownFile = { name: string; text: string };

export function toMarkdownFile(post: ExportPost): MarkdownFile {
  const date = post.publishedAt ? post.publishedAt.toISOString().slice(0, 10) : "draft";

  // 날짜를 앞에 붙여 파일 목록이 곧 연대기가 된다
  const name = `${date}-${post.slug}.md`;

  const text = post.content.ok
    ? `${frontMatter(post)}\n\n${body(post.content.content)}\n`
    : // 스키마를 통과하지 못한 글도 내보낸다. 내용을 잃는 것보다 조판을 잃는 편이 낫다
      `${frontMatter(post)}\n\n<!-- 조판을 복원하지 못한 기록입니다. 원문 JSON을 남깁니다. -->\n\n\`\`\`json\n${JSON.stringify(post.content.raw, null, 2)}\n\`\`\`\n`;

  return { name, text };
}
