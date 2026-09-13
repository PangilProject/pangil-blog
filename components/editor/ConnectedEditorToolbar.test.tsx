import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConnectedEditorToolbar } from "@/components/editor/ConnectedEditorToolbar";
import { EditorFocusProvider } from "@/components/editor/EditorFocusContext";
import { RichTextField } from "@/components/editor/RichTextField";

/**
 * 툴바 하나가 여러 편집기를 가리킨다(EditorFocusContext). **가리킨 편집기가 표를 모를 수
 * 있다** — 표 확장은 full 구성에만 붙는다(RichTextField).
 *
 * 그 편집기에 표 명령을 물었다가 프로덕션에서 찬양 글이 통째로 죽었다. 렌더 도중에
 * 던져서 툴바가 아니라 페이지가 error boundary로 넘어갔다. 여기가 그 자리를 막는다.
 */
function renderWithEditor(variant: "full" | "slim") {
  return render(
    <EditorFocusProvider>
      <ConnectedEditorToolbar variant={variant} />
      <RichTextField variant={variant} value={undefined} onChange={() => {}} ariaLabel="본문" />
    </EditorFocusProvider>,
  );
}

async function focusEditor() {
  const field = await screen.findByRole("textbox", { name: "본문" });
  fireEvent.focus(field);
  return field;
}

describe("ConnectedEditorToolbar — 표를 모르는 편집기", () => {
  it("slim 편집기에 커서가 들어가도 툴바가 살아 있다", async () => {
    renderWithEditor("slim");
    await focusEditor();

    // 죽었다면 이 단언까지 오지 못한다 — 렌더에서 던지기 때문이다
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "굵게" })).toBeInTheDocument();
    });
    // slim에는 표 줄 자체가 없다(EditorToolbar)
    expect(screen.queryByRole("button", { name: "⊞ 표" })).toBeNull();
  });

  it("full 편집기에서는 표 줄이 그대로 나온다", async () => {
    renderWithEditor("full");
    await focusEditor();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "⊞ 표" })).toBeInTheDocument();
    });
  });
});
