import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnnotationBox } from "@/components/record/AnnotationBox";
import { ScriptureBlock } from "@/components/record/ScriptureBlock";

describe("ScriptureBlock — 03 §5.2", () => {
  it("QT는 액센트 세로 괘를 세운다", () => {
    render(<ScriptureBlock reference="열왕기상 2장 41~46절">본문</ScriptureBlock>);

    const block = screen.getByRole("figure");
    expect(block.className).toContain("border-l-2");
    expect(block.className).toContain("border-(--accent)");
  });

  it("설교는 인용 블록으로 조판한다", () => {
    render(
      <ScriptureBlock variant="sermon" reference="전도서 9장 7~10절">
        본문
      </ScriptureBlock>,
    );

    const block = screen.getByRole("figure");
    expect(block.className).toContain("bg-crawl");
    expect(block.className).not.toContain("border-l-2");
  });

  it("말씀은 세리프와 넓은 행간으로 적는다 — 성별된 자리다", () => {
    render(<ScriptureBlock reference="시편 1편">복 있는 사람은</ScriptureBlock>);

    const body = screen.getByText("복 있는 사람은");
    expect(body.className).toContain("font-serif");
    expect(body.className).toContain("leading-scripture");
  });

  it("절 번호는 타자기체로 앞에 세운다", () => {
    render(
      <ScriptureBlock
        reference="열왕기상 2장"
        verses={[
          { number: 41, text: "시므이가 예루살렘에서" },
          { number: 42, text: "왕이 사람을 보내어" },
        ]}
      />,
    );

    expect(screen.getByText("41")).toBeInTheDocument();
    expect(screen.getByText(/시므이가 예루살렘에서/)).toBeInTheDocument();
    expect(screen.getByText("41").className).toContain("font-code");
  });

  it("말씀 범위를 캡션으로 적는다", () => {
    render(<ScriptureBlock reference="열왕기상 2장 41~46절">본문</ScriptureBlock>);
    expect(screen.getByText("열왕기상 2장 41~46절")).toBeInTheDocument();
  });
});

describe("AnnotationBox — 365qt 원문 주석", () => {
  it("용어·절·풀이를 한 항목으로 적는다", () => {
    render(
      <AnnotationBox
        annotations={[
          { term: "송사를 듣고 분별하는 지혜", verseRef: "11절", body: "공의로 다스리는 능력" },
        ]}
      />,
    );

    expect(screen.getByText("송사를 듣고 분별하는 지혜")).toBeInTheDocument();
    expect(screen.getByText("11절")).toBeInTheDocument();
    expect(screen.getByText(/공의로 다스리는 능력/)).toBeInTheDocument();
  });

  it("주석이 없는 날은 상자 자체를 두지 않는다 — 0개는 정상이다", () => {
    const { container } = render(<AnnotationBox annotations={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
