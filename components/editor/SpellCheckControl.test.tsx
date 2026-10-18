import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectedEditorToolbar } from "@/components/editor/ConnectedEditorToolbar";
import { EditorFocusProvider } from "@/components/editor/EditorFocusContext";
import { RichTextField } from "@/components/editor/RichTextField";
import type { SpellCheckResult } from "@/lib/actions/spell";
import type { RichTextValue } from "@/lib/editor/richText";

/**
 * 맞춤법 검사의 화면 흐름 — 누르면 검사하고, 창이 뜨고, 적용·직접 수정·무시가 본문에 닿는지.
 *
 * 검사기는 바꿔 끼운다. 밑줄의 모양·말풍선의 자리·스크롤은 jsdom이 못 본다 — 브라우저로 본다.
 */
const checkSpelling = vi.hoisted(() => vi.fn<(segments: string[]) => Promise<SpellCheckResult>>());
vi.mock("@/lib/actions/spell", () => ({ checkSpelling }));

function doc(...paragraphs: string[]): RichTextValue {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
  } as RichTextValue;
}

function typo(segment: number, text: string, token: string, suggestion: string, type = "spell") {
  const from = text.indexOf(token);
  return { type, token, suggestion, info: "설명", segment, from, to: from + token.length };
}

function renderEditors(...fields: RichTextValue[]) {
  const changes = fields.map(() => vi.fn());
  render(
    <EditorFocusProvider>
      <ConnectedEditorToolbar />
      {fields.map((value, index) => (
        <RichTextField
          // biome-ignore lint/suspicious/noArrayIndexKey: 순서가 바뀌지 않는 고정 목록이다
          key={index}
          value={value}
          onChange={changes[index]}
          ariaLabel={`칸 ${index + 1}`}
        />
      ))}
    </EditorFocusProvider>,
  );
  return changes;
}

async function textOf(name: string) {
  return (await screen.findByRole("textbox", { name })).textContent;
}

async function runCheck() {
  await screen.findByRole("textbox", { name: "칸 1" });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "맞춤법 검사" }));
  });
  return screen.findByRole("dialog", { name: "하나씩 고치기" });
}

beforeEach(() => {
  checkSpelling.mockReset();
});

describe("SpellCheckControl", () => {
  it("화면의 리치 텍스트 칸을 전부, 놓인 순서대로 보낸다", async () => {
    checkSpelling.mockResolvedValue({ ok: true, typos: [] });
    renderEditors(doc("첫째 칸"), doc("둘째 칸", "셋째 문단"));

    await screen.findByRole("textbox", { name: "칸 2" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "맞춤법 검사" }));
    });

    expect(checkSpelling).toHaveBeenCalledWith(["첫째 칸", "둘째 칸", "셋째 문단"]);
    expect(await screen.findByText("고칠 곳이 없어요")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("⌘⇧P로도 검사한다", async () => {
    checkSpelling.mockResolvedValue({ ok: true, typos: [] });
    renderEditors(doc("몇일"));
    await screen.findByRole("textbox", { name: "칸 1" });

    await act(async () => {
      fireEvent.keyDown(document, { key: "P", metaKey: true, shiftKey: true });
    });

    expect(checkSpelling).toHaveBeenCalledOnce();
  });

  it("결과가 있으면 창이 뜨고, 적용하면 본문이 바뀌고 다음으로 간다", async () => {
    const first = "몇일 동안 되서 기쁘다.";
    checkSpelling.mockResolvedValue({
      ok: true,
      typos: [typo(0, first, "몇일", "며칠"), typo(0, first, "되서", "돼서")],
    });
    const [onChange] = renderEditors(doc(first));

    const dialog = await runCheck();
    expect(dialog).toHaveTextContent("1 / 2");
    expect(dialog).toHaveTextContent("며칠");

    fireEvent.click(screen.getByRole("button", { name: /^적용/ }));

    expect(await textOf("칸 1")).toBe("며칠 동안 되서 기쁘다.");
    expect(onChange).toHaveBeenCalled();
    await waitFor(() => expect(dialog).toHaveTextContent("1 / 1"));
    expect(dialog).toHaveTextContent("돼서");
  });

  it("직접 수정한 말로 고친다", async () => {
    const text = "몇일 동안";
    checkSpelling.mockResolvedValue({ ok: true, typos: [typo(0, text, "몇일", "며칠")] });
    renderEditors(doc(text));
    await runCheck();

    fireEvent.click(screen.getByRole("button", { name: "직접 수정" }));
    const input = screen.getByRole("textbox", { name: "고칠 말 직접 입력" });
    expect(input).toHaveValue("며칠");

    fireEvent.change(input, { target: { value: "사흘" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await textOf("칸 1")).toBe("사흘 동안");
  });

  it("한글 조합 중의 Enter로는 적용하지 않는다", async () => {
    const text = "몇일 동안";
    checkSpelling.mockResolvedValue({ ok: true, typos: [typo(0, text, "몇일", "며칠")] });
    renderEditors(doc(text));
    await runCheck();

    fireEvent.click(screen.getByRole("button", { name: "직접 수정" }));
    const input = screen.getByRole("textbox", { name: "고칠 말 직접 입력" });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });

    expect(await textOf("칸 1")).toBe("몇일 동안");
  });

  it("이번엔 무시하면 본문은 그대로이고, 다시 검사해도 긋지 않는다", async () => {
    const text = "몇일 동안";
    checkSpelling.mockResolvedValue({ ok: true, typos: [typo(0, text, "몇일", "며칠")] });
    renderEditors(doc(text));
    await runCheck();

    fireEvent.click(screen.getByRole("button", { name: "이번엔 무시" }));
    expect(await textOf("칸 1")).toBe("몇일 동안");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "맞춤법 검사" }));
    });
    expect(await screen.findByText("고칠 곳이 없어요")).toBeInTheDocument();
  });

  it("남은 것 모두 적용은 여러 칸에 걸쳐 고친다", async () => {
    checkSpelling.mockResolvedValue({
      ok: true,
      typos: [typo(0, "몇일 동안", "몇일", "며칠"), typo(1, "금새 잊는다", "금새", "금세")],
    });
    renderEditors(doc("몇일 동안"), doc("금새 잊는다"));
    await runCheck();

    fireEvent.click(screen.getByRole("button", { name: "남은 것 모두 적용" }));

    expect(await textOf("칸 1")).toBe("며칠 동안");
    expect(await textOf("칸 2")).toBe("금세 잊는다");
    expect(await screen.findByText("다 고쳤어요.")).toBeInTheDocument();
  });

  it("검사기가 실패하면 조용히 알리고 아무것도 긋지 않는다", async () => {
    checkSpelling.mockResolvedValue({ ok: false, reason: "failed" });
    renderEditors(doc("몇일"));
    await screen.findByRole("textbox", { name: "칸 1" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "맞춤법 검사" }));
    });

    expect(await screen.findByText("검사하지 못했어요")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector(".spell-typo")).toBeNull();
  });

  it("창을 닫아도 밑줄은 남는다", async () => {
    const text = "몇일 동안";
    checkSpelling.mockResolvedValue({ ok: true, typos: [typo(0, text, "몇일", "며칠")] });
    renderEditors(doc(text));
    await runCheck();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    expect(screen.queryByRole("dialog", { name: "하나씩 고치기" })).toBeNull();
    expect(document.querySelector(".spell-typo[data-spell-id]")).not.toBeNull();
  });
});
