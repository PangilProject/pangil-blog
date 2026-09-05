import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * 사이드바의 DB 칸들은 async 서버 컴포넌트라 jsdom이 await하지 못하고, 불러오는 것만으로
 * Prisma가 env를 요구한다. 이 테스트가 보는 것은 껍데기와 주소 규칙이라 리포지토리를
 * 대역으로 세운다.
 */
vi.mock("@/lib/db/statSummary", () => ({ findVisitorTotals: async () => null }));
vi.mock("@/lib/db/publicLists", () => ({
  findAxisCounts: async () => [],
  findFeedItems: async () => [],
  countPublishedPosts: async () => ({ thisMonth: 0, total: 0 }),
}));

const { axisHref, SiteSidebar } = await import("@/components/public/SiteSidebar");

describe("SiteSidebar", () => {
  it("지면마다 필터 파라미터가 갈린다 — faith는 타입, dev는 카테고리다", () => {
    expect(axisHref("faith", "QT")).toBe("/faith?type=QT");
    expect(axisHref("dev", "frontend")).toBe("/dev?category=frontend");
  });

  it("브랜드를 누르면 그 지면의 목록으로 간다", () => {
    render(<SiteSidebar site="faith" />);

    expect(screen.getByRole("link", { name: "믿음의 기록" })).toHaveAttribute("href", "/faith");
  });
});
