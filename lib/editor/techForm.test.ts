import { describe, expect, it } from "vitest";

import { DraftSchema, PublishSchema } from "@/lib/content/schema";
import type { RichTextValue } from "@/lib/editor/richText";
import {
  deriveExcerpt,
  EMPTY_TECH_FORM,
  EXCERPT_MAX_LENGTH,
  fromDraftContent,
  resolveExcerpt,
  type TechFormValues,
  TechPublishFormSchema,
  toDraftContent,
  toDraftMeta,
  toPublishContent,
} from "@/lib/editor/techForm";

const body = (...paragraphs: string[]): RichTextValue => ({
  type: "doc",
  content: paragraphs.map((text) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  })),
});

function filled(): TechFormValues {
  return {
    title: "Next 16 캐시 무효화 정리",
    categoryId: "cat-1",
    body: body("Next 16은 무효화를 두 갈래로 나눴다."),
    excerpt: "",
    thumbnailUrl: "",
    tags: ["Next.js", "next.js", " 캐시 "],
  };
}

describe("deriveExcerpt — 본문 앞부분 자동 추출 (02 §5.5)", () => {
  it("짧은 본문은 그대로 쓴다", () => {
    expect(deriveExcerpt(body("한 문장이다."))).toBe("한 문장이다.");
  });

  it("문장 경계에서 끊는다 — 단어 중간에서 잘린 요약이 OG 카드로 나간다", () => {
    const long = body(`${"가".repeat(80)}다. ${"나".repeat(120)}`);

    const excerpt = deriveExcerpt(long);

    expect(excerpt.endsWith("다.")).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX_LENGTH + 1);
  });

  it("문장 경계가 없으면 단어에서 끊고 말줄임을 붙인다", () => {
    const words = Array.from({ length: 60 }, (_, index) => `word${index}`).join(" ");

    const excerpt = deriveExcerpt(body(words));

    // 단어 중간에서 끊기지 않는다 — 마지막 토큰이 온전해야 한다
    expect(excerpt).toMatch(/word\d+…$/);
    expect(excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX_LENGTH + 1);
  });

  it("빈 본문은 빈 요약이다", () => {
    expect(deriveExcerpt(undefined)).toBe("");
    expect(deriveExcerpt({ type: "doc", content: [] })).toBe("");
  });
});

describe("resolveExcerpt", () => {
  it("손으로 적은 요약이 이긴다", () => {
    expect(resolveExcerpt({ ...filled(), excerpt: "내가 적은 요약" })).toBe("내가 적은 요약");
  });

  it("비워두면 본문에서 뽑는다", () => {
    expect(resolveExcerpt(filled())).toBe("Next 16은 무효화를 두 갈래로 나눴다.");
  });
});

describe("발행 게이트", () => {
  it("갖춰지면 통과한다", () => {
    expect(TechPublishFormSchema.safeParse(filled()).success).toBe(true);
  });

  it("카테고리가 없으면 막는다 — dev 목록의 분류가 비면 글이 어디에도 안 걸린다", () => {
    const result = TechPublishFormSchema.safeParse({ ...filled(), categoryId: "" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("카테고리를 골라주세요");
  });

  it("태그가 없어도 발행된다 — 권장이지 필수가 아니다", () => {
    expect(TechPublishFormSchema.safeParse({ ...filled(), tags: [] }).success).toBe(true);
  });

  it("본문이 비면 막는다", () => {
    const result = TechPublishFormSchema.safeParse({
      ...filled(),
      body: { type: "doc", content: [] },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("본문이 비어 있어요");
  });
});

describe("저장 계약 변환 (05 §2)", () => {
  it("content에는 body만 들어간다 — 나머지는 posts 컬럼이다", () => {
    expect(toDraftContent(filled())).toEqual({
      kind: "TECH",
      body: filled().body,
    });
    expect(DraftSchema.safeParse(toDraftContent(EMPTY_TECH_FORM)).success).toBe(true);
    expect(PublishSchema.safeParse(toPublishContent(filled())).success).toBe(true);
  });

  it("메타는 빈 값을 null로 내린다 — 빈 문자열이 컬럼에 남으면 목록이 빈 줄을 그린다", () => {
    expect(toDraftMeta(EMPTY_TECH_FORM)).toEqual({
      categoryId: null,
      excerpt: null,
      thumbnailUrl: null,
      tags: [],
    });
  });

  it("메타에 요약 파생값과 태그를 함께 싣는다", () => {
    const meta = toDraftMeta(filled());

    expect(meta.categoryId).toBe("cat-1");
    expect(meta.excerpt).toBe("Next 16은 무효화를 두 갈래로 나눴다.");
    // 정리는 저장 경로(normalizeTagNames)가 한다 — 폼은 적은 대로 넘긴다
    expect(meta.tags).toEqual(["Next.js", "next.js", " 캐시 "]);
  });
});

describe("fromDraftContent — 이어쓰기 진입", () => {
  it("본문과 메타를 각각 되살린다", () => {
    const form = fromDraftContent(toDraftContent(filled()), {
      title: "제목",
      categoryId: "cat-2",
      excerpt: "저장된 요약",
      thumbnailUrl: null,
      tags: ["Prisma"],
    });

    expect(form).toMatchObject({
      title: "제목",
      categoryId: "cat-2",
      excerpt: "저장된 요약",
      thumbnailUrl: "",
      tags: ["Prisma"],
    });
    expect(form.body).toEqual(filled().body);
  });

  it("다른 타입 content면 본문은 빈 문서로 시작한다", () => {
    const form = fromDraftContent(
      { kind: "QT" },
      {
        title: "제목",
        categoryId: null,
        excerpt: null,
        thumbnailUrl: null,
        tags: [],
      },
    );

    expect(form.body).toEqual({ type: "doc", content: [] });
  });
});
