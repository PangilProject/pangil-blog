import { describe, expect, it } from "vitest";

import {
  DraftSchema,
  EMPTY_TIPTAP_DOC,
  matchesPostType,
  PublishSchema,
} from "@/lib/content/schema";

const qtPublishable = {
  kind: "QT",
  scriptureRef: "열왕기상 2장 41~46절",
  scriptureBody: "시므이가 예루살렘에서…",
  annotations: [{ term: "송사를 듣고 분별하는 지혜", verseRef: "11절", body: "공의로 다스림" }],
  questionGroups: [
    {
      group: "내용관찰",
      questions: [{ label: "1", text: "무엇을 보았습니까?", answer: EMPTY_TIPTAP_DOC }],
    },
  ],
  summary: EMPTY_TIPTAP_DOC,
};

describe("PublishSchema — 발행 게이트 (05 §3.4)", () => {
  it("구조가 갖춰진 QT를 통과시킨다", () => {
    expect(PublishSchema.safeParse(qtPublishable).success).toBe(true);
  });

  it("답변이 빈 문서여도 발행을 막지 않는다 — 공란은 UI 경고만이다(02 §6)", () => {
    const result = PublishSchema.safeParse(qtPublishable);
    expect(result.success).toBe(true);
  });

  it("말씀 범위가 없으면 막는다", () => {
    const { scriptureRef, ...withoutRef } = qtPublishable;
    expect(PublishSchema.safeParse(withoutRef).success).toBe(false);
  });

  it("주석 0개는 정상이다 — 주석 없는 날이 있다", () => {
    expect(PublishSchema.safeParse({ ...qtPublishable, annotations: [] }).success).toBe(true);
  });

  it("설교는 말씀 본문까지 필수다 (02 결정 로그 #13)", () => {
    const base = { kind: "SERMON", scriptureRef: "전도서 9장", body: EMPTY_TIPTAP_DOC };
    expect(PublishSchema.safeParse(base).success).toBe(false);
    expect(PublishSchema.safeParse({ ...base, scriptureBody: "너는 가서" }).success).toBe(true);
  });

  it("설교 요약은 예배 후 선택이라 없어도 통과한다", () => {
    const result = PublishSchema.safeParse({
      kind: "SERMON",
      scriptureRef: "전도서 9장",
      scriptureBody: "너는 가서",
      body: EMPTY_TIPTAP_DOC,
    });
    expect(result.success).toBe(true);
  });

  it("찬양은 유튜브 URL 형식을 검사한다", () => {
    const base = {
      kind: "PRAISE",
      sections: [{ id: "abc", label: "Verse", lyrics: "" }],
      meditationAndPrayer: EMPTY_TIPTAP_DOC,
    };
    expect(PublishSchema.safeParse({ ...base, youtubeUrl: "not-a-url" }).success).toBe(false);
    expect(
      PublishSchema.safeParse({ ...base, youtubeUrl: "https://youtu.be/abc123" }).success,
    ).toBe(true);
  });

  it("찬양 섹션 라벨은 enum 밖의 직접 입력도 받는다 (02 §5.4)", () => {
    const result = PublishSchema.safeParse({
      kind: "PRAISE",
      youtubeUrl: "https://youtu.be/abc123",
      sections: [{ id: "a", label: { custom: "Refrain" }, lyrics: "가사" }],
      meditationAndPrayer: EMPTY_TIPTAP_DOC,
    });
    expect(result.success).toBe(true);
  });

  it("빈 섹션을 허용한다 — 연주 메모만 있는 섹션이 실제로 있다", () => {
    const result = PublishSchema.safeParse({
      kind: "PRAISE",
      youtubeUrl: "https://youtu.be/abc123",
      sections: [{ id: "a", label: "Interlude" }],
      meditationAndPrayer: EMPTY_TIPTAP_DOC,
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.kind === "PRAISE") {
      expect(result.data.sections[0]?.lyrics).toBe("");
    }
  });

  it("kind가 없으면 어떤 타입으로도 읽지 않는다", () => {
    expect(PublishSchema.safeParse({ scriptureRef: "시편 1편" }).success).toBe(false);
  });
});

describe("DraftSchema — 자동 저장은 무엇이든 저장한다 (04 §2.2)", () => {
  it("kind만 있어도 통과한다", () => {
    for (const kind of ["QT", "SERMON", "PRAISE", "TECH"]) {
      expect(DraftSchema.safeParse({ kind }).success).toBe(true);
    }
  });

  it("절반만 적힌 설교 초안을 저장한다 — 예배 중 첫 몇 초의 상태다", () => {
    const result = DraftSchema.safeParse({
      kind: "SERMON",
      title: undefined,
      scriptureRef: "전도",
    });
    expect(result.success).toBe(true);
  });

  it("찬양 초안의 섹션은 라벨만 있어도 된다", () => {
    const result = DraftSchema.safeParse({
      kind: "PRAISE",
      sections: [{ label: "Verse" }],
    });
    expect(result.success).toBe(true);
  });

  it("잘못된 URL은 초안에서도 막는다 — 형식이 틀린 값을 저장해두면 발행 때 터진다", () => {
    expect(DraftSchema.safeParse({ kind: "PRAISE", youtubeUrl: "nope" }).success).toBe(false);
  });

  it("kind가 없으면 저장하지 않는다 — content는 자기 기술적이어야 한다(05 §2)", () => {
    expect(DraftSchema.safeParse({ scriptureRef: "시편" }).success).toBe(false);
    expect(DraftSchema.safeParse({ kind: "DIARY" }).success).toBe(false);
  });
});

describe("타입 안전 경계 (ADR-002 근거 6)", () => {
  it("발행 스키마를 통과한 값은 필드가 필수인 타입으로 좁혀진다", () => {
    const result = PublishSchema.safeParse(qtPublishable);
    expect(result.success).toBe(true);
    if (!result.success || result.data.kind !== "QT") throw new Error("QT여야 한다");

    // 옵셔널 체이닝 없이 읽힌다 = 정적 타입에도 필수로 드러난다는 뜻이다.
    const groups: { group: string }[] = result.data.questionGroups;
    const ref: string = result.data.scriptureRef;
    expect(groups.length).toBeGreaterThan(0);
    expect(ref).toContain("열왕기상");
  });
});

describe("matchesPostType", () => {
  it("posts.type과 content.kind가 어긋나면 거른다", () => {
    expect(matchesPostType("QT", { kind: "QT" })).toBe(true);
    expect(matchesPostType("QT", { kind: "SERMON" })).toBe(false);
  });
});
