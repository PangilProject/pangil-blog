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

/**
 * 감춘 덩이 조회는 서버 액션이다 — 그 모듈은 Prisma를 끌고 오므로 대역을 세운다.
 * 이 파일의 주제는 지면에 무엇이 나가는가이고, 조회는 아일랜드 쪽 이야기다.
 */
vi.mock("@/lib/actions/praise", () => ({
  loadHiddenMeditation: vi.fn(async () => []),
}));

const { PraiseView } = await import("@/components/public/PraiseView");

const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

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
    render(<PraiseView content={content} title="손잡고 함께 가세" postId="post-1" />);

    expect(screen.queryByText("가사를 적어보세요")).toBeNull();
  });

  it("빈 섹션 자체는 남긴다 — 연주 구간도 기록이다(02 §5.4)", () => {
    render(<PraiseView content={content} title="손잡고 함께 가세" postId="post-1" />);

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
        postId="post-1"
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
        postId="post-1"
      />,
    );

    expect(screen.getAllByTestId("body")).toHaveLength(1);
  });

  /**
   * 절 자체는 남긴다 — 본인이 보면 감춘 덩이가 그 안에 나온다(OwnerMeditation).
   * 공개된 덩이가 없다고 절을 지우면 내 지면에서 그 글이 사라진다.
   */
  it("다 감춘 글에서도 절은 서지만, 나가는 덩이는 없다", () => {
    render(
      <PraiseView
        content={{
          ...content,
          meditationAndPrayer: [
            {
              doc: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "감춘 기도" }] }],
              },
              hidden: true,
            },
          ],
        }}
        title="손잡고 함께 가세"
        postId="post-1"
      />,
    );

    expect(screen.getByText("묵상과 기도")).toBeInTheDocument();
    expect(screen.queryAllByTestId("body")).toHaveLength(0);
    // 감춘 글자는 읽는 사람의 HTML에 없다
    expect(screen.queryByText("감춘 기도")).toBeNull();
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
        postId="post-1"
      />,
    );

    expect(screen.getByLabelText("묵상과 기도 복사")).toBeInTheDocument();
  });

  it("덩이마다 복사가 붙는다 — 끊어 쓴 자리가 곧 복사 단위다", () => {
    render(
      <PraiseView
        content={{
          ...content,
          meditationAndPrayer: [doc("묵상 덩이"), doc("기도 덩이")],
        }}
        title="손잡고 함께 가세"
        postId="post-1"
      />,
    );

    expect(screen.getByLabelText("묵상과 기도 1 복사")).toBeInTheDocument();
    expect(screen.getByLabelText("묵상과 기도 2 복사")).toBeInTheDocument();
  });

  /**
   * **눈으로 구분되어야 한다.** 덩이가 여럿이면 머리줄 복사 바로 아래에 첫 덩이의 복사가
   * 붙어 서는데, 둘 다 화면 글자가 `복사`이던 동안 무엇이 다른지가 `aria-label`에만 있었다 —
   * 읽어 주는 이름은 눈에 안 보인다. 덩이가 하나뿐이면 덩이 버튼이 없으므로 그대로 `복사`다
   * (전수조사 디자인 5-6).
   */
  it("덩이가 여럿이면 머리줄은 `전체 복사`다 — 화면 글자가 서로 다르다", () => {
    render(
      <PraiseView
        content={{
          ...content,
          meditationAndPrayer: [doc("묵상 덩이"), doc("기도 덩이")],
        }}
        title="손잡고 함께 가세"
        postId="post-1"
      />,
    );

    expect(screen.getByLabelText("묵상과 기도 복사")).toHaveTextContent("전체 복사");
    // 나란히 선 셋 중 같은 글자는 덩이 버튼 둘뿐이고, 그 둘은 서로 떨어져 있다
    expect(screen.getByLabelText("묵상과 기도 1 복사")).toHaveTextContent("복사");
    expect(screen.getAllByText("전체 복사")).toHaveLength(1);
  });

  it("덩이가 하나면 머리줄은 그냥 `복사`다 — 견줄 상대가 없으면 `전체`가 군더더기다", () => {
    render(
      <PraiseView
        content={{ ...content, meditationAndPrayer: [doc("묵상 덩이 하나")] }}
        title="손잡고 함께 가세"
        postId="post-1"
      />,
    );

    expect(screen.getByLabelText("묵상과 기도 복사")).toHaveTextContent("복사");
    expect(screen.queryByText("전체 복사")).toBeNull();
  });

  it("옮겨 적을 글자가 없으면 복사 버튼도 세우지 않는다", () => {
    render(<PraiseView content={content} title="손잡고 함께 가세" postId="post-1" />);

    expect(screen.queryByLabelText("묵상과 기도 복사")).toBeNull();
  });

  it("영상은 클릭 전 썸네일이다", () => {
    const { container } = render(
      <PraiseView content={content} title="손잡고 함께 가세" postId="post-1" />,
    );

    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("img")).not.toBeNull();
  });
});
