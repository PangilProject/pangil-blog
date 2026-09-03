import { describe, expect, it } from "vitest";

import { EMPTY_TIPTAP_DOC, type TiptapDoc } from "@/lib/content/schema";
import {
  EMPTY_SERMON_FORM,
  fromDraftContent,
  SermonPublishFormSchema,
  toDraftContent,
  toPublishContent,
} from "@/lib/editor/sermonForm";

const doc = (text: string): TiptapDoc => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const filled = {
  title: "오늘이라는 선물",
  scriptureRef: "전도서 9장 7~10절",
  scriptureBody: "너는 가서 기쁨으로",
  body: doc("설교 속기"),
  summary: EMPTY_TIPTAP_DOC,
  tags: [],
};

describe("toDraftContent — 자동 저장", () => {
  it("반쯤 적힌 상태도 그대로 담는다 — 예배 첫 몇 초", () => {
    const content = toDraftContent({ ...EMPTY_SERMON_FORM, scriptureRef: "전도서" });

    expect(content.kind).toBe("SERMON");
    if (content.kind === "SERMON") expect(content.scriptureRef).toBe("전도서");
  });

  it("빈 요약은 넣지 않는다 — 예배 후 선택 항목이다", () => {
    const content = toDraftContent(filled);
    expect("summary" in content).toBe(false);
  });

  it("요약을 적으면 담는다", () => {
    const content = toDraftContent({ ...filled, summary: doc("예배 후 정리") });
    expect("summary" in content).toBe(true);
  });
});

describe("SermonPublishFormSchema — 발행 게이트의 화면 쪽 알림", () => {
  it("갖춰진 값은 통과한다", () => {
    expect(SermonPublishFormSchema.safeParse(filled).success).toBe(true);
  });

  it("말씀 본문이 없으면 막는다 (02 결정 로그 #13)", () => {
    const result = SermonPublishFormSchema.safeParse({ ...filled, scriptureBody: "  " });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("말씀 본문을 적어주세요");
    }
  });

  it("본문이 비면 막는다 — 빈 설교를 발행하는 건 사고다", () => {
    expect(SermonPublishFormSchema.safeParse({ ...filled, body: EMPTY_TIPTAP_DOC }).success).toBe(
      false,
    );
  });

  it("요약은 없어도 통과한다", () => {
    expect(
      SermonPublishFormSchema.safeParse({ ...filled, summary: EMPTY_TIPTAP_DOC }).success,
    ).toBe(true);
  });
});

describe("toPublishContent", () => {
  it("앞뒤 공백을 정리해 담는다", () => {
    const content = toPublishContent({ ...filled, scriptureRef: "  전도서 9장  " });
    if (content.kind === "SERMON") expect(content.scriptureRef).toBe("전도서 9장");
  });
});

describe("fromDraftContent — 이어쓰기 진입", () => {
  it("저장된 초안을 폼 값으로 되돌린다", () => {
    const values = fromDraftContent(
      { kind: "SERMON", scriptureRef: "전도서", body: doc("속기") },
      "제목",
    );

    expect(values.title).toBe("제목");
    expect(values.scriptureRef).toBe("전도서");
    expect(values.body).toEqual(doc("속기"));
    expect(values.summary).toEqual(EMPTY_TIPTAP_DOC);
  });

  it("타입이 다른 content는 빈 폼으로 시작한다 — 엉뚱한 값을 들고 오지 않는다", () => {
    const values = fromDraftContent({ kind: "QT" }, "제목");
    expect(values).toEqual({ ...EMPTY_SERMON_FORM, title: "제목" });
  });

  it("content가 없으면 빈 폼이다 (새 글)", () => {
    expect(fromDraftContent(null, "")).toEqual(EMPTY_SERMON_FORM);
  });
});
