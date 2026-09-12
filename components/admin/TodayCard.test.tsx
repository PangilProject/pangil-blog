import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TodayCard } from "@/components/admin/TodayCard";

/**
 * 카드는 1탭 진입점이다(02 §3.1). 상태마다 **어디로 가는지**가 흐트러지면 대시보드의
 * 존재 이유가 사라지므로, 문구가 아니라 도착지를 함께 고정한다.
 */
const post = { id: "post-1", title: "주님이 네 악을" };

describe("TodayCard — 상태별 문구와 도착지", () => {
  it("초안 도착: 크롤러가 채운 초안으로 들어간다", () => {
    render(<TodayCard type="QT" state="draft-ready" post={post} />);

    expect(screen.getByText("이어서 쓰기 →")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/admin/write/qt/post-1");
    expect(screen.getByText(/초안 도착/)).toBeInTheDocument();
  });

  it("작성 중: 같은 초안으로 이어진다", () => {
    render(<TodayCard type="PRAISE" state="writing" post={post} savedAgo="5분 전" />);

    expect(screen.getByText("이어서 쓰기 →")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/admin/write/praise/post-1");
    expect(screen.getByText("5분 전")).toBeInTheDocument();
  });

  it("완료: 고치러 갈 수 있다 — 발행 후에도 수정 저장이 곧 반영이다", () => {
    render(<TodayCard type="SERMON" state="published" post={post} />);

    expect(screen.getByText("고치러 가기 →")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/admin/write/sermon/post-1");
  });

  it("빈 카드: 새 글 경로로 간다", () => {
    render(<TodayCard type="QT" state="empty" post={null} />);

    expect(screen.getByText("쓰러 가기 →")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/admin/write/qt");
    expect(screen.getByText("아직 빈 카드예요")).toBeInTheDocument();
  });

  it("크롤 실패: 빈 템플릿으로 시작한다 (프리모템 #1)", () => {
    render(<TodayCard type="QT" state="crawl-failed" post={null} />);

    expect(screen.getByText("빈 템플릿으로 시작 →")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/admin/write/qt");
    expect(screen.getByText(/직접 적어도 오늘 기록은 남아요/)).toBeInTheDocument();
  });

  it("제목이 없는 초안도 카드가 비어 보이지 않는다", () => {
    render(<TodayCard type="QT" state="writing" post={{ id: "p", title: "   " }} />);

    expect(screen.getByText("아직 빈 카드예요")).toBeInTheDocument();
  });

  /**
   * `done` 도장은 M1부터 있었는데 디자인 지면에만 있고 실제 화면에서는 한 번도 안 쓰였다.
   * 다 찍지는 않는다 — 대비가 사라지면 `완료`가 성취로 안 읽힌다.
   */
  it("오늘 몫을 남긴 카드에는 완료 도장을 찍는다", () => {
    render(<TodayCard type="QT" state="published" post={{ id: "p", title: "오늘의 큐티" }} />);

    expect(screen.getByText("완료")).toBeInTheDocument();
  });

  it("크롤러가 실패한 카드도 찍는다 — 조용히 넘기지 않는다", () => {
    render(<TodayCard type="QT" state="crawl-failed" post={null} />);

    expect(screen.getByText("가져오지 못함")).toBeInTheDocument();
  });

  /**
   * **도장이 말한 것을 배지가 또 말하지 않는다.** `완료` 카드에 `완료`가 두 번, 실패 카드에
   * `가져오지 못함`이 두 번 찍혀 있었다 — 한 화면에 같은 말이 두 벌이면 둘 다 덜 읽힌다.
   *
   * `getByText`는 두 벌이면 던지므로 이 자리를 지킨다. 도장을 다시 배지로 옮기거나 배지를
   * 되살리면 여기서 걸린다.
   */
  it("도장이 찍힌 카드에서는 그 말이 한 번만 나온다", () => {
    const { unmount } = render(
      <TodayCard type="QT" state="published" post={{ id: "p", title: "오늘의 큐티" }} />,
    );
    expect(screen.getAllByText("완료")).toHaveLength(1);
    unmount();

    render(<TodayCard type="QT" state="crawl-failed" post={null} />);
    expect(screen.getAllByText("가져오지 못함")).toHaveLength(1);
  });

  it("쓰는 중인 카드에는 찍지 않는다 — 다 찍으면 표시가 아니라 장식이다", () => {
    render(<TodayCard type="QT" state="writing" post={{ id: "p", title: "쓰는 중" }} />);

    expect(screen.queryByText("완료")).toBeNull();
  });
});
