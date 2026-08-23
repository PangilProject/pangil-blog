import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditorToolbar } from "@/components/editor/EditorToolbar";

/**
 * 코드 블록 안에서만 언어를 고른다(02 §5.5). 코드 블록이 아닌 자리에서 언어 목록이 떠 있으면
 * 무엇에 적용되는지 알 수 없으므로, "언제 없는가"까지 고정한다.
 */
describe("툴바 코드 언어 선택", () => {
  it("코드 블록이 아니면 언어 선택이 없다", () => {
    render(<EditorToolbar codeLanguage={null} />);
    expect(screen.queryByLabelText("코드 언어")).toBeNull();
  });

  it("코드 블록이면 언어 선택이 선다 — 언어가 없어도 고를 수 있어야 한다", () => {
    render(<EditorToolbar codeLanguage="" />);
    expect(screen.getByLabelText("코드 언어")).toBeInTheDocument();
  });

  it("고른 언어를 그대로 알려준다", async () => {
    const onCodeLanguageChange = vi.fn();
    render(<EditorToolbar codeLanguage="" onCodeLanguageChange={onCodeLanguageChange} />);

    fireEvent.keyDown(screen.getByLabelText("코드 언어"), { key: "Enter" });
    screen.getByText("bash").click();

    expect(onCodeLanguageChange).toHaveBeenCalledWith("bash");
  });

  it("이미 지정된 언어가 표시된다", () => {
    render(<EditorToolbar codeLanguage="ts" />);
    expect(screen.getByLabelText("코드 언어")).toHaveTextContent("TypeScript");
  });
});
