import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecordCard } from "@/components/record/RecordCard";

const card = () => screen.getByRole("article");

describe("RecordCard — 03 §6.2 variants", () => {
  it("faith·dev는 자기 액센트를 고정한다 (허브에서 두 장이 나란히 선다)", () => {
    const { rerender } = render(<RecordCard variant="faith" title="믿음의 기록" />);
    expect(card().className).toContain("[--card-accent:var(--accent-faith)]");

    rerender(<RecordCard variant="dev" title="개발의 기록" />);
    expect(card().className).toContain("[--card-accent:var(--accent-dev)]");
  });

  it("허브·오늘의 카드는 지면 액센트를 따른다", () => {
    const { rerender } = render(<RecordCard variant="hub" title="허브" />);
    expect(card().className).toContain("[--card-accent:var(--accent)]");

    rerender(<RecordCard variant="today" title="오늘의 QT" />);
    expect(card().className).toContain("[--card-accent:var(--accent)]");
  });
});

describe("RecordCard — 03 §6.2 states", () => {
  it("기본 상태는 하늘 괘선과 카드 그림자를 갖는다", () => {
    render(<RecordCard title="제목" />);
    expect(card().className).toContain("shadow-card");
    expect(card().className).toContain("repeating-linear-gradient");
  });

  it("empty는 점선 테두리 · 괘선 없음 · 그림자 없음이다", () => {
    render(<RecordCard state="empty" title="이 칸은 아직 비어 있어요" />);
    expect(card().className).toContain("border-dashed");
    expect(card().className).not.toContain("shadow-card");
    expect(card().className).not.toContain("repeating-linear-gradient");
  });

  it("hidden은 렌더하지 않는다 (필터에서 빠진 카드)", () => {
    render(<RecordCard state="hidden" title="숨은 카드" />);
    expect(screen.queryByRole("article")).toBeNull();
  });
});

describe("RecordCard — 조판", () => {
  it("청구기호·날짜·제목·부제·메타를 적는다", () => {
    render(
      <RecordCard
        callNumber="QT-1043"
        aside="08.18"
        title="주님이 네 악을 네 머리로 돌려보내시리라"
        subtitle="열왕기상 2:41-46 — 하나님의 공의"
        meta="큐티 · 질문 여섯에 답하다"
      />,
    );

    expect(screen.getByText("QT-1043")).toBeInTheDocument();
    expect(screen.getByText("08.18")).toBeInTheDocument();
    expect(screen.getByText("열왕기상 2:41-46 — 하나님의 공의")).toBeInTheDocument();
    expect(screen.getByText("큐티 · 질문 여섯에 답하다")).toBeInTheDocument();
  });

  it("청구기호가 없으면 그 줄 자체를 그리지 않는다 (초안)", () => {
    render(<RecordCard title="초안" />);
    expect(card().querySelector(".font-typewriter")).toBeNull();
  });

  it("미세 회전은 CSS 변수로 넘긴다 — hover에서 0으로 풀 수 있어야 한다", () => {
    render(<RecordCard title="제목" rotate={-1} />);
    expect(card().style.getPropertyValue("--card-rotate")).toBe("-1deg");
    expect(card().className).toContain("rotate-(--card-rotate,0deg)");
  });
});

describe("RecordCard — 상호작용", () => {
  it("href가 있으면 카드 전체가 링크이고 집어 드는 hover가 붙는다", () => {
    render(<RecordCard title="제목" href="/faith/qt-1043" />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/faith/qt-1043");
    expect(card().className).toContain("hover:-translate-y-[5px]");
    expect(card().className).toContain("hover:rotate-0");
  });

  it("href가 없으면 링크를 만들지 않는다", () => {
    render(<RecordCard title="제목" />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("빈 카드는 들어올리지 않는다 — 집어 들 것이 없다", () => {
    render(<RecordCard state="empty" title="빈 칸" href="/admin/new" />);
    expect(card().className).not.toContain("hover:-translate-y-[5px]");
  });
});
