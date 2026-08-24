import { describe, expect, it } from "vitest";

import { QT_QUESTION_GROUPS } from "@/lib/content/schema";
import { buildQtContent, type ParsedQt, validateParsedQt } from "@/lib/crawler/qtContent";

/**
 * 06 §6 검증 규칙 고정. "조용히 5질문짜리 깨진 초안"이 만들어지지 않는다는 것이
 * 크롤러에서 가장 중요한 성질이므로(06 §4) 규칙마다 테스트를 붙인다.
 */

/** 실제 365qt 하루치 구조: 내용관찰 2 · 연구와 묵상 1 · 느낀 점 1 · 결단과 적용 2 = 6 */
function validParsed(): ParsedQt {
  return {
    title: "내 의와 성취가 아닌 주의 뜻과 말씀대로",
    scriptureRef: "열왕기상 5:1~6",
    scriptureBody: "1 솔로몬이 기름 부음을 받고…",
    annotations: [{ term: "두로 왕 히람", verseRef: "1절", body: "지중해 연안의 해상 도시…" }],
    questionGroups: [
      {
        group: "내용관찰",
        questions: [
          { label: "1", text: "먼저 사절단을 보낸 사람은 누구입니까?" },
          { label: "2", text: "성전 건축의 이유를 무엇이라 설명합니까?" },
        ],
      },
      { group: "연구와 묵상", questions: [{ label: "3", text: "왜 말씀을 근거로 삼습니까?" }] },
      { group: "느낀 점", questions: [{ label: "4", text: "무엇을 느낍니까?" }] },
      {
        group: "결단과 적용",
        questions: [
          { label: "5-1", text: "내 계산을 앞세웠던 때는 언제입니까?" },
          { label: "5-2", text: "무엇을 실천하겠습니까?" },
        ],
      },
    ],
  };
}

describe("validateParsedQt", () => {
  it("정상 하루치는 통과한다", () => {
    expect(validateParsedQt(validParsed())).toEqual([]);
  });

  it("주석이 0개인 날도 정상이다", () => {
    expect(validateParsedQt({ ...validParsed(), annotations: [] })).toEqual([]);
  });

  it("질문이 6개가 아니면 위반이다", () => {
    const parsed = validParsed();
    parsed.questionGroups[3].questions.pop();

    expect(validateParsedQt(parsed)).toContain("질문이 5개 (기대 6)");
  });

  it("그룹이 4개가 아니면 위반이다", () => {
    const parsed = validParsed();
    parsed.questionGroups.pop();

    const issues = validateParsedQt(parsed);
    expect(issues.some((issue) => issue.includes("질문 그룹이 3개"))).toBe(true);
  });

  it("모르는 그룹 라벨을 잡는다 — 은혜나눔·기도가 섞여 들어오는 경우", () => {
    const parsed = validParsed();
    parsed.questionGroups[3].group = "은혜나눔";

    const issues = validateParsedQt(parsed);
    expect(issues).toContain("없는 그룹: 결단과 적용");
    expect(issues).toContain("모르는 그룹: 은혜나눔");
  });

  it("그룹 순서가 바뀌어도 통과한다 — 집합만 본다", () => {
    const parsed = validParsed();
    parsed.questionGroups.reverse();

    expect(validateParsedQt(parsed)).toEqual([]);
  });

  it("말씀·제목이 비면 위반이다", () => {
    const issues = validateParsedQt({
      ...validParsed(),
      title: "  ",
      scriptureRef: "",
      scriptureBody: "\n",
    });

    expect(issues).toContain("제목이 비어 있음");
    expect(issues).toContain("말씀 범위가 비어 있음");
    expect(issues).toContain("말씀 본문이 비어 있음");
  });

  it("질문 원문이 빈 질문을 잡는다", () => {
    const parsed = validParsed();
    parsed.questionGroups[0].questions[1].text = "";

    expect(validateParsedQt(parsed)).toContain("빈 질문: 내용관찰 2");
  });
});

describe("buildQtContent", () => {
  it("답변과 요약은 빈 문서로 둔다 — 묵상은 자동화하지 않는다(06 §0)", () => {
    const content = buildQtContent(validParsed());

    expect(content.kind).toBe("QT");
    if (content.kind !== "QT") return;

    expect(content.summary).toEqual({ type: "doc", content: [] });
    for (const group of content.questionGroups) {
      for (const question of group.questions) {
        expect(question.answer).toEqual({ type: "doc", content: [] });
      }
    }
  });

  it("발견한 그룹 순서를 그대로 남긴다", () => {
    const content = buildQtContent(validParsed());
    if (content.kind !== "QT") return;

    expect(content.questionGroups.map((group) => group.group)).toEqual([...QT_QUESTION_GROUPS]);
  });

  it("빈 verseRef는 필드 자체를 남기지 않는다", () => {
    const content = buildQtContent({
      ...validParsed(),
      annotations: [{ term: "백향목", verseRef: "  ", body: "고급 목재" }],
    });
    if (content.kind !== "QT") return;

    expect(content.annotations[0]).toEqual({ term: "백향목", body: "고급 목재" });
  });
});
