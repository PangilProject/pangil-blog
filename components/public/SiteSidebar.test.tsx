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

/**
 * 접기는 자바스크립트 없이 체크박스 하나로 돈다(04 §3.6 — 아일랜드를 늘리지 않는다).
 * jsdom에는 조판이 없어 "접혔는지"는 볼 수 없지만, **손잡이가 그 체크박스를 가리키는지**는
 * 볼 수 있다 — `htmlFor`와 `id`가 어긋나면 눌러도 아무 일이 없고 다른 무엇도 잡지 못한다.
 */
describe("접는 손잡이", () => {
  it("손잡이가 체크박스를 가리킨다", () => {
    render(<SiteSidebar site="dev" />);

    expect(screen.getByRole("checkbox", { name: /사이드바 접고 펴기/ })).not.toBeChecked();
  });

  /**
   * 좁은 화면에서는 이 줄이 유일한 띠라 목차 손잡이도 여기 선다. 목차 칸이 남기는 표식과
   * 이 손잡이가 켜는 이름이 어긋나면, 눌러도 아무 일이 없고 다른 무엇도 잡지 못한다.
   */
  /**
   * **두 손잡이가 한 그룹 안에 있다.** `has-checked`처럼 대상을 안 적으면 그 그룹의 아무
   * 체크박스나 잡혀서, 목차를 눌렀는데 분류가 펼쳐졌다(실제로 그랬다).
   *
   * jsdom에는 조판이 없어 "무엇이 펼쳐지는가"는 볼 수 없지만, **대상을 안 적은 선택자가
   * 남아 있는가**는 볼 수 있다. 이 줄에 손잡이가 더 붙을 때 같은 사고가 되풀이된다.
   */
  it("접힘 선택자가 자기 체크박스만 본다", () => {
    const { container } = render(<SiteSidebar site="dev" />);

    const classes = [...container.querySelectorAll("[class]")]
      .flatMap((element) => element.className.split(/\s+/))
      .filter((name) => /(^|:)(group-)?has-checked/.test(name));

    expect(classes).toEqual([]);
  });

  it("목차 손잡이도 같은 줄에 선다", () => {
    render(<SiteSidebar site="dev" />);

    expect(screen.getByRole("checkbox", { name: /목차 열고 닫기/ })).toHaveAttribute(
      "id",
      "toc-open",
    );
  });
});
