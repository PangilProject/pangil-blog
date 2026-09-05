import { describe, expect, it } from "vitest";

import { deriveSlug, findAvailableSlug, toKebabCase, withDedupeSuffix } from "@/lib/record/slug";

describe("deriveSlug — 05 §6.4", () => {
  it("묵상 3타입은 프리픽스와 번호로 만든다 — 제목이 한글이고 매일 반복된다", () => {
    expect(deriveSlug({ type: "QT", callNumber: 1043 })).toBe("qt-1043");
    expect(deriveSlug({ type: "SERMON", callNumber: 104 })).toBe("sr-104");
    expect(deriveSlug({ type: "PRAISE", callNumber: 388 })).toBe("pr-388");
  });

  /**
   * 제목은 주소에 들어가지 않는다(2026-09-05 개편). 한글로 쓰는 글에서 제목 kebab은
   * `cto`·`2-velog-tistory` 같은 ASCII 찌꺼기만 남겼고, 514편 중 61편은 숫자만 남아
   * 백준 문제 번호가 주소가 돼 있었다.
   */
  it("TECH는 청구기호를 화면에 적는 그대로 쓴다", () => {
    expect(deriveSlug({ type: "TECH", callNumber: 72 })).toBe("0072");
    expect(deriveSlug({ type: "TECH", callNumber: 1 })).toBe("0001");
    expect(deriveSlug({ type: "TECH", callNumber: 514 })).toBe("0514");
  });

  /**
   * 자리를 채우는 것이 소급 적용을 살렸다. 옛 slug 중 `2947`·`260405`처럼 숫자만 남은 것이
   * 61개 있었는데 전부 앞자리가 0이 아니라, 패딩한 목표와 하나도 부딪히지 않았다.
   */
  it("앞자리를 채운다 — 맨 숫자로 갔으면 옛 주소와 부딪혔다", () => {
    expect(deriveSlug({ type: "TECH", callNumber: 2 })).not.toBe("2");
    expect(deriveSlug({ type: "TECH", callNumber: 2 })).toBe("0002");
  });

  it("네 자리를 넘으면 그대로 늘어난다 — 자르지 않는다", () => {
    expect(deriveSlug({ type: "TECH", callNumber: 12345 })).toBe("12345");
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
