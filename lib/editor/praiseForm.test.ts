import { describe, expect, it } from "vitest";

import { DraftSchema, PublishSchema } from "@/lib/content/schema";
import {
  emptyPraiseForm,
  formatBarCount,
  fromDraftContent,
  isBarOnlyLabel,
  newSection,
  type PraiseFormValues,
  PraisePublishFormSchema,
  parseBarCount,
  sectionOrdinals,
  toDraftContent,
  toPublishContent,
} from "@/lib/editor/praiseForm";
import type { RichTextValue } from "@/lib/editor/richText";

const doc = (text: string): RichTextValue => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

function filled(): PraiseFormValues {
  return {
    title: "마커스워십 - 주님의 시간에",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    sections: [
      { id: "a", label: "Verse", lyrics: "주님의 시간에" },
      { id: "b", label: "Chorus", lyrics: "내가 주를 찬양하리" },
      { id: "c", label: "Verse", lyrics: "" },
    ],
    meditationAndPrayer: doc("기다림을 배웁니다"),
    tags: [],
  };
}

describe("sectionOrdinals — Verse 넘버링은 파생 계산이다 (04 §2.5)", () => {
  it("같은 라벨이 두 번 이상일 때만 번호를 매긴다", () => {
    expect(sectionOrdinals(filled().sections)).toEqual([1, undefined, 2]);
  });

  it("순서를 바꾸면 번호도 따라온다 — 저장된 번호가 없으니 어긋날 수 없다", () => {
    const [verse1, chorus, verse2] = filled().sections;
    if (!verse1 || !chorus || !verse2) throw new Error("fixture");

    expect(sectionOrdinals([verse2, chorus, verse1])).toEqual([1, undefined, 2]);
  });
});

describe("emptyPraiseForm", () => {
  it("첫 섹션이 놓인 상태로 열린다 — 빈 화면을 주지 않는다", () => {
    expect(emptyPraiseForm().sections).toHaveLength(1);
    expect(emptyPraiseForm().sections[0]?.label).toBe("Verse");
  });

  it("섹션 id는 서로 다르다 — 재정렬 키다", () => {
    expect(newSection().id).not.toBe(newSection().id);
  });

  /**
   * 빈 폼은 서버에서도 만들어진다(새 글 페이지). 프리렌더는 재현 가능한 출력만 허용하므로
   * 여기서 난수를 쓰면 빌드가 거부한다 — 실제로 그랬다(ADR-003).
   */
  it("빈 폼의 섹션 id는 결정적이다 — 서버에서 만들어도 안전하다", () => {
    expect(emptyPraiseForm().sections[0]?.id).toBe(emptyPraiseForm().sections[0]?.id);
    expect(emptyPraiseForm().sections[0]?.id).toBe("section-1");
  });
});

describe("발행 게이트", () => {
  it("갖춰지면 통과한다", () => {
    expect(PraisePublishFormSchema.safeParse(filled()).success).toBe(true);
  });

  it("유튜브 주소가 아니면 막는다", () => {
    const result = PraisePublishFormSchema.safeParse({
      ...filled(),
      youtubeUrl: "https://vimeo.com/1",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("유튜브 주소를 확인해 주세요");
  });

  it("묵상과 기도가 비면 막는다 — 이 글의 본문이다", () => {
    const result = PraisePublishFormSchema.safeParse({
      ...filled(),
      meditationAndPrayer: { type: "doc", content: [] },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("묵상과 기도를 적어주세요");
  });

  it("가사가 빈 섹션은 막지 않는다 — 연주 메모만 있는 섹션이 있다", () => {
    expect(
      PraisePublishFormSchema.safeParse({
        ...filled(),
        sections: [{ id: "a", label: "Interlude", lyrics: "" }],
      }).success,
    ).toBe(true);
  });
});

describe("저장 계약 변환 (05 §2)", () => {
  it("라벨 7종은 그대로, 밖은 직접 입력으로 싣는다", () => {
    const content = toPublishContent({
      ...filled(),
      sections: [
        { id: "a", label: "Chorus", lyrics: "" },
        { id: "b", label: "Refrain", lyrics: "" },
      ],
    });
    if (content.kind !== "PRAISE") throw new Error("PRAISE content여야 한다");

    expect(content.sections[0]?.label).toBe("Chorus");
    expect(content.sections[1]?.label).toEqual({ custom: "Refrain" });
    expect(PublishSchema.safeParse(content).success).toBe(true);
  });

  it("아직 안 적은 URL은 필드를 넣지 않는다 — 빈 문자열은 초안 저장을 거절시킨다", () => {
    const content = toDraftContent({ ...emptyPraiseForm(), youtubeUrl: "" });

    expect(content).not.toHaveProperty("youtubeUrl");
    expect(DraftSchema.safeParse(content).success).toBe(true);
  });

  it("반쯤 적힌 URL은 초안에서도 거른다 — 발행 때 터지면 이미 다 적어놓은 상태다", () => {
    const content = toDraftContent({ ...emptyPraiseForm(), youtubeUrl: "http" });

    expect(DraftSchema.safeParse(content).success).toBe(false);
  });

  it("빈 폼 초안도 DraftSchema를 통과한다", () => {
    expect(DraftSchema.safeParse(toDraftContent(emptyPraiseForm())).success).toBe(true);
  });
});

describe("fromDraftContent — 이어쓰기 진입", () => {
  it("직접 입력 라벨을 평평한 문자열로 되돌린다", () => {
    const saved = toDraftContent({
      ...filled(),
      sections: [{ id: "a", label: "Tag", lyrics: "한 번 더" }],
    });

    const form = fromDraftContent(saved, "제목");

    expect(form.sections[0]).toMatchObject({ id: "a", label: "Tag", lyrics: "한 번 더" });
  });

  it("섹션이 없는 초안은 첫 섹션이 놓인 채 열린다", () => {
    const form = fromDraftContent({ kind: "PRAISE" }, "제목");

    expect(form.sections).toHaveLength(1);
    expect(form.youtubeUrl).toBe("");
  });
});

describe("마디 수 — 가사가 없는 섹션 (Intro·Interlude·Outro)", () => {
  it("연주 구간 라벨만 마디 수 칸을 연다", () => {
    expect(isBarOnlyLabel("Intro")).toBe(true);
    expect(isBarOnlyLabel("Outro")).toBe(true);
    expect(isBarOnlyLabel("Chorus")).toBe(false);
  });

  it("저장은 기존 가사 문자열에 실린다 — 필드를 새로 파지 않는다", () => {
    expect(formatBarCount("4")).toBe("4 Bar");
    expect(parseBarCount("4 Bar")).toBe("4");
    expect(parseBarCount("16bar")).toBe("16");
  });

  it("빈 값은 빈 값이다 — 0은 마디가 아니다", () => {
    expect(formatBarCount("")).toBe("");
    expect(formatBarCount("0")).toBe("");
    expect(parseBarCount("")).toBe("");
  });

  it("마디 표기가 아닌 글자는 null이다 — 이관해 온 연주 메모를 숫자 칸에 끼우지 않는다", () => {
    expect(parseBarCount("기타 솔로")).toBeNull();
  });
});
