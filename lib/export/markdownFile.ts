import type { ExportPost } from "@/lib/db/publicPosts";
import { formatCallNumber } from "@/lib/record/callNumber";
import { postToMarkdown } from "@/lib/render/postText";

/**
 * 글 하나를 마크다운 파일로 (07 M3 · §3 lock-in 방어).
 *
 * 프론트매터에는 **다시 만들 수 없는 것**만 넣는다: 언제 썼는지, 청구기호, 분류. 조판은 본문
 * 마크다운이 담고, 나머지는 이 블로그의 사정이다.
 *
 * 타입별 구조를 마크다운으로 펴는 일은 `postToMarkdown`이 한다 — 에디터의 전체 복사도
 * 같은 함수를 쓴다.
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

export type MarkdownFile = { name: string; text: string };

export function toMarkdownFile(post: ExportPost): MarkdownFile {
  const date = post.publishedAt ? post.publishedAt.toISOString().slice(0, 10) : "draft";

  // 날짜를 앞에 붙여 파일 목록이 곧 연대기가 된다
  const name = `${date}-${post.slug}.md`;

  const text = post.content.ok
    ? `${frontMatter(post)}\n\n${postToMarkdown(post.content.content)}\n`
    : // 스키마를 통과하지 못한 글도 내보낸다. 내용을 잃는 것보다 조판을 잃는 편이 낫다
      `${frontMatter(post)}\n\n<!-- 조판을 복원하지 못한 기록입니다. 원문 JSON을 남깁니다. -->\n\n\`\`\`json\n${JSON.stringify(post.content.raw, null, 2)}\n\`\`\`\n`;

  return { name, text };
}
