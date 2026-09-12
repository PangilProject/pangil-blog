import { describe, expect, it } from "vitest";

import {
  stripScriptureMarks,
  toScriptureSegments,
  toScriptureVerses,
} from "@/lib/record/scriptureVerses";

describe("toScriptureVerses", () => {
  it("크롤러가 적은 '1 본문' 형식을 절로 나눈다", () => {
    expect(toScriptureVerses("1 솔로몬이 왕이 되었다\n2 히람에게 사람을 보내어")).toMatchObject([
      { number: "1", text: "솔로몬이 왕이 되었다" },
      { number: "2", text: "히람에게 사람을 보내어" },
    ]);
  });

  it("손으로 적은 '44. 본문' 형식도 같이 받는다", () => {
    expect(toScriptureVerses("44. 네가 네 마음으로 아는 모든 악")).toMatchObject([
      { number: "44", text: "네가 네 마음으로 아는 모든 악" },
    ]);
  });

  it("묶인 절 번호를 그대로 남긴다", () => {
    expect(toScriptureVerses("41~42 그가 이르되")).toMatchObject([
      { number: "41~42", text: "그가 이르되" },
    ]);
  });

  it("번호가 없는 줄은 번호 없이 남긴다 — 본문을 잃지 않는다", () => {
    expect(toScriptureVerses("주께서 말씀하시니라")).toMatchObject([
      { text: "주께서 말씀하시니라" },
    ]);
  });

  it("빈 줄은 버린다", () => {
    expect(toScriptureVerses("\n1 첫 절\n\n\n2 둘째 절\n")).toHaveLength(2);
  });
});

describe("강조 표시 — 저장은 글자열 그대로 (02 §5.2)", () => {
  it("**굵게**와 __밑줄__을 덩이로 쪼갠다", () => {
    expect(toScriptureSegments("네가 **네 마음으로** 아는 __모든 악__을")).toEqual([
      { text: "네가 " },
      { text: "네 마음으로", bold: true },
      { text: " 아는 " },
      { text: "모든 악", underline: true },
      { text: "을" },
    ]);
  });

  it("표시가 없으면 덩이 하나다", () => {
    expect(toScriptureSegments("주께서 말씀하시니라")).toEqual([{ text: "주께서 말씀하시니라" }]);
  });

  it("짝이 맞지 않는 표시는 글자로 남긴다 — 적다 만 상태에서 본문이 사라지면 안 된다", () => {
    expect(toScriptureSegments("네가 **네 마음으로 아는")).toEqual([
      { text: "네가 **네 마음으로 아는" },
    ]);
  });

  it("절 번호를 뗀 뒤의 글자에 적용된다", () => {
    const [verse] = toScriptureVerses("44. 네가 **네 마음으로** 아는");

    expect(verse?.number).toBe("44");
    expect(verse?.segments).toEqual([
      { text: "네가 " },
      { text: "네 마음으로", bold: true },
      { text: " 아는" },
    ]);
  });

  it("text는 표시를 뗀 평문이다 — 검색이 `**주님**`을 한 낱말로 잡으면 그 말로 못 찾는다", () => {
    const [verse] = toScriptureVerses("1 **주님**이 말씀하시니");

    expect(verse?.text).toBe("주님이 말씀하시니");
  });

  it("stripScriptureMarks는 본문 전체에서 표시만 뗀다", () => {
    expect(stripScriptureMarks("**주님**이\n__말씀__하시니")).toBe("주님이\n말씀하시니");
  });
});
