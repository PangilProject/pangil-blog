import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { validateParsedQt } from "@/lib/crawler/qtContent";
import { ParseError, parseTodayQt } from "@/scripts/crawler/parse.mts";

/**
 * 픽스처 기반 파서 테스트 (AGENTS.md 필수 · 06 §6).
 *
 * `todayqt-2026-08-24.html`은 실제 365qt 페이지를 저장한 것이고(세션 토큰만 지웠다),
 * 나머지는 거기서 한 곳만 바꿔 파생시킨 것이다. 실물 하나를 기준으로 두면 "우리가 상상한
 * 마크업"이 아니라 "그 사이트가 실제로 내려주는 마크업"을 고정할 수 있다.
 */

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), "utf-8");
}

const RUN_DATE = "2026-08-24";

function parseFixture(name: string, runDate = RUN_DATE) {
  const result = parseTodayQt(fixture(name), runDate);
  if (result.kind !== "content") throw new Error(`content를 기대했지만 ${result.kind}`);
  return result.parsed;
}

describe("parseTodayQt — 실제 하루치", () => {
  it("검증 규칙을 통과한다 — 4그룹 6질문", () => {
    const parsed = parseFixture("todayqt-2026-08-24");

    expect(validateParsedQt(parsed)).toEqual([]);
    expect(parsed.questionGroups.map((group) => group.group)).toEqual([
      "내용관찰",
      "연구와 묵상",
      "느낀 점",
      "결단과 적용",
    ]);
  });

  it("제목과 말씀 범위를 읽는다", () => {
    const parsed = parseFixture("todayqt-2026-08-24");

    expect(parsed.title).toBe("내 의와 성취가 아닌 주의 뜻과 말씀대로");
    expect(parsed.scriptureRef).toBe("열왕기상 5:1~6");
  });

  it("말씀 본문은 한글 탭만 읽고 절 번호를 앞에 세운다", () => {
    const parsed = parseFixture("todayqt-2026-08-24");
    const verses = parsed.scriptureBody.split("\n");

    expect(verses).toHaveLength(6);
    expect(verses[1]).toBe("2 이에 솔로몬이 히람에게 사람을 보내어 이르되");
    // 영문 탭(#profile)이 섞이면 안 된다
    expect(parsed.scriptureBody).not.toContain("Hiram");
  });

  it("주석은 용어·절·설명으로 쪼갠다", () => {
    const parsed = parseFixture("todayqt-2026-08-24");

    expect(parsed.annotations).toHaveLength(4);
    expect(parsed.annotations[0]).toEqual({
      term: "두로 왕 히람",
      verseRef: "1절",
      body: "지중해 연안의 해상 도시 두로를 다스리던 왕으로, 다윗과 우호 동맹을 맺고 왕궁 건축을 위해 백향목과 기술자들을 지원함",
    });
    expect(parsed.annotations[3].term).toBe("백향목");
  });

  it("한 문단에 두 물음이 오면 5-1·5-2로 나눈다", () => {
    const parsed = parseFixture("todayqt-2026-08-24");
    const last = parsed.questionGroups[3].questions;

    expect(last.map((question) => question.label)).toEqual(["5-1", "5-2"]);
    expect(last[0].text).toBe("하나님의 말씀보다 내 계산과 능력을 앞세웠던 때는 언제입니까?");
    expect(last[1].text).toBe(
      "내 지혜와 실력을 내려놓고, 주님의 말씀대로 살아가기 위해 무엇을 실천하겠습니까?",
    );
  });

  it("기도·은혜나눔은 질문으로 세지 않는다 — 아는 그룹 안에서만 줍는다", () => {
    const parsed = parseFixture("todayqt-2026-08-24");
    const texts = parsed.questionGroups.flatMap((group) =>
      group.questions.map((question) => question.text),
    );

    expect(texts).toHaveLength(6);
    expect(texts.some((text) => text.includes("은혜를 함께 나눕니다"))).toBe(false);
    expect(texts.some((text) => text.includes("골방기도"))).toBe(false);
  });
});

describe("parseTodayQt — 주석 없는 날", () => {
  it("주석 0개도 정상으로 통과한다(06 §6)", () => {
    const parsed = parseFixture("todayqt-no-annotations");

    expect(parsed.annotations).toEqual([]);
    expect(validateParsedQt(parsed)).toEqual([]);
  });
});

describe("parseTodayQt — 미게시", () => {
  it("365qt가 disable로 표시한 날만 no-content다", () => {
    const result = parseTodayQt(fixture("todayqt-sunday"), "2026-08-23");

    expect(result.kind).toBe("no-content");
    if (result.kind !== "no-content") return;
    expect(result.reason).toContain("주일은 오늘의큐티가 없습니다");
  });
});

describe("parseTodayQt — 시끄럽게 실패하는 경우", () => {
  it("마크업이 바뀌면 ParseError다 — 빈 초안을 만들지 않는다", () => {
    expect(() => parseFixture("todayqt-markup-changed")).toThrow(ParseError);
  });

  it("질문을 못 찾으면 검증에서 걸린다 — SKIP으로 삼키지 않는다", () => {
    const parsed = parseFixture("todayqt-questions-dropped");

    expect(validateParsedQt(parsed)).toContain("질문이 0개 (기대 6)");
  });

  it("페이지가 다른 날짜를 보여주면 ParseError다", () => {
    expect(() => parseFixture("todayqt-2026-08-24", "2026-08-25")).toThrow(
      /2026-08-24을 보여줍니다/,
    );
  });
});
