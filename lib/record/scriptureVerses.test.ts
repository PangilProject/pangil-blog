import { describe, expect, it } from "vitest";

import { toScriptureVerses } from "@/lib/record/scriptureVerses";

describe("toScriptureVerses", () => {
  it("크롤러가 적은 '1 본문' 형식을 절로 나눈다", () => {
    expect(toScriptureVerses("1 솔로몬이 왕이 되었다\n2 히람에게 사람을 보내어")).toEqual([
      { number: "1", text: "솔로몬이 왕이 되었다" },
      { number: "2", text: "히람에게 사람을 보내어" },
    ]);
  });

  it("손으로 적은 '44. 본문' 형식도 같이 받는다", () => {
    expect(toScriptureVerses("44. 네가 네 마음으로 아는 모든 악")).toEqual([
      { number: "44", text: "네가 네 마음으로 아는 모든 악" },
    ]);
  });

  it("묶인 절 번호를 그대로 남긴다", () => {
    expect(toScriptureVerses("41~42 그가 이르되")).toEqual([
      { number: "41~42", text: "그가 이르되" },
    ]);
  });

  it("번호가 없는 줄은 번호 없이 남긴다 — 본문을 잃지 않는다", () => {
    expect(toScriptureVerses("주께서 말씀하시니라")).toEqual([{ text: "주께서 말씀하시니라" }]);
  });

  it("빈 줄은 버린다", () => {
    expect(toScriptureVerses("\n1 첫 절\n\n\n2 둘째 절\n")).toHaveLength(2);
  });
});
