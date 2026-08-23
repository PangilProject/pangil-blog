import { render, screen } from "@testing-library/react";
import type { ReactNodeViewProps } from "@tiptap/react";
import { describe, expect, it, vi } from "vitest";

import { CodeBlockNodeView } from "@/components/editor/CodeBlockNodeView";

/**
 * 언어 선택이 블록 안에 있다(02 §5.5). 커서로 "지금 어느 블록인지"를 추론하지 않아도 되는 것이
 * 이 배치의 이유이므로, 여기서는 그 컨트롤이 블록과 함께 선다는 것과 이미 지정된 언어가
 * 표시된다는 것을 고정한다.
 */
function renderNodeView(language: unknown) {
  const updateAttributes = vi.fn();

  // NodeView는 Tiptap이 넘기는 값 중 node·updateAttributes만 쓴다
  const props = {
    node: { attrs: { language } },
    updateAttributes,
  } as unknown as ReactNodeViewProps;

  render(<CodeBlockNodeView {...props} />);

  return { updateAttributes };
}

describe("CodeBlockNodeView", () => {
  it("언어 선택이 블록 안에 선다", () => {
    renderNodeView(null);
    expect(screen.getByLabelText("코드 언어")).toBeInTheDocument();
  });

  it("언어가 없으면 고르라고 안내한다", () => {
    renderNodeView(null);
    expect(screen.getByLabelText("코드 언어")).toHaveTextContent("언어 선택");
  });

  it("이미 지정된 언어를 표시한다", () => {
    renderNodeView("ts");
    expect(screen.getByLabelText("코드 언어")).toHaveTextContent("TypeScript");
  });
});
