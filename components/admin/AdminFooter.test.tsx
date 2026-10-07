import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminFooter } from "@/components/admin/AdminFooter";

describe("AdminFooter", () => {
  it("세 지면과 개인정보처리방침으로 가는 길만 둔다", () => {
    render(<AdminFooter />);

    expect(screen.getByRole("link", { name: "믿음의 기록" })).toHaveAttribute("href", "/faith");
    expect(screen.getByRole("link", { name: "개발의 기록" })).toHaveAttribute("href", "/dev");
    expect(screen.getByRole("link", { name: "소개" })).toHaveAttribute("href", "/hub");
    expect(screen.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute(
      "href",
      "/hub/privacy",
    );
  });

  /** 구독·외부 링크는 읽는 사람의 것이다 — 관리 화면에서 고친 지면을 보러 가는 길만 남긴다 */
  it("공개 푸터의 구독 링크는 없다", () => {
    render(<AdminFooter />);

    expect(screen.queryByRole("link", { name: "RSS" })).toBeNull();
  });
});
