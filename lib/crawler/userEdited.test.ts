import { describe, expect, it } from "vitest";

import { isUserEdited, shouldKeepPost } from "@/lib/crawler/userEdited";

/**
 * 재크롤이 사람이 쓴 답변을 덮는 사고를 막는 마지막 장치다(06 결정 로그 5).
 * 그래서 "판정 실패 = 보호"라는 방향까지 테스트로 고정한다.
 */

const emptyDoc = { type: "doc", content: [] };

function draft({
  answer = emptyDoc,
  summary = emptyDoc,
}: {
  answer?: unknown;
  summary?: unknown;
} = {}) {
  return {
    kind: "QT",
    scriptureRef: "열왕기상 5:1~6",
    scriptureBody: "1 솔로몬이…",
    annotations: [],
    questionGroups: [
      { group: "내용관찰", questions: [{ label: "1", text: "누구입니까?", answer }] },
    ],
    summary,
  };
}

const written = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "히람입니다" }] }],
};

describe("isUserEdited", () => {
  it("크롤러가 막 만든 초안은 편집되지 않았다", () => {
    expect(isUserEdited(draft())).toBe(false);
  });

  it("답변을 하나라도 썼으면 편집됐다", () => {
    expect(isUserEdited(draft({ answer: written }))).toBe(true);
  });

  it("요약만 썼어도 편집됐다", () => {
    expect(isUserEdited(draft({ summary: written }))).toBe(true);
  });

  it("빈 문단만 있는 답변은 쓴 것이 아니다 — 에디터를 열었다 닫은 흔적", () => {
    expect(isUserEdited(draft({ answer: { type: "doc", content: [{ type: "paragraph" }] } }))).toBe(
      false,
    );
  });

  it("읽을 수 없는 content는 덮지 않는다", () => {
    expect(isUserEdited({ kind: "QT", questionGroups: "부서진 값" })).toBe(true);
    expect(isUserEdited(null)).toBe(true);
  });

  it("QT가 아닌 content는 덮지 않는다", () => {
    expect(isUserEdited({ kind: "TECH", body: emptyDoc })).toBe(true);
  });
});

describe("shouldKeepPost", () => {
  it("손대지 않은 초안은 갱신해도 된다 — 신선한 재크롤", () => {
    expect(shouldKeepPost({ status: "DRAFT", content: draft() })).toBe(false);
  });

  it("발행된 글은 내용이 비어 있어도 덮지 않는다", () => {
    expect(shouldKeepPost({ status: "PUBLISHED", content: draft() })).toBe(true);
    expect(shouldKeepPost({ status: "PRIVATE", content: draft() })).toBe(true);
  });

  it("쓰고 있는 초안은 덮지 않는다", () => {
    expect(shouldKeepPost({ status: "DRAFT", content: draft({ answer: written }) })).toBe(true);
  });
});
