import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EditorFocusProvider } from "@/components/editor/EditorFocusContext";
import { RichTextField } from "@/components/editor/RichTextField";

/**
 * **표 안에 `<div>`가 들어가면 안 된다.**
 *
 * Tiptap은 `NodeViewContent`로 표시한 요소 **안에** 제 content 요소를 하나 더 만든다.
 * 그것이 `<div>`면 `<tbody><div><tr>`이 되고, 브라우저는 표 안의 `<div>`를 표 **밖으로**
 * 밀어낸다 — 조판이 깨지고 `table.rows`가 비어 손잡이도 못 그린다. 실제로 그렇게 만들었다가
 * 고쳤고, 화면을 봐야만 드러나는 자리라 여기서 고정한다.
 */
const tableDoc = {
  type: "doc" as const,
  content: [
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", content: [{ type: "paragraph" }] },
            { type: "tableHeader", content: [{ type: "paragraph" }] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [{ type: "paragraph" }] },
            { type: "tableCell", content: [{ type: "paragraph" }] },
          ],
        },
      ],
    },
  ],
};

/** Tiptap은 제 effect에서 붙는다(`immediatelyRender: false`) — 표가 설 때까지 기다린다 */
async function renderEditor() {
  const result = render(
    <EditorFocusProvider>
      <RichTextField ariaLabel="본문" variant="full" value={tableDoc} onChange={() => {}} />
    </EditorFocusProvider>,
  );

  await waitFor(() => expect(result.container.querySelector("table")).not.toBeNull());
  return result;
}

describe("TableNodeView", () => {
  it("표 안에는 줄만 있다 — div가 끼면 브라우저가 표를 헤집는다", async () => {
    const { container } = await renderEditor();

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(table?.querySelector("div")).toBeNull();
    // 줄을 브라우저가 표의 줄로 읽는다. 이 값이 0이면 손잡이도 못 그린다
    expect(table?.rows).toHaveLength(2);
  });

  it("행과 열마다 손잡이가 선다", async () => {
    await renderEditor();

    expect(screen.getByLabelText("1번째 행 다루기")).toBeInTheDocument();
    expect(screen.getByLabelText("2번째 행 다루기")).toBeInTheDocument();
    expect(screen.getByLabelText("1번째 열 다루기")).toBeInTheDocument();
    expect(screen.getByLabelText("2번째 열 다루기")).toBeInTheDocument();
  });

  it("끝에 하나 더 붙이는 자리가 있다 — 메뉴를 열지 않고도 늘린다", async () => {
    await renderEditor();

    expect(screen.getByLabelText("행 추가")).toBeInTheDocument();
    expect(screen.getByLabelText("열 추가")).toBeInTheDocument();
  });

  it("손잡이를 누르면 그 행에 할 일을 낸다", async () => {
    await renderEditor();

    screen.getByLabelText("2번째 행 다루기").click();

    expect(await screen.findByRole("button", { name: "위에 삽입" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "아래에 삽입" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });

  it("노션이 주는 것들이 메뉴에 다 있다", async () => {
    await renderEditor();

    screen.getByLabelText("2번째 행 다루기").click();

    for (const label of ["복제", "콘텐츠 삭제", "삭제"]) {
      expect(await screen.findByRole("button", { name: label })).toBeInTheDocument();
    }
    // 색은 이름 대신 견본이다 — 세 칸뿐이라 고르는 데 한 번이면 된다
    for (const color of ["없음", "강조", "회색"]) {
      expect(screen.getByRole("button", { name: color })).toBeInTheDocument();
    }
  });

  it("색을 고르면 그 줄 전체에 칠해진다", async () => {
    const { container } = await renderEditor();

    screen.getByLabelText("2번째 행 다루기").click();
    (await screen.findByRole("button", { name: "강조" })).click();

    await waitFor(() => {
      const cells = container.querySelectorAll("tbody tr:nth-child(2) td");
      expect(cells.length).toBeGreaterThan(0);
      for (const cell of cells) expect(cell.className).toContain("cell-accent");
    });
  });

  it("열 손잡이는 좌우로 말한다 — 위아래가 아니다", async () => {
    await renderEditor();

    screen.getByLabelText("1번째 열 다루기").click();

    expect(await screen.findByRole("button", { name: "왼쪽에 삽입" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "오른쪽에 삽입" })).toBeInTheDocument();
  });
});
