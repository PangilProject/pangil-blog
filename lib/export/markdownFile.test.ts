import { describe, expect, it } from "vitest";

import type { ExportPost } from "@/lib/db/publicPosts";
import { toMarkdownFile } from "@/lib/export/markdownFile";

/**
 * export의 목적은 "언제든 떠날 수 있다"는 사실이다(07 §3). 그래서 여기서 고정할 것은
 * **다른 도구가 읽을 수 있는 파일인가**와 **내용을 하나도 잃지 않는가**다.
 */
const base = {
  id: "post-1",
  slug: "qt-1",
  callNumber: 1,
  publishedAt: new Date("2026-08-23T00:00:00Z"),
  updatedAt: new Date("2026-08-23T01:00:00Z"),
  excerpt: null,
  categorySlug: null,
  tags: [],
};

const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

describe("toMarkdownFile", () => {
  it("파일 이름이 곧 연대기다", () => {
    const file = toMarkdownFile({
      ...base,
      type: "QT",
      title: "제목",
      content: {
        ok: true,
        content: {
          kind: "QT",
          scriptureRef: "전도서 9장",
          scriptureBody: "너는 가서",
          annotations: [],
          questionGroups: [],
          summary: doc("요약"),
        },
      },
    } as ExportPost);

    expect(file.name).toBe("2026-08-23-qt-1.md");
  });

  it("프론트매터에 다시 만들 수 없는 것만 넣는다", () => {
    const file = toMarkdownFile({
      ...base,
      type: "TECH",
      slug: "next-16",
      title: 'Next 16 "캐시"',
      categorySlug: "fe",
      tags: ["Next.js", "캐시"],
      excerpt: "무효화 정리",
      content: { ok: true, content: { kind: "TECH", body: doc("본문") } },
    } as ExportPost);

    expect(file.text).toContain('title: "Next 16 \\"캐시\\""');
    expect(file.text).toContain('call_number: "0001"');
    expect(file.text).toContain("date: 2026-08-23T00:00:00.000Z");
    expect(file.text).toContain('category: "fe"');
    expect(file.text).toContain('tags: ["Next.js", "캐시"]');
    expect(file.text).toContain("본문");
  });

  it("큐티의 구조를 마크다운 문법으로 편다 — 답 없는 질문도 남긴다", () => {
    const file = toMarkdownFile({
      ...base,
      type: "QT",
      title: "큐티",
      content: {
        ok: true,
        content: {
          kind: "QT",
          scriptureRef: "열왕기상 2장",
          scriptureBody: "44절 …",
          annotations: [{ term: "공의", verseRef: "44절", body: "되돌아옴" }],
          questionGroups: [
            {
              group: "내용관찰",
              questions: [
                { label: "1", text: "무엇입니까?", answer: doc("답입니다") },
                { label: "2", text: "빈 질문", answer: { type: "doc", content: [] } },
              ],
            },
          ],
          summary: doc("오늘의 요약"),
        },
      },
    } as ExportPost);

    expect(file.text).toContain("> **열왕기상 2장**");
    expect(file.text).toContain("- **공의** (44절) — 되돌아옴");
    expect(file.text).toContain("## 내용관찰");
    expect(file.text).toContain("**1. 무엇입니까?**");
    expect(file.text).toContain("답입니다");
    // 답이 없어도 질문은 남는다
    expect(file.text).toContain("**2. 빈 질문**");
    expect(file.text).toContain("## 오늘의 요약");
  });

  it("스키마를 통과하지 못한 글도 원문을 담아 내보낸다", () => {
    const file = toMarkdownFile({
      ...base,
      type: "TECH",
      title: "깨진 글",
      content: { ok: false, issues: ["body: 어긋남"], raw: { kind: "TECH", body: "글자" } },
    } as ExportPost);

    expect(file.text).toContain("조판을 복원하지 못한 기록");
    expect(file.text).toContain('"body": "글자"');
  });
});
