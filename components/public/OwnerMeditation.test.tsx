import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HiddenMeditationBlocks,
  MeditationCopyButton,
  OwnerMeditation,
} from "@/components/public/OwnerMeditation";
import type { HiddenMeditationBlock } from "@/lib/praise/meditation";

/**
 * 이 아일랜드가 지키는 것은 하나다 — **읽는 사람에게는 감춘 글자가 가지 않는다.**
 * 서버가 그린 HTML에는 애초에 없고, 여기서도 힌트 쿠키가 없으면 묻지 않는다.
 */
const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const hidden: HiddenMeditationBlock[] = [
  { index: 1, doc: doc("가족을 위한 기도") },
  { index: 2, doc: doc("회사를 위한 기도") },
];

const load = vi.fn();

function renderIsland(publicText = "공개된 묵상") {
  return render(
    <OwnerMeditation postId="post-1" load={load}>
      <MeditationCopyButton publicText={publicText} />
      <HiddenMeditationBlocks />
    </OwnerMeditation>,
  );
}

beforeEach(() => {
  document.cookie = "";
  load.mockReset().mockResolvedValue(hidden);
});

describe("OwnerMeditation — 읽는 사람에게는 아무것도 없다", () => {
  it("힌트 쿠키가 없으면 묻지도 않는다", async () => {
    renderIsland();

    await waitFor(() => expect(screen.getByLabelText("묵상과 기도 복사")).toBeInTheDocument());
    expect(load).not.toHaveBeenCalled();
    expect(screen.queryByText("가족을 위한 기도")).toBeNull();
  });

  it("조회가 실패해도 지면은 조용하다 — 세션이 끊긴 것이고 읽는 사람의 일이 아니다", async () => {
    document.cookie = "admin_ui=1";
    load.mockRejectedValue(new Error("Unauthorized"));

    renderIsland();

    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("가족을 위한 기도")).toBeNull();
  });
});

describe("OwnerMeditation — 본인이 볼 때", () => {
  beforeEach(() => {
    document.cookie = "admin_ui=1";
  });

  it("감춘 덩이가 나오고, 안 나가는 것이라고 적는다", async () => {
    renderIsland();

    await screen.findByText("가족을 위한 기도");
    expect(screen.getByText("회사를 위한 기도")).toBeInTheDocument();
    expect(screen.getByText(/감춘 덩이 2개/)).toBeInTheDocument();
  });

  it("덩이마다 복사가 붙는다 — 자리 번호는 에디터에서 몇째였는지다", async () => {
    renderIsland();

    expect(await screen.findByLabelText("감춘 덩이 2 복사")).toBeInTheDocument();
    expect(screen.getByLabelText("감춘 덩이 3 복사")).toBeInTheDocument();
  });

  it("전체 복사는 감춘 덩이까지 담는다 — 보이는 것을 복사한다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    renderIsland();
    await screen.findByText("가족을 위한 기도");

    screen.getByLabelText("묵상과 기도 복사").click();

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0]?.[0]).toBe(
      "공개된 묵상\n\n가족을 위한 기도\n\n회사를 위한 기도",
    );
  });

  it("옮겨 적을 글자가 하나도 없으면 복사 버튼을 세우지 않는다", async () => {
    load.mockResolvedValue([]);

    render(
      <OwnerMeditation postId="post-1" load={load}>
        <MeditationCopyButton publicText="" />
      </OwnerMeditation>,
    );

    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(screen.queryByLabelText("묵상과 기도 복사")).toBeNull();
  });
});
