import { describe, expect, it } from "vitest";

import { collectImageSrcs, rewriteImageSrcs } from "@/scripts/migrate-tistory/imageNodes";

/**
 * 이미지는 본문 맨 위에만 있는 게 아니다 — QT 답변 안에도 있다. 한 장이라도 못 찾으면
 * 그 이미지는 티스토리 CDN을 계속 가리키고, 원본이 사라지는 날 깨진다.
 */

const qtContent = {
  kind: "QT",
  questionGroups: [
    {
      group: "내용관찰",
      questions: [
        {
          label: "1",
          text: "무엇입니까?",
          answer: {
            type: "doc",
            content: [{ type: "image", attrs: { src: "./img/img.png", alt: "" } }],
          },
        },
      ],
    },
  ],
  summary: {
    type: "doc",
    content: [{ type: "image", attrs: { src: "https://velog.velcdn.com/a.png" } }],
  },
};

describe("collectImageSrcs", () => {
  it("답변·요약 안의 이미지까지 찾는다", () => {
    expect(collectImageSrcs(qtContent)).toEqual([
      "./img/img.png",
      "https://velog.velcdn.com/a.png",
    ]);
  });

  it("이미지가 없으면 빈 배열", () => {
    expect(collectImageSrcs({ kind: "TECH", body: { type: "doc", content: [] } })).toEqual([]);
  });
});

describe("rewriteImageSrcs", () => {
  const replacements = new Map([
    ["./img/img.png", { src: "https://x.supabase.co/a.png", width: 800, height: 600 }],
  ]);

  it("주소를 바꾸고 폭·높이를 채운다", () => {
    const rewritten = rewriteImageSrcs(qtContent, replacements);
    const image = rewritten.questionGroups[0].questions[0].answer.content[0] as {
      attrs: Record<string, unknown>;
    };

    expect(image.attrs).toEqual({
      src: "https://x.supabase.co/a.png",
      alt: "",
      width: 800,
      height: 600,
    });
  });

  it("지도에 없는 이미지는 그대로 둔다", () => {
    const rewritten = rewriteImageSrcs(qtContent, replacements);

    expect(rewritten.summary.content[0]).toEqual({
      type: "image",
      attrs: { src: "https://velog.velcdn.com/a.png" },
    });
  });

  it("원본을 제자리에서 고치지 않는다", () => {
    rewriteImageSrcs(qtContent, replacements);

    expect(collectImageSrcs(qtContent)).toContain("./img/img.png");
  });
});
