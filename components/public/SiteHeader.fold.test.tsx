import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/public/SiteHeader";

/**
 * 목차 손잡이는 목차 칸이 아니라 이 줄에 있다 — 칸 안에 두었을 때는 접고 펼 때마다 버튼이
 * 칸을 따라 움직였다.
 *
 * 접기는 자바스크립트 없이 체크박스 하나로 돈다. jsdom에는 조판이 없어 "접혔는지"는 볼 수
 * 없지만 **손잡이가 그 체크박스를 가리키는지**는 볼 수 있고, 거기가 어긋나면 눌러도 아무
 * 일이 없다. 선택자에 적힌 id와 같은 이름이어야 한다(지면 라우트).
 */
describe("SiteHeader — 목차 손잡이", () => {
  it("목차가 있는 지면에만 손잡이를 둔다", () => {
    render(<SiteHeader site="dev" foldsToc />);

    expect(screen.getByRole("checkbox", { name: "목차 접고 펴기" })).toHaveAttribute(
      "id",
      "toc-fold",
    );
  });

  it("목차가 없는 지면에는 두지 않는다 — 눌러도 아무 일이 없는 버튼을 남기지 않는다", () => {
    render(<SiteHeader site="faith" />);

    expect(screen.queryByRole("checkbox", { name: "목차 접고 펴기" })).toBeNull();
  });
});
