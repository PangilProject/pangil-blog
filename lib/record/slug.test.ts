import { describe, expect, it } from "vitest";

import { deriveSlug, findAvailableSlug, toKebabCase, withDedupeSuffix } from "@/lib/record/slug";

describe("deriveSlug — 05 §6.4", () => {
  it("묵상 3타입은 프리픽스와 번호로 만든다 — 제목이 한글이고 매일 반복된다", () => {
    expect(deriveSlug({ type: "QT", callNumber: 1043 })).toBe("qt-1043");
    expect(deriveSlug({ type: "SERMON", callNumber: 104 })).toBe("sr-104");
    expect(deriveSlug({ type: "PRAISE", callNumber: 388 })).toBe("pr-388");
  });

  it("TECH는 제목을 kebab으로 만든다", () => {
    expect(deriveSlug({ type: "TECH", callNumber: 72, title: "Next.js App Router 정리" })).toBe(
      "next-js-app-router",
    );
  });

  it("한글만 있는 TECH 제목은 번호로 폴백한다 — kebab 결과가 비기 때문이다", () => {
    expect(deriveSlug({ type: "TECH", callNumber: 72, title: "티스토리를 떠나며" })).toBe(
      "post-72",
    );
    expect(deriveSlug({ type: "TECH", callNumber: 72, title: "" })).toBe("post-72");
    expect(deriveSlug({ type: "TECH", callNumber: 72 })).toBe("post-72");
  });

  it("기호만 있는 제목도 폴백한다", () => {
    expect(deriveSlug({ type: "TECH", callNumber: 5, title: "!!! ??? ---" })).toBe("post-5");
  });
});

describe("toKebabCase", () => {
  it("공백·기호를 하나의 하이픈으로 접고 양끝을 다듬는다", () => {
    expect(toKebabCase("  Hello   World!! ")).toBe("hello-world");
    expect(toKebabCase("React 19 & Next 16")).toBe("react-19-next-16");
  });

  it("ASCII가 없으면 빈 문자열이다", () => {
    expect(toKebabCase("묵상")).toBe("");
  });
});

describe("withDedupeSuffix", () => {
  it("첫 번째 후보에는 접미사를 붙이지 않는다", () => {
    expect(withDedupeSuffix("post-72", 1)).toBe("post-72");
    expect(withDedupeSuffix("post-72", 2)).toBe("post-72-2");
  });
});

describe("findAvailableSlug", () => {
  it("비어 있으면 그대로 쓴다", async () => {
    expect(await findAvailableSlug("qt-1043", async () => false)).toBe("qt-1043");
  });

  it("이미 쓰인 slug는 순번을 올려 피한다", async () => {
    const taken = new Set(["hello", "hello-2"]);
    expect(await findAvailableSlug("hello", async (c) => taken.has(c))).toBe("hello-3");
  });

  it("빈 자리를 못 찾으면 조용히 덮지 않고 실패한다", async () => {
    await expect(findAvailableSlug("x", async () => true, 3)).rejects.toThrow(/빈 자리가 없습니다/);
  });
});
