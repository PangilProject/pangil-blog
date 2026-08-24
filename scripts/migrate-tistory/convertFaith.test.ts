import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { convertPraise } from "@/scripts/migrate-tistory/convertPraise";
import { convertQt } from "@/scripts/migrate-tistory/convertQt";
import { convertSermon } from "@/scripts/migrate-tistory/convertSermon";
import { extractPost } from "@/scripts/migrate-tistory/extract";

/**
 * faith 세 타입은 HTML을 다시 파싱하지 않고 슬라이스 2의 변환 결과 위에서 구조만 가른다.
 * 그래서 여기서 고정할 것은 **구조 판정**이다 — 어디까지가 말씀이고, 무엇이 질문이고,
 * 무엇이 답변인가.
 */

function fixtureBody(name: string): string {
  const html = readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), "utf-8");
  return extractPost(html, "1/1-x.html").bodyHtml;
}

function docLength(doc: unknown): number {
  return ((doc as { content: unknown[] }).content ?? []).length;
}

describe("convertQt — 실제 QT 한 편", () => {
  const { content, notes } = convertQt(fixtureBody("qt-101"));

  it("말씀 범위와 절을 가른다", () => {
    expect(content.scriptureRef).toBe("마가복음 4장 26~34절");
    expect(content.scriptureBody.split("\n")[0]).toContain("26. 또 이르시되");
  });

  it("`-`로 시작하는 줄은 주석이다", () => {
    expect(content.annotations).toEqual([
      {
        term: "해석하시더라",
        body: "복음서에서는 단 한 번 사용되며, '설명하다' 라는 의미임",
      },
    ]);
  });

  it("4그룹 6질문으로 읽고 라벨을 지킨다", () => {
    expect(content.questionGroups.map((group) => group.group)).toEqual([
      "내용관찰",
      "연구와 묵상",
      "느낀 점",
      "결단과 적용",
    ]);
    expect(content.questionGroups.flatMap((group) => group.questions.map((q) => q.label))).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5-1",
      "5-2",
    ]);
  });

  it("답변을 질문에 붙이고 `:` 표시를 뗀다", () => {
    const answer = content.questionGroups[0].questions[0].answer as {
      content: { content: { text: string }[] }[];
    };

    expect(answer.content[0].content[0].text).toBe(
      "씨를 땅에 뿌림과 같고, 겨자씨 한 알과 같다고 비유하셨다.",
    );
  });

  it("답변이 여러 문단이면 이어 담는다", () => {
    expect(docLength(content.questionGroups[2].questions[0].answer)).toBe(2);
  });

  it("Summary는 요약으로 간다", () => {
    expect(docLength(content.summary)).toBe(1);
  });

  it("아무것도 흘리지 않는다", () => {
    expect(notes).toEqual([]);
  });
});

describe("convertQt — <br>로만 줄을 나눈 글", () => {
  it("한 문단에 질문·답변이 다 들어 있어도 읽는다", () => {
    const { content } = convertQt(
      [
        "<p><b>창세기 24장</b></p>",
        "<hr />",
        "<p><b>내용관찰</b><br /><b>1. 무엇입니까?</b><br />: 답이다.<br />&nbsp;<br />",
        "<b>2. 왜입니까?</b><br />: 그래서다.</p>",
      ].join(""),
    );

    expect(content.questionGroups).toHaveLength(1);
    expect(content.questionGroups[0].questions.map((q) => q.text)).toEqual([
      "무엇입니까?",
      "왜입니까?",
    ]);
  });
});

describe("convertSermon — 실제 설교 한 편", () => {
  const { content } = convertSermon(fixtureBody("sermon-1"));

  it("인용 블록 하나에 범위와 절이 함께 있으면 첫 줄만 범위로 뗀다", () => {
    expect(content.scriptureRef).toBe("빌립보서 4장 8~9절");
    expect(content.scriptureBody).not.toBe("");
  });

  it("가로선 이후는 본문이다", () => {
    expect(docLength(content.body)).toBeGreaterThan(5);
  });

  it("절이 목록으로 적혀 있어도 줄로 읽는다", () => {
    expect(content.scriptureBody.split("\n")).toHaveLength(2);
    expect(content.scriptureBody).not.toContain("기쁨의 성도들");
  });
});

describe("convertPraise — 실제 찬양 한 편", () => {
  const { content } = convertPraise(fixtureBody("praise-100"));

  it("유튜브 주소를 하나로 모은다 — 같은 영상이 링크와 임베드로 두 번 들어온다", () => {
    expect(content.youtubeUrl).toBe("https://www.youtube.com/watch?v=w7Twex62gpc");
  });

  it("라벨은 원문 그대로 남긴다 — 오타도 정보다", () => {
    const labels = content.sections.map((section) =>
      typeof section.label === "string" ? section.label : section.label.custom,
    );

    expect(labels[0]).toBe("Intro) 4 Bar".replace(") 4 Bar", ""));
    expect(labels).toContain("1-Chrosu");
    expect(labels).toContain("3-Verse) Key Up".replace(") Key Up", ""));
  });

  it("라벨과 같은 줄에 붙은 첫 가사를 잃지 않는다", () => {
    const chorus = content.sections.find(
      (section) => typeof section.label !== "string" && section.label.custom === "1-Chrosu",
    );

    expect(chorus?.lyrics.split("\n")[0]).toBe("채우시네 주님이");
  });

  it("가사 안의 빈 줄(절 구분)을 지킨다", () => {
    expect(content.sections.some((section) => section.lyrics.includes("\n\n"))).toBe(true);
  });

  it("섹션 id는 결정적이다 — 다시 돌려도 같은 값이어야 한다", () => {
    expect(content.sections.map((section) => section.id).slice(0, 3)).toEqual([
      "section-1",
      "section-2",
      "section-3",
    ]);
  });
});

describe("convertPraise — 영상이 없는 글", () => {
  it("주소 필드를 두지 않고 노트로 알린다 — 빈 문자열은 초안 저장도 막는다", () => {
    const { content, notes } = convertPraise("<p><b>Verse)</b></p><p>오라 우리가</p>");

    expect(content.youtubeUrl).toBeUndefined();
    expect(notes).toContain("유튜브 주소를 찾지 못했습니다");
    expect(content.sections).toHaveLength(1);
  });
});
