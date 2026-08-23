import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditorFocusProvider } from "@/components/editor/EditorFocusContext";
import { RichTextField } from "@/components/editor/RichTextField";
import type { RichTextValue } from "@/lib/editor/richText";

/**
 * 붙여넣기가 실제 Tiptap 인스턴스에서 서식으로 바뀌는지 본다 (02 §5.5).
 * 파서 단위 테스트(lib/editor/markdown.test.ts)와 별개로, 배선이 끊기면 이 기능은 없는 것과
 * 같으므로 화면까지 확인한다.
 */
function renderField(props: { variant?: "full" | "slim" } = {}) {
  const onChange = vi.fn();

  render(
    <EditorFocusProvider>
      <RichTextField
        ariaLabel="본문"
        value={{ type: "doc", content: [] } as RichTextValue}
        onChange={onChange}
        {...props}
      />
    </EditorFocusProvider>,
  );

  return { onChange, body: screen.getByLabelText("본문") };
}

/**
 * 클립보드는 물어본 형식만 답해야 한다. 아무 형식에나 같은 글자를 돌려주면 Tiptap의 코드 블록
 * 확장이 `vscode-editor-data`를 JSON으로 파싱하다 터진다 — 실제로 CI를 빨갛게 만들었다.
 */
function paste(target: HTMLElement, { text, html = "" }: { text: string; html?: string }) {
  const data: Record<string, string> = { "text/plain": text, "text/html": html };

  fireEvent.paste(target, {
    clipboardData: {
      getData: (type: string) => data[type] ?? "",
      types: Object.keys(data).filter((type) => data[type] !== ""),
    },
  });
}

describe("마크다운 붙여넣기 (02 §5.5)", () => {
  it("붙여넣는 순간 그 자리에 서식이 된다 — 미리보기도 변환 버튼도 없다", async () => {
    const { body } = renderField();

    await act(async () => {
      paste(body, { text: "## 캐시 정리\n\n- 하나\n- 둘\n\n```ts\nconst a = 1;\n```" });
    });

    expect(body.querySelector("h3")?.textContent).toBe("캐시 정리");
    expect(body.querySelectorAll("ul li")).toHaveLength(2);
    expect(body.querySelector("pre code")?.textContent).toBe("const a = 1;");
  });

  it("클립보드에 HTML이 있으면 기본 경로에 맡긴다 — 이미 서식이 있는 복사다", async () => {
    const { body } = renderField();

    await act(async () => {
      paste(body, { text: "## 제목", html: "<p>이미 서식이 있는 복사</p>" });
    });

    expect(body.querySelector("h3")).toBeNull();
  });

  /**
   * 이 두 경우는 "우리가 개입하지 않았다"까지만 확인한다. 그 다음 붙여넣기는 ProseMirror의
   * 기본 경로이고, jsdom에는 실제 클립보드 파싱이 없어 여기서 글자가 들어가지는 않는다.
   */
  it("마크다운 신호가 없으면 손대지 않는다", async () => {
    const { body } = renderField();

    await act(async () => {
      paste(body, { text: "그냥 문장 2*3=6" });
    });

    expect(body.querySelector("em")).toBeNull();
    expect(body.querySelector("h3")).toBeNull();
  });

  it("slim 구성(설교·찬양)에는 붙지 않는다", async () => {
    const { body } = renderField({ variant: "slim" });

    await act(async () => {
      paste(body, { text: "## 제목" });
    });

    expect(body.querySelector("h3")).toBeNull();
  });
});
