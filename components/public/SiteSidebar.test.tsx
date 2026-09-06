import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * 사이드바의 DB 칸들은 async 서버 컴포넌트라 jsdom이 await하지 못하고, 불러오는 것만으로
 * Prisma가 env를 요구한다. 이 테스트가 보는 것은 껍데기와 주소 규칙이라 리포지토리를
 * 대역으로 세운다.
 */
vi.mock("@/lib/db/statSummary", () => ({ findViewTotals: async () => null }));
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

  /**
   * 도메인이 붙으면 지면이 호스트로 갈린다 — 그때 `/dev`는 dev 호스트에서 `/dev/dev`로
   * 리라이트돼 404다(proxy.ts). 접두사를 떼는 일은 lib/site/publicUrl 한 곳이 한다
   */
  describe("도메인이 붙은 뒤", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    function withDomains() {
      vi.stubEnv("SITE_HOST_ROOT", "pangil.example");
      vi.stubEnv("SITE_HOST_DEV", "dev.pangil.example");
      vi.stubEnv("SITE_HOST_FAITH", "faith.pangil.example");
    }

    it("분류 링크에서 지면 세그먼트가 사라진다 — 쿼리만 남아도 `/`는 남긴다", () => {
      withDomains();

      expect(axisHref("faith", "QT")).toBe("/?type=QT");
      expect(axisHref("dev", "frontend")).toBe("/?category=frontend");
    });

    it("브랜드는 그 호스트의 뿌리를 가리킨다", () => {
      withDomains();
      render(<SiteSidebar site="faith" />);

      expect(screen.getByRole("link", { name: "믿음의 기록" })).toHaveAttribute("href", "/");
    });
  });
});
