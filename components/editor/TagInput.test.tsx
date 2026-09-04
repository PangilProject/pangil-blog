import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { TagInput } from "@/components/editor/TagInput";

/**
 * 한글 입력기 문제를 고정한다. 조합 중인 Enter를 가로채면 한 번의 Enter가 두 가지 일을 해서
 * "안녕하세요"가 "안녕하세"와 "요"로 갈린다 — 실제로 그랬다.
 */
function Harness() {
  const [tags, setTags] = useState<string[]>([]);
  return <TagInput value={tags} onChange={setTags} />;
}

function type(value: string) {
  fireEvent.change(screen.getByLabelText("태그"), { target: { value } });
}

function pressEnter({ composing = false }: { composing?: boolean } = {}) {
  fireEvent.keyDown(screen.getByLabelText("태그"), { key: "Enter", isComposing: composing });
}

describe("TagInput — 한글 조합 (IME)", () => {
  it("조합 중인 Enter는 태그를 만들지 않는다 — 입력기의 확정이다", async () => {
    render(<Harness />);

    await act(async () => {
      type("안녕하세요");
      pressEnter({ composing: true });
    });

    expect(screen.queryByRole("button", { name: /태그 .* 삭제/ })).toBeNull();
    expect(screen.getByLabelText("태그")).toHaveValue("안녕하세요");
  });

  it("조합이 끝난 뒤의 Enter가 태그를 만든다", async () => {
    render(<Harness />);

    await act(async () => {
      type("안녕하세요");
      pressEnter({ composing: true });
      pressEnter();
    });

    expect(screen.getByRole("button", { name: "태그 안녕하세요 삭제" })).toBeInTheDocument();
    expect(screen.getByLabelText("태그")).toHaveValue("");
  });

  it("조합 중인 Backspace도 가로채지 않는다", async () => {
    render(<Harness />);

    await act(async () => {
      type("Prisma");
      pressEnter();
      type("한");
      fireEvent.keyDown(screen.getByLabelText("태그"), { key: "Backspace", isComposing: true });
    });

    expect(screen.getByRole("button", { name: "태그 Prisma 삭제" })).toBeInTheDocument();
  });
});
