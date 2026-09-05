import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { copyrightLine, SiteFooter } from "@/components/public/SiteFooter";

describe("SiteFooter", () => {
  /**
   * 연도는 요청 시점에 읽는 async 조각이라 jsdom이 await하지 못한다 — 조립만 순수 함수로
   * 떼어 본다. 이 줄이 지켜야 하는 것은 "해마다 사람이 고치지 않아도 된다"이다.
   */
  it("연도는 시계에서 온다 — 해마다 사람이 고쳐야 하는 숫자를 박아두지 않는다", () => {
    expect(copyrightLine(2031, "김광일")).toBe("© 2031 김광일");
  });

  it("이름이 없으면 연도만 남는다 — 자리표시자를 그리지 않는다", () => {
    expect(copyrightLine(2026, null)).toBe("© 2026");
  });

  it("다른 지면으로 건너갈 길을 둔다", () => {
    render(<SiteFooter site="faith" />);

    expect(screen.getByRole("link", { name: "개발의 기록" })).toHaveAttribute("href", "/dev");
  });

  it("구독은 헤더가 아니라 여기 있다", () => {
    render(<SiteFooter site="dev" />);

    expect(screen.getByRole("link", { name: "RSS" })).toHaveAttribute("href", "/rss.xml");
  });

  /**
   * `/hub`는 라우트의 이름이다. 화면에서는 그 지면에 실제로 있는 것 — 소개라고 부른다
   * (03 §7.2). 이 말이 코드 여러 곳에서 갈리면 같은 지면이 두 이름을 갖는다.
   */
  it("소개 지면을 허브라고 부르지 않는다", () => {
    render(<SiteFooter site="faith" />);

    expect(screen.getByRole("link", { name: "소개" })).toHaveAttribute("href", "/hub");
    expect(screen.queryByRole("link", { name: "허브" })).toBeNull();
  });

  /** 지금 서 있는 지면으로 가는 링크는 누를 이유가 없는 자리만 차지한다 */
  it("소개 지면에서는 두 블로그로 가는 길만 남는다", () => {
    render(<SiteFooter site="hub" />);

    expect(screen.getByRole("link", { name: "믿음의 기록" })).toHaveAttribute("href", "/faith");
    expect(screen.getByRole("link", { name: "개발의 기록" })).toHaveAttribute("href", "/dev");
    expect(screen.queryByRole("link", { name: "소개" })).toBeNull();
  });

  /** 방문자 수는 사이드바로 갔다 — 매일 보는 숫자가 지면 맨 끝에 있을 이유가 없다 */
  it("방문자 수는 푸터에 없다", () => {
    const { container } = render(<SiteFooter site="dev" />);

    expect(container.textContent).not.toContain("오늘");
  });

  /**
   * 도메인이 붙으면 지면이 호스트로 갈린다 — 그때 `/faith`는 루트 호스트에서 `/hub/faith`로
   * 리라이트돼 404다(proxy.ts). 실제로 도메인을 붙이자 공개 지면의 링크가 전부 그렇게 깨졌다.
   * 지면을 건너가는 길은 여기가 주된 자리이므로 여기서 고정한다.
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

    it("다른 지면은 그 호스트의 절대 URL로 간다", () => {
      withDomains();
      render(<SiteFooter site="faith" />);

      expect(screen.getByRole("link", { name: "개발의 기록" })).toHaveAttribute(
        "href",
        "https://dev.pangil.example/",
      );
      expect(screen.getByRole("link", { name: "소개" })).toHaveAttribute(
        "href",
        "https://pangil.example/",
      );
    });

    it("방침은 루트 호스트의 `/privacy`다 — `/hub` 세그먼트가 주소에 남지 않는다", () => {
      withDomains();
      render(<SiteFooter site="dev" />);

      expect(screen.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute(
        "href",
        "https://pangil.example/privacy",
      );
    });

    it("허브에서 자기 방침으로 갈 때는 상대 경로다 — 같은 호스트다", () => {
      withDomains();
      render(<SiteFooter site="hub" />);

      expect(screen.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute(
        "href",
        "/privacy",
      );
    });
  });
});
