import { describe, expect, it } from "vitest";

import {
  startsWithVerseNumber,
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

/**
 * **이 판정은 한 벌만 있어야 한다.** 마이그레이션 컨버터 둘이 각자 정규식을 들고 있었고 그쪽은
 * 구두점을 필수로 봤다 — 그래서 구두점 없는 절이 말씀 영역 첫 줄로 오면 그 절 본문이 말씀 범위
 * 칸에 들어앉았다(전수조사 개발 1-3). 같은 글자를 화면은 절로 읽었다.
 *
 * 아래 첫 항목이 **두 규칙이 서로 다른 답을 내던 바로 그 모양**이다.
 */
describe("startsWithVerseNumber — 절 번호로 시작하는 줄", () => {
  it("구두점이 없어도 절이다", () => {
    expect(startsWithVerseNumber("13 솔로몬이 하나님께 아뢰되")).toBe(true);
  });

  it("마침표·괄호가 붙어도 절이다", () => {
    expect(startsWithVerseNumber("7. 너는 가서 기쁨으로")).toBe(true);
    expect(startsWithVerseNumber("7) 너는 가서 기쁨으로")).toBe(true);
  });

  it("범위도 절이다", () => {
    expect(startsWithVerseNumber("7-10 너는 가서")).toBe(true);
    expect(startsWithVerseNumber("7~10 너는 가서")).toBe(true);
  });

  it("숫자로 시작해도 뒤에 글이 없으면 절이 아니다", () => {
    expect(startsWithVerseNumber("13")).toBe(false);
  });

  it("숫자로 시작하지 않으면 절이 아니다 — 말씀 범위 줄이 여기 걸리면 안 된다", () => {
    expect(startsWithVerseNumber("전도서 9장 7~10절")).toBe(false);
    expect(startsWithVerseNumber("솔로몬이 아뢰되")).toBe(false);
  });
});
