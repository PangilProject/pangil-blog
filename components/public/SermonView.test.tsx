import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PostContent } from "@/lib/content/schema";

/**
 * 본문 렌더러는 async 서버 컴포넌트라 jsdom이 await하지 못한다 — 그대로 두면 트리가 통째로
 * 비어버린다(PraiseView 테스트와 같은 사정). 이 파일의 주제는 말씀 조판이라 대역을 세운다.
 */
vi.mock("@/components/public/RichTextBody", () => ({
  RichTextBody: () => <div data-testid="body" />,
}));

const { SermonView } = await import("@/components/public/SermonView");

const doc = { type: "doc" as const, content: [] };

const sermon = (scriptureBody: string): Extract<PostContent, { kind: "SERMON" }> => ({
  kind: "SERMON",
  sermonTitle: "하나님의 편에 서라",
  scriptureRef: "에베소서 3장 14~21절",
  scriptureBody,
  body: doc,
});

/**
 * 말씀 조판은 큐티와 설교가 같아야 한다(03 §5.2). 설교만 본문 문자열을 통째로 넘기고 있어서
 * **줄바꿈이 HTML에서 공백으로 접혔다** — 절이 한 줄로 이어져 나왔고, 발행된 설교 108편이
 * 전부 그랬다.
 */
describe("SermonView — 말씀", () => {
  it("절마다 줄을 나눈다", () => {
    const { container } = render(
      <SermonView content={sermon("14. 이러므로 내가\n15. 이름을 주신 아버지 앞에")} />,
    );

    expect(container.querySelectorAll("figure p")).toHaveLength(2);
  });

  it("절 번호를 본문에서 떼어 세운다", () => {
    render(<SermonView content={sermon("14. 이러므로 내가\n15. 이름을 주신")} />);

    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText(/이러므로 내가/)).toBeInTheDocument();
  });

  /** 번호 없이 적는 날도 있다. 그때 본문이 사라지는 것보다 번호가 없는 편이 낫다 */
  it("번호가 없는 줄도 그대로 남긴다", () => {
    const { container } = render(<SermonView content={sermon("사랑은 오래 참고\n온유하며")} />);

    expect(container.querySelectorAll("figure p")).toHaveLength(2);
    expect(container.textContent).toContain("온유하며");
  });
});
