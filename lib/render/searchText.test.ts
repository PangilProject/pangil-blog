import { describe, expect, it } from "vitest";

import { EMPTY_TIPTAP_DOC, type TiptapDoc } from "@/lib/content/schema";
import { normalizeWhitespace, tiptapToCopyText, tiptapToPlainText } from "@/lib/render/plainText";
import { extractSearchText } from "@/lib/render/searchText";

const doc = (...texts: string[]): TiptapDoc => ({
  type: "doc",
  content: texts.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
});

describe("tiptapToPlainText — 04 §3.1 평문 타깃", () => {
  it("문단 텍스트를 이어붙인다", () => {
    expect(tiptapToPlainText(doc("첫 문단", "둘째 문단"))).toBe("첫 문단 둘째 문단");
  });

  it("중첩된 노드도 훑는다", () => {
    const nested: TiptapDoc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "항목" }] }],
            },
          ],
        },
      ],
    };
    expect(tiptapToPlainText(nested)).toBe("항목");
  });

  it("모르는 노드 때문에 실패하지 않는다 — 색인이 낯선 노드에 걸리면 안 된다", () => {
    const weird: TiptapDoc = {
      type: "doc",
      content: [
        { type: "customEmbed", attrs: { src: "x" } },
        { type: "text", text: "본문" },
      ],
    };
    expect(tiptapToPlainText(weird)).toBe("본문");
  });

  it("빈 문서와 없는 문서를 모두 견딘다", () => {
    expect(tiptapToPlainText(EMPTY_TIPTAP_DOC)).toBe("");
    expect(tiptapToPlainText(null)).toBe("");
    expect(tiptapToPlainText(undefined)).toBe("");
  });
});

/**
 * 문단 **안**의 줄바꿈(`hardBreak`)이 두 타깃에서 각각 어떻게 나와야 하는가.
 *
 * 티스토리 컨버터가 `<br>`을 전부 이 노드로 옮겼으므로(`convertHtml.ts:218`) 이관해 온 글
 * 대부분이 이 모양이다. 여기 없던 동안 색인에서 두 줄이 한 낱말로 붙었다.
 */
const withBreak: TiptapDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "감사" },
        { type: "hardBreak" },
        { type: "text", text: "합니다" },
      ],
    },
  ],
};

describe("문단 안의 줄바꿈", () => {
  it("색인에서는 낱말이 갈린다 — 붙으면 `감사합니다`로 검색해야만 걸린다", () => {
    expect(tiptapToPlainText(withBreak)).toBe("감사 합니다");
  });

  it("붙여넣기에서는 줄이 그대로 남는다 — 찬양 `묵상과 기도 복사`가 이 길을 쓴다", () => {
    expect(tiptapToCopyText(withBreak)).toBe("감사\n합니다");
  });
});

describe("tiptapToCopyText — 붙여넣기용은 줄바꿈을 살린다", () => {
  it("문단마다 줄을 남긴다 — 색인용과 달리 여기서는 문단이 곧 의미다", () => {
    expect(tiptapToCopyText(doc("첫 문단", "둘째 문단"))).toBe("첫 문단\n둘째 문단");
  });

  it("목록도 같은 한 줄이다 — 문단만 줄이 살고 목록은 겹치는 일이 없다", () => {
    const listed: TiptapDoc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "항목" }] }],
            },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "다음 문단" }] },
      ],
    };

    expect(tiptapToCopyText(listed)).toBe("항목\n다음 문단");
  });

  it("없는 문서는 빈 문자열이다", () => {
    expect(tiptapToCopyText(null)).toBe("");
  });
});

describe("normalizeWhitespace", () => {
  it("연속 공백·줄바꿈을 한 칸으로 접는다", () => {
    expect(normalizeWhitespace("  a \n\n b\t c ")).toBe("a b c");
  });
});

describe("extractSearchText — 05 §4A", () => {
  it("QT는 말씀·주석·질문 원문·내 답변·요약을 모두 담는다", () => {
    const text = extractSearchText("주님이 네 악을", {
      kind: "QT",
      scriptureRef: "열왕기상 2장 41~46절",
      scriptureBody: "시므이가 예루살렘에서",
      annotations: [{ term: "송사", body: "공의로 다스림" }],
      questionGroups: [
        {
          group: "내용관찰",
          questions: [{ label: "1", text: "무엇을 보았습니까", answer: doc("하나님의 공의") }],
        },
      ],
      summary: doc("오늘의 요약"),
    });

    expect(text).toContain("주님이 네 악을");
    expect(text).toContain("열왕기상");
    expect(text).toContain("송사");
    expect(text).toContain("무엇을 보았습니까");
    expect(text).toContain("하나님의 공의");
    expect(text).toContain("오늘의 요약");
  });

  it("설교는 말씀과 라이브 본문·요약을 담는다", () => {
    const text = extractSearchText("오늘이라는 선물", {
      kind: "SERMON",
      scriptureRef: "전도서 9장 7~10절",
      scriptureBody: "너는 가서",
      body: doc("설교 속기 내용"),
      summary: doc("예배 후 요약"),
    });

    expect(text).toContain("전도서");
    expect(text).toContain("설교 속기 내용");
    expect(text).toContain("예배 후 요약");
  });

  it("찬양은 가사와 기도문을 담는다 — 가사로 곡을 찾는다", () => {
    const text = extractSearchText("마커스워십 - 주의 노래 가득해", {
      kind: "PRAISE",
      youtubeUrl: "https://youtu.be/x",
      sections: [
        { id: "a", label: "Verse", lyrics: "내 마음의 노래를" },
        { id: "b", label: { custom: "Refrain" }, lyrics: "선포하라" },
      ],
      meditationAndPrayer: doc("가사를 묵상하며"),
    });

    expect(text).toContain("내 마음의 노래를");
    expect(text).toContain("Refrain");
    expect(text).toContain("가사를 묵상하며");
  });

  it("묵상이 블록 여러 개여도 전부 담는다 — 뒤쪽 블록으로도 글을 찾는다", () => {
    const text = extractSearchText("마커스워십 - 주의 노래 가득해", {
      kind: "PRAISE",
      youtubeUrl: "https://youtu.be/x",
      sections: [{ id: "a", label: "Verse", lyrics: "내 마음의 노래를" }],
      meditationAndPrayer: [doc("가사를 묵상하며"), doc("오늘도 지키소서")],
    });

    expect(text).toContain("가사를 묵상하며");
    expect(text).toContain("오늘도 지키소서");
  });

  it("감춘 묵상 덩이도 담지 않는다 — 가사와 같은 규칙이다", () => {
    const text = extractSearchText("마커스워십 - 주의 노래 가득해", {
      kind: "PRAISE",
      youtubeUrl: "https://youtu.be/x",
      sections: [{ id: "a", label: "Verse", lyrics: "내 마음의 노래를" }],
      meditationAndPrayer: [doc("가사를 묵상하며"), { doc: doc("감춘 기도입니다"), hidden: true }],
    });

    expect(text).toContain("가사를 묵상하며");
    expect(text).not.toContain("감춘 기도입니다");
  });

  it("기술 글은 제목과 본문을 담는다", () => {
    const text = extractSearchText("티스토리를 떠나며", {
      kind: "TECH",
      body: doc("이주 회고"),
    });

    expect(text).toBe("티스토리를 떠나며 이주 회고");
  });

  it("빈 값은 공백으로 새지 않는다", () => {
    const text = extractSearchText("제목", {
      kind: "SERMON",
      scriptureRef: "시편 1편",
      scriptureBody: "복 있는 사람은",
      body: EMPTY_TIPTAP_DOC,
    });

    expect(text).toBe("제목 시편 1편 복 있는 사람은");
  });
});
