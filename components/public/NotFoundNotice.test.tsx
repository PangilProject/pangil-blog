import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotFoundNotice } from "@/components/public/NotFoundNotice";

describe("NotFoundNotice", () => {
  /** 지금 서 있는 지면의 목록이 찾던 글에 가장 가깝다 — 그게 먼저 와야 한다 */
  it("서 있는 지면을 먼저 놓는다", () => {
    render(<NotFoundNotice site="dev" />);

    const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(links).toEqual(["/dev", "/faith"]);
  });

  it("지면 밖에서는 두 블로그를 나란히 놓는다", () => {
    render(<NotFoundNotice />);

    const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(links).toEqual(["/faith", "/dev"]);
  });

  /** 주소를 통째로 개편했으므로(05 §6.4) 여기 오는 가장 흔한 이유다. 감추지 않는다 */
  it("주소가 바뀌었을 수 있다고 말한다", () => {
    render(<NotFoundNotice site="faith" />);

    expect(screen.getByText(/주소가 바뀌었을 수 있어요/)).toBeInTheDocument();
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

    it("서 있는 지면은 상대 경로, 건너가는 지면은 절대 URL이다", () => {
      withDomains();
      render(<NotFoundNotice site="dev" />);

      const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
      expect(links).toEqual(["/", "https://faith.pangil.example/"]);
    });

    it("지면 밖에서는 둘 다 남의 호스트다", () => {
      withDomains();
      render(<NotFoundNotice />);

      const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
      expect(links).toEqual(["https://faith.pangil.example/", "https://dev.pangil.example/"]);
    });
  });
});
