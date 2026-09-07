import { describe, expect, it } from "vitest";

import { DraftSchema, PublishSchema, QT_QUESTION_COUNT } from "@/lib/content/schema";
import {
  countEmptyAnswers,
  emptyQtForm,
  fromDraftContent,
  isEmptyForm,
  type QtFormValues,
  QtPublishFormSchema,
  toCopyText,
  toDraftContent,
  toPublishContent,
} from "@/lib/editor/qtForm";
import type { RichTextValue } from "@/lib/editor/richText";

const doc = (text: string): RichTextValue => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

/** 크롤러가 채운 초안 상태 (06 §2) */
function crawled(): QtFormValues {
  const form = emptyQtForm();
  return {
    ...form,
    title: "주님이 네 악을 네 머리로 돌려보내시리라",
    scriptureRef: "열왕기상 2장 41~46절",
    scriptureBody: "44. 네가 네 마음으로 아는 모든 악",
    annotations: [{ term: "네 악을 네 머리로", verseRef: "44절", body: "하나님의 공의로운 판단" }],
  };
}

describe("emptyQtForm — 수동 폴백 프리셋 (02 §5.2)", () => {
  it("4그룹 6질문이 미리 놓인다 — 크롤러가 죽어도 적을 자리는 있다", () => {
    const form = emptyQtForm();

    expect(form.questionGroups.map((group) => group.group)).toEqual([
      "내용관찰",
      "연구와 묵상",
      "느낀 점",
      "결단과 적용",
    ]);
    expect(form.questionGroups.flatMap((group) => group.questions)).toHaveLength(QT_QUESTION_COUNT);
    expect(form.questionGroups.flatMap((group) => group.questions.map((q) => q.label))).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5-1",
      "5-2",
    ]);
  });
});

describe("countEmptyAnswers", () => {
  it("빈 프리셋은 6개가 비어 있다", () => {
    expect(countEmptyAnswers(emptyQtForm())).toBe(QT_QUESTION_COUNT);
  });

  it("답을 쓴 만큼 줄어든다", () => {
    const form = emptyQtForm();
    const groups = structuredClone(form.questionGroups);
    const first = groups[0]?.questions[0];
    if (first) first.answer = doc("솔로몬의 명령을 지키지 않았습니다");

    expect(countEmptyAnswers({ ...form, questionGroups: groups })).toBe(QT_QUESTION_COUNT - 1);
  });
});

describe("발행 게이트 — 답변 공란은 경고만 (07 M2 DoD)", () => {
  it("답변 6개와 요약이 모두 비어도 발행을 막지 않는다", () => {
    const result = QtPublishFormSchema.safeParse(crawled());

    expect(result.success).toBe(true);
    expect(countEmptyAnswers(crawled())).toBe(QT_QUESTION_COUNT);
  });

  it("말씀이 없으면 막는다 — 이건 기록의 뼈대다", () => {
    const result = QtPublishFormSchema.safeParse({ ...crawled(), scriptureBody: "  " });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("말씀 본문을 적어주세요");
  });
});

describe("저장 계약 변환 (05 §2)", () => {
  it("초안은 DraftSchema를 통과한다 — 빈 프리셋 그대로도", () => {
    expect(DraftSchema.safeParse(toDraftContent(emptyQtForm())).success).toBe(true);
  });

  it("답변이 비어도 발행 content는 PublishSchema를 통과한다", () => {
    const parsed = PublishSchema.safeParse(toPublishContent(crawled()));

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ kind: "QT", scriptureRef: "열왕기상 2장 41~46절" });
  });

  it("질문 원문과 라벨을 함께 싣는다 — 나중에 365qt 문구로 글을 찾는다(05 §4A)", () => {
    const content = toPublishContent(crawled());
    if (content.kind !== "QT") throw new Error("QT content여야 한다");

    expect(content.questionGroups[0]?.questions[0]).toMatchObject({ label: "1" });
  });

  it("빈 주석 항목은 저장하지 않는다", () => {
    const form: QtFormValues = {
      ...crawled(),
      annotations: [
        { term: "", verseRef: "", body: "" },
        { term: "공의", verseRef: "", body: "되돌아옴" },
      ],
    };
    const content = toDraftContent(form);
    if (content.kind !== "QT") throw new Error("QT content여야 한다");

    expect(content.annotations).toEqual([{ term: "공의", body: "되돌아옴" }]);
  });
});

describe("toCopyText — 한 번에 다 복사 (A-05)", () => {
  /** 붙여넣는 쪽이 사람이 아니라 도구다. 무엇이 빠지면 요약이 어긋나므로 다 들어가야 한다 */
  function answered(): QtFormValues {
    const form = crawled();
    return {
      ...form,
      questionGroups: form.questionGroups.map((group, index) => ({
        ...group,
        questions: group.questions.map((question) => ({
          ...question,
          text: `${group.group} 질문 ${question.label}`,
          answer: index === 3 ? doc(`답 ${question.label}`) : question.answer,
        })),
      })),
      summary: doc("오늘의 요약입니다"),
    };
  }

  it("제목·말씀·주석·네 그룹·요약이 다 들어간다", () => {
    const text = toCopyText(answered());

    expect(text).toContain("# 주님이 네 악을 네 머리로 돌려보내시리라");
    expect(text).toContain("열왕기상 2장 41~46절");
    expect(text).toContain("44. 네가 네 마음으로 아는 모든 악");
    expect(text).toContain("**네 악을 네 머리로** (44절) — 하나님의 공의로운 판단");
    for (const group of ["내용관찰", "연구와 묵상", "느낀 점", "결단과 적용"]) {
      expect(text).toContain(`## ${group}`);
    }
    expect(text).toContain("답 5-1");
    expect(text).toContain("오늘의 요약입니다");
  });

  it("답을 안 쓴 질문도 남긴다 — 무엇을 건너뛰었는지가 기록이다 (02 §5.2)", () => {
    const text = toCopyText(answered());

    expect(text).toContain("**1. 내용관찰 질문 1**");
  });

  it("제목이 비면 제목 줄을 넣지 않는다 — 빈 제목 표시가 붙어 나가지 않는다", () => {
    const text = toCopyText({ ...answered(), title: "  " });

    expect(text.startsWith("#")).toBe(false);
  });
});

describe("fromDraftContent — 이어쓰기 진입", () => {
  it("저장된 질문·답변을 되살린다", () => {
    const saved = toDraftContent({
      ...crawled(),
      questionGroups: [
        { group: "내용관찰", questions: [{ label: "1", text: "무엇입니까?", answer: doc("답") }] },
      ],
    });

    const form = fromDraftContent(saved, "제목");

    expect(form.questionGroups[0]?.questions[0]).toMatchObject({
      label: "1",
      text: "무엇입니까?",
    });
    expect(form.annotations[0]).toMatchObject({ term: "네 악을 네 머리로", verseRef: "44절" });
  });

  it("질문 그룹이 없는 초안은 프리셋으로 열린다 — 빈 화면을 주지 않는다", () => {
    const form = fromDraftContent({ kind: "QT", scriptureRef: "열왕기상 2장" }, "제목");

    expect(form.questionGroups.flatMap((group) => group.questions)).toHaveLength(QT_QUESTION_COUNT);
    expect(form.scriptureRef).toBe("열왕기상 2장");
  });

  it("다른 타입 content면 빈 폼으로 시작한다", () => {
    const form = fromDraftContent({ kind: "TECH" }, "제목");

    expect(form.title).toBe("제목");
    expect(form.scriptureRef).toBe("");
  });
});

describe("isEmptyForm — 서식 전환 조건", () => {
  it("프리셋만 놓인 빈 폼은 비어 있다", () => {
    expect(isEmptyForm(emptyQtForm())).toBe(true);
  });

  it("크롤러가 채운 질문 텍스트는 쓴 것으로 보지 않는다", () => {
    const crawled = fromDraftContent(
      {
        kind: "QT",
        questionGroups: [
          {
            group: "내용관찰",
            questions: [
              { label: "1", text: "무엇을 보았는가?", answer: { type: "doc", content: [] } },
            ],
          },
        ],
      },
      "",
    );

    expect(isEmptyForm(crawled)).toBe(true);
  });

  it("사람이 쓰는 자리에 값이 있으면 비어 있지 않다", () => {
    const base = emptyQtForm();

    expect(isEmptyForm({ ...base, title: "오늘의 큐티" })).toBe(false);
    expect(isEmptyForm({ ...base, scriptureBody: "말씀" })).toBe(false);
    expect(isEmptyForm({ ...base, annotations: [{ term: "지혜", verseRef: "", body: "" }] })).toBe(
      false,
    );
  });
});
