import { describe, expect, it } from "vitest";

import { defaultTagsFor } from "@/lib/record/defaultTags";

describe("defaultTagsFor", () => {
  it("묵상 세 종류는 매번 붙는 태그를 미리 놓는다", () => {
    expect(defaultTagsFor("QT")).toContain("QT");
    expect(defaultTagsFor("SERMON")).toContain("설교");
    expect(defaultTagsFor("PRAISE")).toContain("찬양");
  });

  it("기술 글에는 두지 않는다 — 주제가 매번 달라 공통 태그가 없다", () => {
    expect(defaultTagsFor("TECH")).toEqual([]);
  });

  it("부를 때마다 새 배열이다 — 폼이 고쳐 쓰는 값이라 공유하면 안 된다", () => {
    const first = defaultTagsFor("QT");
    first.push("손댐");

    expect(defaultTagsFor("QT")).not.toContain("손댐");
  });
});
