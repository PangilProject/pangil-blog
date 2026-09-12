import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { TableToolbarRow } from "@/components/editor/TableToolbarRow";

/**
 * 표를 넣을 수는 있는데 **행·열을 지우는 길이 없었다.** Tab은 다음 칸으로 가지만
 * 그게 전부였다. 이 줄이 그 자리를 화면에 만든다.
 *
 * 떠다니는 팝업이 아니다 — 툴바 아래에 인라인으로 펼쳐진다(ADR-001 §5).
 */
describe("TableToolbarRow — 표 밖에서는 크기를 고른다", () => {
  it("처음에는 접혀 있다 — 쓰는 동안 격자가 눈에 걸리지 않는다", () => {
    render(<TableToolbarRow />);

    expect(screen.getByRole("button", { name: "⊞ 표" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "표 크기" })).toBeNull();
  });

  it("누르면 격자가 펴지고, 칸을 고르면 그 크기로 넣는다", () => {
    const onInsertTable = vi.fn();
    render(<TableToolbarRow onInsertTable={onInsertTable} />);

    fireEvent.click(screen.getByRole("button", { name: "⊞ 표" }));
    fireEvent.click(screen.getByRole("button", { name: "2행 3열 표 넣기" }));

    expect(onInsertTable).toHaveBeenCalledWith(2, 3);
    // 고르고 나면 다시 접힌다 — 한 번 하는 일이다
    expect(screen.queryByRole("group", { name: "표 크기" })).toBeNull();
  });

  it("마우스를 올린 자리까지 크기를 말한다 — 끌지 않아도 여기까지가 보인다", () => {
    render(<TableToolbarRow />);

    fireEvent.click(screen.getByRole("button", { name: "⊞ 표" }));
    expect(screen.getByText("크기를 고르세요")).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "3행 4열 표 넣기" }));
    expect(screen.getByText("3 × 4")).toBeInTheDocument();
  });

  it("키보드로 옮겨도 같은 자리가 물든다 — 마우스만의 기능이 아니다", () => {
    render(<TableToolbarRow />);

    fireEvent.click(screen.getByRole("button", { name: "⊞ 표" }));
    fireEvent.focus(screen.getByRole("button", { name: "1행 2열 표 넣기" }));

    expect(screen.getByText("1 × 2")).toBeInTheDocument();
  });
});

describe("TableToolbarRow — 표 안에서는 표 자체만 만진다", () => {
  /**
   * 행·열은 표 위의 손잡이가 맡는다(TableNodeView). 툴바에 두면 "커서가 어쩌다 놓인 행"이
   * 지워지고, 어느 행인지 버튼만 봐서는 알 수 없다. 표 삭제는 그 모호함이 없다.
   */
  it("표 전체나 고른 칸에 하는 일만 남는다", () => {
    render(<TableToolbarRow inTable />);

    for (const label of ["머리 줄", "칸 병합", "칸 나누기", "표 삭제"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    for (const gone of ["행 추가", "행 삭제", "열 추가", "열 삭제"]) {
      expect(screen.queryByRole("button", { name: gone })).toBeNull();
    }
    // 표 안에서는 크기 격자를 내지 않는다 — 이미 표가 있다
    expect(screen.queryByRole("button", { name: "⊞ 표" })).toBeNull();
  });

  it("누른 것을 그대로 넘긴다", () => {
    const onTableCommand = vi.fn();
    render(<TableToolbarRow inTable onTableCommand={onTableCommand} />);

    fireEvent.click(screen.getByRole("button", { name: "표 삭제" }));

    expect(onTableCommand).toHaveBeenCalledWith("deleteTable");
  });

  /**
   * 누르고 아무 일도 안 일어나면 고장으로 읽힌다(02 §3.4). 병합은 칸을 여럿 골라야 하고
   * 나누기는 이미 합쳐진 칸에서만 되는데, 그 조건이 화면에 없었다.
   */
  it("지금 못 하는 일은 눌리지 않고, 왜인지 말한다", () => {
    render(<TableToolbarRow inTable can={{ mergeCells: false, splitCell: false }} />);

    const merge = screen.getByRole("button", { name: "칸 병합" });
    expect(merge).toBeDisabled();
    expect(merge).toHaveAttribute("title", "칸을 두 개 이상 끌어서 골라 주세요");
    expect(screen.getByRole("button", { name: "칸 나누기" })).toBeDisabled();
  });

  it("할 수 있으면 열려 있고 까닭을 적지 않는다", () => {
    render(<TableToolbarRow inTable can={{ mergeCells: true }} />);

    const merge = screen.getByRole("button", { name: "칸 병합" });
    expect(merge).toBeEnabled();
    expect(merge).not.toHaveAttribute("title");
  });
});

describe("툴바에 붙는 자리", () => {
  it("slim에는 표 줄이 없다 — 설교 속기와 가사 타이핑을 방해하지 않는다", () => {
    render(<EditorToolbar variant="slim" />);

    expect(screen.queryByRole("button", { name: "⊞ 표" })).toBeNull();
  });

  it("full에는 있다", () => {
    render(<EditorToolbar variant="full" />);

    expect(screen.getByRole("button", { name: "⊞ 표" })).toBeInTheDocument();
  });
});
