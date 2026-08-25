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

    expect(screen.getByText("이어서 작성 →")).toBeInTheDocument();
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
});
