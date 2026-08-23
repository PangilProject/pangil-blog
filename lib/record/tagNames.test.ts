import { describe, expect, it } from "vitest";

import { normalizeTagNames } from "@/lib/record/tagNames";

describe("normalizeTagNames", () => {
  it("공백을 다듬고 빈 태그를 버린다", () => {
    expect(normalizeTagNames(["  Next.js ", "", "  ", "server  action"])).toEqual([
      "Next.js",
      "server action",
    ]);
  });

  it("대소문자만 다른 태그는 같은 태그다 — 목록에서 둘로 갈리면 탐색이 깨진다", () => {
    expect(normalizeTagNames(["Prisma", "prisma", "PRISMA"])).toEqual(["Prisma"]);
  });

  it("처음 적은 표기를 남긴다", () => {
    expect(normalizeTagNames(["Tiptap", "tiptap"])[0]).toBe("Tiptap");
  });
});
