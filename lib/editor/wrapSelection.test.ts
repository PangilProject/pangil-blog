import { describe, expect, it } from "vitest";

import { wrapSelection } from "@/lib/editor/wrapSelection";

describe("wrapSelection — 말씀 강조는 글자를 넣는 일이다", () => {
  it("고른 자리를 표시로 감싼다", () => {
    expect(wrapSelection("네가 마음으로 안다", 3, 7, "**")).toMatchObject({
      value: "네가 **마음으로** 안다",
    });
  });

  it("두 번 누르면 벗긴다 — 별표가 쌓이면 그건 토글이 아니다", () => {
    const once = wrapSelection("네가 마음으로 안다", 3, 7, "**");
    const twice = wrapSelection(once.value, once.start, once.end, "**");

    expect(twice.value).toBe("네가 마음으로 안다");
  });

  it("표시 안쪽 글자만 골라도 벗긴다 — 눈에 보이는 대로 고르게 된다", () => {
    // "**마음으로**"에서 가운데 글자만 선택한 상태
    const result = wrapSelection("네가 **마음으로** 안다", 5, 9, "**");

    expect(result.value).toBe("네가 마음으로 안다");
  });

  it("고른 것이 없으면 아무 일도 하지 않는다 — 빈 표시를 남기지 않는다", () => {
    expect(wrapSelection("네가 안다", 2, 2, "**")).toEqual({
      value: "네가 안다",
      start: 2,
      end: 2,
    });
  });

  it("밑줄도 같은 규칙이다", () => {
    expect(wrapSelection("모든 악", 0, 2, "__")).toMatchObject({ value: "__모든__ 악" });
  });
});
