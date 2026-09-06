import { describe, expect, it } from "vitest";

import { DraftSchema, PublishSchema } from "@/lib/content/schema";
import {
  emptyPraiseForm,
  formatBarCount,
  fromDraftContent,
  isBarOnlyLabel,
  isEmptyForm,
  loadableSources,
  newSection,
  type PraiseFormValues,
  PraisePublishFormSchema,
  parseBarCount,
  sectionOrdinals,
  toDraftContent,
  toPublishContent,
} from "@/lib/editor/praiseForm";
import { type RichTextValue, toTiptapDoc } from "@/lib/editor/richText";

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
    meditationBlocks: [{ id: "m1", doc: doc("기다림을 배웁니다") }],
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

  it("되풀이되는 절은 같은 번호다 — 2절을 한 번 더 부른 자리가 3절이 되면 없는 절이 생긴다", () => {
    const numbers = sectionOrdinals([
      { label: "Verse", lyrics: "1절" },
      { label: "Verse", lyrics: "2절" },
      { label: "Chorus", lyrics: "후렴" },
      { label: "Verse", lyrics: "2절" },
    ]);

    expect(numbers).toEqual([1, 2, undefined, 2]);
  });

  it("가사 앞뒤 공백은 같은 절로 본다 — 불러온 가사에 줄바꿈이 하나 더 붙는 일이 있다", () => {
    expect(
      sectionOrdinals([
        { label: "Verse", lyrics: "1절" },
        { label: "Verse", lyrics: "2절" },
        { label: "Verse", lyrics: "  2절\n" },
      ]),
    ).toEqual([1, 2, 2]);
  });

  it("되풀이뿐이면 번호를 안 매긴다 — 서로 다른 절이 하나면 2절은 없다", () => {
    expect(
      sectionOrdinals([
        { label: "Verse", lyrics: "1절" },
        { label: "Verse", lyrics: "1절" },
      ]),
    ).toEqual([undefined, undefined]);
  });

  it("빈 섹션끼리는 묶지 않는다 — 타이핑 중에는 늘 빈 칸이 하나 열려 있다", () => {
    expect(
      sectionOrdinals([
        { label: "Verse", lyrics: "1절" },
        { label: "Verse", lyrics: "" },
        { label: "Verse", lyrics: "" },
      ]),
    ).toEqual([1, 2, 3]);
  });

  it("라벨이 다르면 가사가 같아도 남남이다", () => {
    expect(
      sectionOrdinals([
        { label: "Verse", lyrics: "같은 말" },
        { label: "Chorus", lyrics: "같은 말" },
      ]),
    ).toEqual([undefined, undefined]);
  });
});

describe("loadableSources — 가사 불러오기 (02 §5.4)", () => {
  const song = [
    { label: "Intro", lyrics: "4 Bar" },
    { label: "Verse", lyrics: "1절" },
    { label: "Chorus", lyrics: "후렴" },
    { label: "Verse", lyrics: "2절" },
    { label: "Verse", lyrics: "" },
  ];

  it("이름에 번호가 따라온다 — 무엇을 가져오는지가 이름 하나로 정해져야 한다", () => {
    expect(loadableSources(song, 4).map((source) => source.name)).toEqual([
      "Verse 1",
      "Chorus",
      "Verse 2",
    ]);
  });

  it("라벨을 함께 들고 온다 — 가져오는 것은 그 절이지 글자만이 아니다", () => {
    const chorus = loadableSources(song, 4).find((source) => source.label === "Chorus");

    expect(chorus).toMatchObject({ label: "Chorus", lyrics: "후렴" });
  });

  it("제 자신·빈 섹션·연주 구간은 세우지 않는다", () => {
    const names = loadableSources(song, 2).map((source) => source.name);

    expect(names).toEqual(["Verse 1", "Verse 2"]);
  });

  it("이미 되풀이된 절은 한 번만 세운다 — 두 줄 다 같은 것이다", () => {
    const repeated = [
      { label: "Verse", lyrics: "1절" },
      { label: "Verse", lyrics: "2절" },
      { label: "Verse", lyrics: "2절" },
      { label: "Chorus", lyrics: "" },
    ];

    expect(loadableSources(repeated, 3).map((source) => source.name)).toEqual([
      "Verse 1",
      "Verse 2",
    ]);
  });
});

describe("불러오기 시나리오 — Verse 2를 가져온 자리는 Verse 2다", () => {
  it("빈 섹션을 더하면 3이지만, Verse 2를 가져오는 순간 2가 된다", () => {
    const typed = [
      { label: "Verse", lyrics: "1절" },
      { label: "Verse", lyrics: "2절" },
    ];

    // + 섹션 → 아직 빈 칸이라 제 번호를 받는다
    const added = [...typed, { label: "Verse", lyrics: "" }];
    expect(sectionOrdinals(added)).toEqual([1, 2, 3]);

    // 그 칸의 불러오기 목록에서 "Verse 2"를 고른다
    const picked = loadableSources(added, 2).find((source) => source.name === "Verse 2");
    if (!picked) throw new Error("Verse 2를 가져올 수 있어야 한다");

    const loaded = added.map((section, at) =>
      at === 2 ? { label: picked.label, lyrics: picked.lyrics } : section,
    );
    expect(sectionOrdinals(loaded)).toEqual([1, 2, 2]);
  });

  it("가져오고 나면 원본은 목록에서 빠진다 — 같은 것을 또 가져올 일이 없다", () => {
    const loaded = [
      { label: "Verse", lyrics: "1절" },
      { label: "Verse", lyrics: "2절" },
      { label: "Verse", lyrics: "2절" },
    ];

    expect(loadableSources(loaded, 2).map((source) => source.name)).toEqual(["Verse 1"]);
  });
});

describe("emptyPraiseForm", () => {
  it("Intro · Verse가 놓인 상태로 열린다 — 곡은 거의 늘 전주로 시작한다", () => {
    expect(emptyPraiseForm().sections.map((section) => section.label)).toEqual(["Intro", "Verse"]);
  });

  it("열린 섹션에는 아무것도 안 적혀 있다 — 빈 폼이라는 판정이 흔들리면 서식 전환이 막힌다", () => {
    expect(isEmptyForm(emptyPraiseForm())).toBe(true);
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
      meditationBlocks: [{ id: "m1", doc: { type: "doc", content: [] } }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("묵상과 기도를 적어주세요");
  });

  it("블록이 여러 개여도 하나만 적혀 있으면 통과한다 — 빈 블록은 저장에서 떨어진다", () => {
    const result = PraisePublishFormSchema.safeParse({
      ...filled(),
      meditationBlocks: [
        { id: "m1", doc: doc("기다림을 배웁니다") },
        { id: "m2", doc: { type: "doc", content: [] } },
      ],
    });

    expect(result.success).toBe(true);
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

    expect(form.sections.map((section) => section.label)).toEqual(["Intro", "Verse"]);
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

describe("묵상과 기도 — 블록 목록 (02 §5.4)", () => {
  it("저장은 늘 배열이다. 빈 블록은 떨군다", () => {
    const content = toPublishContent({
      ...filled(),
      meditationBlocks: [
        { id: "m1", doc: doc("기다림을 배웁니다") },
        { id: "m2", doc: { type: "doc", content: [] } },
        { id: "m3", doc: doc("오늘도 지키소서") },
      ],
    });

    if (content.kind !== "PRAISE") throw new Error("PRAISE가 아니다");
    expect(content.meditationAndPrayer).toHaveLength(2);
    expect(PublishSchema.safeParse(content).success).toBe(true);
  });

  it("문서 하나로 저장된 옛 글은 블록 하나로 열린다", () => {
    const form = fromDraftContent(
      { kind: "PRAISE", meditationAndPrayer: toTiptapDoc(doc("옛 글의 묵상")) },
      "제목",
    );

    expect(form.meditationBlocks).toHaveLength(1);
    expect(form.meditationBlocks[0]?.doc).toEqual(doc("옛 글의 묵상"));
  });

  it("묵상이 없는 초안도 첫 블록이 놓인 채 열린다", () => {
    expect(fromDraftContent({ kind: "PRAISE" }, "제목").meditationBlocks).toHaveLength(1);
  });

  it("블록 배열은 다시 읽어도 그대로다 — 왕복이 값을 바꾸지 않는다", () => {
    const saved = toDraftContent({
      ...filled(),
      meditationBlocks: [
        { id: "m1", doc: doc("첫 덩이") },
        { id: "m2", doc: doc("둘째 덩이") },
      ],
    });

    const form = fromDraftContent(saved, "제목");

    expect(form.meditationBlocks.map((block) => block.doc)).toEqual([
      doc("첫 덩이"),
      doc("둘째 덩이"),
    ]);
  });
});

describe("isEmptyForm — 서식 전환 조건", () => {
  it("섹션 하나가 놓인 빈 폼은 비어 있다 — 라벨만 있는 섹션은 아직 빈 것이다", () => {
    expect(isEmptyForm(emptyPraiseForm())).toBe(true);
  });

  it("가사나 주소가 있으면 비어 있지 않다", () => {
    const base = emptyPraiseForm();

    expect(isEmptyForm({ ...base, youtubeUrl: "https://youtu.be/x" })).toBe(false);
    expect(
      isEmptyForm({ ...base, sections: [{ id: "a", label: "Verse", lyrics: "주님의 시간에" }] }),
    ).toBe(false);
    expect(isEmptyForm(filled())).toBe(false);
  });
});
