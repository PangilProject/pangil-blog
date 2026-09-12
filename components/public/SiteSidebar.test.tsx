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
const { writeHref } = await import("@/components/public/SiteHeader");

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
  /**
   * **띠에서 내려오는 판은 한 번에 하나다.** 체크박스 둘로는 서로의 상태를 몰라 목차와 분류가
   * 같이 열렸다 — 라디오 하나에 `없음`을 더한 세 값으로 두면 브라우저가 하나만 켜 준다.
   *
   * 그 배타성은 전적으로 **같은 name**에 달려 있다. 하나라도 이름이 어긋나면 둘이 같이 열리고,
   * 조판이 없는 테스트로는 그 장면을 볼 수 없다.
   */
  it("판 셋이 한 무리다 — 하나가 켜지면 나머지가 꺼진다", () => {
    const { container } = render(<SiteSidebar site="dev" />);

    const names = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')].map(
      (input) => input.name,
    );

    expect(names).toHaveLength(3);
    expect(new Set(names).size).toBe(1);
  });

  it("기본은 아무 판도 열리지 않은 상태다", () => {
    const { container } = render(<SiteSidebar site="dev" />);

    expect(container.querySelector<HTMLInputElement>("#panel-none")?.defaultChecked).toBe(true);
  });

  /**
   * 라디오는 다시 눌러 끄지 못한다. 그래서 손잡이마다 라벨이 두 장이고, 열려 있을 때 서는
   * 쪽은 `없음`을 가리킨다 — 그 자리가 어긋나면 한 번 연 판을 닫을 길이 없다.
   */
  it("손잡이마다 여는 라벨과 닫는 라벨이 한 장씩이다", () => {
    const { container } = render(<SiteSidebar site="dev" />);

    const targets = [...container.querySelectorAll("label[for]")].map((label) =>
      label.getAttribute("for"),
    );

    expect(targets.filter((target) => target === "panel-axis")).toHaveLength(1);
    expect(targets.filter((target) => target === "panel-toc")).toHaveLength(1);
    expect(targets.filter((target) => target === "panel-none")).toHaveLength(2);
  });
});

/**
 * 좁은 화면에는 본문 위 줄이 없어, `글쓰기`도 이 띠가 내놓는다.
 *
 * 주소는 헤더와 한 곳에서 나온다(`writeHref`). 두 곳에 따로 적으면 한쪽만 고쳐지고, 그때
 * 한 화면의 두 `글쓰기`가 서로 다른 데로 간다.
 */
describe("띠가 내놓는 글쓰기", () => {
  it("헤더와 같은 자리로 간다", () => {
    render(<SiteSidebar site="faith" />);

    expect(screen.getByRole("link", { name: "글쓰기" })).toHaveAttribute(
      "href",
      writeHref("faith"),
    );
  });
});
