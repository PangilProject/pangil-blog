import { describe, expect, it } from "vitest";

import { defaultTagsFor } from "@/lib/record/defaultTags";

describe("defaultTagsFor", () => {
  it("묵상 세 종류는 매번 붙는 태그를 미리 놓는다", () => {
    expect(defaultTagsFor("QT")).toContain("QT");
    expect(defaultTagsFor("SERMON")).toContain("설교");
    expect(defaultTagsFor("PRAISE")).toContain("찬양");
  });

  /**
   * 목록은 이관해 온 글에서 센 것이다. 여기서 고정하는 이유는 **빠진 것을 알아채기 위해서**다 —
   * 큐티는 크롤러 초안으로 열려서 기본 태그가 아예 안 붙은 적이 있었다.
   */
  it("큐티는 네 개다 — 날마다 솟는 샘물의 글에 늘 같이 붙는 것들", () => {
    expect(defaultTagsFor("QT")).toEqual(["QT", "묵상", "날마다 솟는 샘물", "날솟샘"]);
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
