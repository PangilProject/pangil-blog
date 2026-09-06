import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PostContent } from "@/lib/content/schema";

/**
 * 본문 렌더러는 async 서버 컴포넌트다 — jsdom에서 await할 수 없어 트리가 비어버린다(그러면
 * 단정이 거짓 통과한다). 이 테스트의 주제는 섹션과 임베드이므로 본문은 대역을 세운다.
 */
vi.mock("@/components/public/RichTextBody", () => ({
  RichTextBody: () => <div data-testid="body" />,
}));

const { PraiseView } = await import("@/components/public/PraiseView");

/**
 * 공개 지면은 읽는 사람의 자리다. 에디터의 안내 문구가 여기 새어 나오면 안 된다 —
 * 실제로 빈 섹션에 "가사를 적어보세요"가 공개 지면에 찍혔다.
 */
const content = {
  kind: "PRAISE",
  youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  sections: [
    { id: "a", label: "Intro" as const, lyrics: "" },
    { id: "b", label: "Verse" as const, lyrics: "우리 함께 손잡고 가세" },
  ],
  meditationAndPrayer: { type: "doc" as const, content: [] },
} satisfies Extract<PostContent, { kind: "PRAISE" }>;

describe("PraiseView", () => {
  it("빈 섹션에 에디터 안내 문구를 쓰지 않는다", () => {
    render(<PraiseView content={content} title="손잡고 함께 가세" />);

    expect(screen.queryByText("가사를 적어보세요")).toBeNull();
  });

  it("빈 섹션 자체는 남긴다 — 연주 구간도 기록이다(02 §5.4)", () => {
    render(<PraiseView content={content} title="손잡고 함께 가세" />);

    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(screen.getByText("우리 함께 손잡고 가세")).toBeInTheDocument();
  });

  it("묵상 블록 수만큼 본문을 그린다 — 끊어 쓴 자리가 지면에도 남는다", () => {
    render(
      <PraiseView
        content={{
          ...content,
          meditationAndPrayer: [
            { type: "doc", content: [] },
            { type: "doc", content: [] },
          ],
        }}
        title="손잡고 함께 가세"
      />,
    );

    expect(screen.getAllByTestId("body")).toHaveLength(2);
  });

  it("감춘 묵상 덩이는 나가지 않는다", () => {
    render(
      <PraiseView
        content={{
          ...content,
          meditationAndPrayer: [
            { type: "doc", content: [] },
            { doc: { type: "doc", content: [] }, hidden: true },
          ],
        }}
        title="손잡고 함께 가세"
      />,
    );

    expect(screen.getAllByTestId("body")).toHaveLength(1);
  });

  it("다 감추면 묵상과 기도 소제목도 세우지 않는다", () => {
    render(
      <PraiseView
        content={{
          ...content,
          meditationAndPrayer: [{ doc: { type: "doc", content: [] }, hidden: true }],
        }}
        title="손잡고 함께 가세"
      />,
    );

    expect(screen.queryByText("묵상과 기도")).toBeNull();
  });

  it("묵상과 기도에 복사 버튼이 선다 — 발행된 글을 옮겨 적을 수 있어야 한다", () => {
    render(
      <PraiseView
        content={{
          ...content,
          meditationAndPrayer: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "기다림을 배웁니다" }] },
            ],
          },
        }}
        title="손잡고 함께 가세"
      />,
    );

    expect(screen.getByLabelText("묵상과 기도 복사")).toBeInTheDocument();
  });

  it("옮겨 적을 글자가 없으면 복사 버튼도 세우지 않는다", () => {
    render(<PraiseView content={content} title="손잡고 함께 가세" />);

    expect(screen.queryByLabelText("묵상과 기도 복사")).toBeNull();
  });

  it("영상은 클릭 전 썸네일이다", () => {
    const { container } = render(<PraiseView content={content} title="손잡고 함께 가세" />);

    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("img")).not.toBeNull();
  });
});
