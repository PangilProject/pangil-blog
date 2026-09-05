import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});
