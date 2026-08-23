import { describe, expect, it } from "vitest";

import { normalizeArtist, suggestPraiseTitle } from "@/lib/praise/title";

/**
 * 실제 유튜브 찬양 영상 제목 꼴로 고정한다 (00 §7-4).
 * 이 함수의 성공 기준은 "대체로 맞아서 그냥 두는 것"이다. 반쯤 맞춘 제목은 매번 고쳐야
 * 하므로 안 하는 것보다 나쁘다 — 그래서 애매한 입력의 기대값은 전부 원본 유지다.
 */

describe("normalizeArtist", () => {
  it("채널 꼬리표를 떼어낸다", () => {
    expect(normalizeArtist("마커스워십 Official")).toBe("마커스워십");
    expect(normalizeArtist("WELOVE Official TV")).toBe("WELOVE");
    expect(normalizeArtist("제이어스 공식채널")).toBe("제이어스");
  });

  it("이름의 일부인 단어는 건드리지 않는다", () => {
    expect(normalizeArtist("Bethel Music")).toBe("Bethel Music");
    expect(normalizeArtist("어노인팅 Anointing Worship")).toBe("어노인팅 Anointing Worship");
  });
});

describe("suggestPraiseTitle — 정리해서 제안한다", () => {
  it("잡음 괄호를 버리고 아티스트를 앞에 붙인다", () => {
    expect(
      suggestPraiseTitle({
        title: "주님의 시간에 (Official Lyric Video)",
        authorName: "마커스워십",
      }),
    ).toBe("마커스워십 - 주님의 시간에");
  });

  it("대괄호에 든 아티스트를 알아본다", () => {
    expect(
      suggestPraiseTitle({ title: "[제이어스] 위대하신 주", authorName: "J-US Official" }),
    ).toBe("제이어스 - 위대하신 주");
  });

  it("곡명이 먼저 오고 아티스트가 뒤에 오는 꼴도 맞춘다", () => {
    expect(suggestPraiseTitle({ title: "은혜 | 어노인팅", authorName: "어노인팅" })).toBe(
      "어노인팅 - 은혜",
    );
  });

  it("이미 아티스트가 앞에 있으면 그 형태를 유지한다", () => {
    expect(
      suggestPraiseTitle({
        title: "마커스워십 - 주 나의 모든 것 (Live)",
        authorName: "마커스워십",
      }),
    ).toBe("마커스워십 - 주 나의 모든 것 (Live)");
  });

  it("Live·Acoustic 표기는 남긴다 — 같은 곡의 다른 기록이다", () => {
    expect(
      suggestPraiseTitle({ title: "예수 이름으로 (Acoustic) [Official MV]", authorName: "WELOVE" }),
    ).toBe("WELOVE - 예수 이름으로 (Acoustic)");
  });
});

describe("suggestPraiseTitle — 애매하면 원본을 준다 (폴백)", () => {
  it("채널명을 모르면 정리한 제목까지만 준다", () => {
    expect(suggestPraiseTitle({ title: "주님의 시간에 (Official MV)", authorName: null })).toBe(
      "주님의 시간에",
    );
  });

  it("제목이 채널명과 같으면 손대지 않는다", () => {
    expect(suggestPraiseTitle({ title: "마커스워십", authorName: "마커스워십" })).toBe(
      "마커스워십",
    );
  });

  it("빈 제목은 빈 값이다 — 없는 제목을 만들지 않는다", () => {
    expect(suggestPraiseTitle({ title: "   ", authorName: "마커스워십" })).toBe("");
  });

  it("괄호가 전부 잡음이어도 곡명이 남지 않으면 원본이다", () => {
    expect(suggestPraiseTitle({ title: "(Official Video)", authorName: "마커스워십" })).toBe(
      "(Official Video)",
    );
  });
});
