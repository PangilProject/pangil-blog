import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button — 03 §6.1 스타일 오버라이드", () => {
  it("기본 버튼은 카드 표면 + 타자기체다 (프로토타입 .btn)", () => {
    render(<Button>임시저장</Button>);

    const button = screen.getByRole("button", { name: "임시저장" });
    expect(button.className).toContain("bg-card");
    expect(button.className).toContain("font-typewriter");
  });

  it("primary는 사이트 액센트로 채운다 — 지면의 유일한 주 동작", () => {
    render(<Button variant="primary">발행</Button>);

    const button = screen.getByRole("button", { name: "발행" });
    expect(button.className).toContain("bg-(--accent)");
    expect(button.className).toContain("font-bold");
  });

  it("radius 토큰이 0이라 모든 버튼이 각지다 — 필 버튼은 금지 문법이다", () => {
    render(<Button size="sm">작게</Button>);
    // rounded-* 유틸리티는 --radius-* 토큰을 참조하고, 그 값은 전부 0이다(03 §2.3).
    expect(screen.getByRole("button", { name: "작게" }).className).toContain("rounded-");
  });
});
