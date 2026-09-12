import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useFormStatus = vi.fn();

vi.mock("react-dom", async () => ({
  ...(await vi.importActual<typeof import("react-dom")>("react-dom")),
  useFormStatus: () => useFormStatus(),
}));

const { SignInButton } = await import("@/components/admin/SignInButton");

/**
 * 이 조각이 있는 이유는 하나다 — **눌렀는지 모르겠다.** 로그인은 Supabase 왕복 뒤
 * 리다이렉트까지 가므로 눈에 띄게 걸리는데, 그동안 버튼이 아무 말도 안 했다.
 */
describe("SignInButton", () => {
  it("제출 중이면 그렇다고 말하고 다시 눌리지 않는다", () => {
    useFormStatus.mockReturnValue({ pending: true });

    render(<SignInButton />);

    expect(screen.getByRole("button")).toHaveTextContent("들어가는 중…");
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("평소에는 할 일을 적는다", () => {
    useFormStatus.mockReturnValue({ pending: false });

    render(<SignInButton />);

    expect(screen.getByRole("button", { name: "로그인" })).toBeEnabled();
  });
});
