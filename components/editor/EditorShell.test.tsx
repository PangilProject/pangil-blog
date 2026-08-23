import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CrawlBand } from "@/components/editor/CrawlBand";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { SaveIndicator, toSaveState } from "@/components/editor/SaveIndicator";
import { SectionBlock } from "@/components/editor/SectionBlock";
import { StateStamp } from "@/components/record/StateStamp";

describe("EditorToolbar — ADR-001 고정 툴바", () => {
  it("툴바는 상단에 붙어 있다 — 떠다니는 UI는 금지다", () => {
    const { container } = render(<EditorToolbar />);
    expect(container.firstElementChild?.className).toContain("sticky");
  });

  it("full은 기술·큐티 구성 전체를 낸다", () => {
    render(<EditorToolbar variant="full" />);

    for (const label of ["굵게", "기울임", "밑줄", "목록", "인용", "구분선"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("slim은 설교·찬양용으로 줄인다 — 라이브 속기를 방해하지 않는다", () => {
    render(<EditorToolbar variant="slim" />);

    expect(screen.getByRole("button", { name: "굵게" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "기울임" })).toBeNull();
    expect(screen.queryByRole("button", { name: "구분선" })).toBeNull();
  });

  it("현재 블록 스타일을 표시한다 — 커서를 옮기면 툴바가 따라온다", () => {
    render(<EditorToolbar blockStyle="h2" />);
    expect(screen.getByRole("combobox", { name: "문단 스타일" })).toHaveTextContent("제목 1");
  });

  it("문단 스타일 목록은 브라우저 기본 select이 아니다 — OS 드롭다운은 금지 문법을 강제한다", () => {
    render(<EditorToolbar />);

    // 보이는 트리거가 button이면 목록도 우리가 그린다. select였다면 OS가 라운드 모서리와
    // 파란 하이라이트를 강제한다(03 §1.1). Radix가 폼 호환용으로 두는 숨김 select은 별개다.
    const trigger = screen.getByRole("combobox", { name: "문단 스타일" });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).not.toHaveAttribute("aria-hidden");
  });

  it("활성 서식은 눌린 상태로 표시한다", () => {
    render(<EditorToolbar activeCommands={["bold"]} />);

    expect(screen.getByRole("button", { name: "굵게" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "기울임" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("SaveIndicator — 04 §2.2 상태 표시", () => {
  it("상태마다 점 색이 다르다: 대기 회색 / 저장 중 호박 / 저장됨 녹색", () => {
    const { rerender, container } = render(<SaveIndicator state="idle" />);
    expect(container.querySelector("span span")?.className).toContain("bg-[#cfc8b6]");

    rerender(<SaveIndicator state="saving" />);
    expect(container.querySelector("span span")?.className).toContain("bg-warn");

    rerender(<SaveIndicator state="saved" />);
    expect(container.querySelector("span span")?.className).toContain("bg-ok");
  });

  it("저장됨에는 상대 시각을 붙인다", () => {
    render(<SaveIndicator state="saved" savedAgo="방금" />);
    expect(screen.getByRole("status")).toHaveTextContent("저장됨 · 방금");
  });

  it("설교는 같은 상태를 로컬 우선 어법으로 말한다 — 동기화 실패는 실패가 아니다", () => {
    const { rerender } = render(<SaveIndicator state="offline-pending" variant="sermon" />);
    expect(screen.getByRole("status")).toHaveTextContent("로컬 저장됨 · 동기화 대기");

    rerender(<SaveIndicator state="saved" variant="sermon" />);
    expect(screen.getByRole("status")).toHaveTextContent("로컬 저장됨");
  });

  it("상태 변화를 스크린리더에 알린다", () => {
    render(<SaveIndicator state="saving" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});

describe("CrawlBand — 가져온 것임을 표시", () => {
  it("출처·시각·질문·주석 수를 적고, 고칠 수 있다고 알린다", () => {
    render(<CrawlBand fetchedAt="06:12" questionCount={6} annotationCount={1} />);

    expect(screen.getByText(/날마다 솟는 샘물/)).toBeInTheDocument();
    expect(screen.getByText(/06:12 · 질문 6 · 주석 1/)).toBeInTheDocument();
    expect(screen.getByText(/자유롭게 고칠 수 있어요/)).toBeInTheDocument();
  });

  it("실패 variant는 수동 폴백을 안내한다 — 크롤러가 죽어도 오늘 기록은 남는다", () => {
    render(<CrawlBand variant="failed" />);

    expect(screen.getByText(/가져오지 못했어요/)).toBeInTheDocument();
    expect(screen.getByText(/직접 적어도 오늘 기록은 남습니다/)).toBeInTheDocument();
  });
});

describe("StateStamp — 02 §3.1 카드 상태 4종", () => {
  it("상태별 문구와 색을 찍는다", () => {
    const { rerender } = render(<StateStamp kind="draft-arrived" />);
    expect(screen.getByText("초안 도착").className).toContain("text-(--accent)");

    rerender(<StateStamp kind="fresh-start" />);
    expect(screen.getByText("새로 시작")).toBeInTheDocument();

    rerender(<StateStamp kind="done" />);
    expect(screen.getByText("완료").className).toContain("text-ok");

    rerender(<StateStamp kind="crawl-failed" />);
    expect(screen.getByText("크롤러 실패").className).toContain("text-warn");
  });

  it("기울어진 도장으로 찍힌다", () => {
    render(<StateStamp kind="done" />);
    expect(screen.getByText("완료").className).toContain("rotate-3");
  });
});

describe("SectionBlock — 찬양 섹션", () => {
  it("라벨과 가사를 적는다", () => {
    render(<SectionBlock label="Chorus" lyrics={"주의 노래 가득해\n선포하라"} />);

    expect(screen.getByText("Chorus")).toBeInTheDocument();
    expect(screen.getByText(/주의 노래 가득해/)).toBeInTheDocument();
  });

  it("같은 라벨의 순서를 함께 적는다 — 넘버링은 파생 계산이라 저장하지 않는다", () => {
    render(<SectionBlock label="Verse" ordinal={2} lyrics="가사" />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("빈 섹션을 허용한다 — 연주 메모만 있는 섹션이 실제로 있다", () => {
    render(<SectionBlock label="Interlude" />);
    expect(screen.getByText("가사를 적어보세요")).toBeInTheDocument();
  });

  it("enum 밖의 직접 입력 라벨도 받는다", () => {
    render(<SectionBlock label="Refrain" lyrics="가사" />);
    expect(screen.getByText("Refrain")).toBeInTheDocument();
  });

  it("가사 칸에는 서식이 없다 — 타이핑이 곧 묵상이다", () => {
    render(<SectionBlock label="Verse" lyrics="가사" />);
    expect(screen.getByText("가사").className).toContain("font-serif");
    expect(screen.getByText("가사").tagName).toBe("P");
  });
});

describe("toSaveState — 기계 상태 → 화면 상태", () => {
  it("retrying은 화면에서 동기화 대기다 — 내부 사정이 아니라 사실을 보여준다", () => {
    expect(toSaveState("retrying")).toBe("offline-pending");
  });

  it("나머지 상태는 그대로 쓴다", () => {
    expect(toSaveState("idle")).toBe("idle");
    expect(toSaveState("typing")).toBe("typing");
    expect(toSaveState("saving")).toBe("saving");
    expect(toSaveState("saved")).toBe("saved");
  });
});
