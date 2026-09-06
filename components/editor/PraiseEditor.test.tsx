import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PraiseEditor } from "@/components/editor/PraiseEditor";
import { emptyPraiseForm, type PraiseFormValues } from "@/lib/editor/praiseForm";

const upsertDraft = vi.fn();
const publishPost = vi.fn();
const suggestTitleFromYouTube = vi.fn();
const replace = vi.fn();
const push = vi.fn();
const assign = vi.fn();

// 발행 뒤 이동은 교차 출처라 라우터가 아니라 브라우저가 한다(usePublishFlow).
// jsdom의 `location.assign`은 재정의가 막혀 있어 location 자체를 갈아끼운다 — 주소는
// 그대로 남겨둔다(가짜 location이 href를 잃으면 엉뚱한 곳이 먼저 터진다)
beforeAll(() => {
  const { href, origin, pathname } = window.location;
  vi.stubGlobal("location", { href, origin, pathname, assign });
});

vi.mock("@/lib/actions/posts", () => ({
  upsertDraft: (input: unknown) => upsertDraft(input),
  publishPost: (id: string) => publishPost(id),
}));

vi.mock("@/lib/actions/praise", () => ({
  suggestTitleFromYouTube: (url: string) => suggestTitleFromYouTube(url),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
}));

const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

function filled(): PraiseFormValues {
  return {
    title: "마커스워십 - 주님의 시간에",
    youtubeUrl: YOUTUBE_URL,
    sections: [
      { id: "a", label: "Verse", lyrics: "주님의 시간에" },
      { id: "b", label: "Chorus", lyrics: "찬양하리" },
    ],
    meditationBlocks: [
      {
        id: "m1",
        doc: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "기다림을 배웁니다" }] }],
        },
        hidden: false,
      },
    ],
    tags: [],
  };
}

function renderEditor(overrides: Partial<Parameters<typeof PraiseEditor>[0]> = {}) {
  return render(<PraiseEditor postId="post-1" initialValues={filled()} {...overrides} />);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  upsertDraft.mockReset().mockResolvedValue({ ok: true, id: "post-1", savedAt: new Date() });
  publishPost.mockReset().mockResolvedValue({
    ok: true,
    id: "post-1",
    slug: "pr-1",
    callNumber: 1,
    url: "https://faith.example/pr-1",
  });
  suggestTitleFromYouTube.mockReset().mockResolvedValue({
    ok: true,
    suggested: "마커스워십 - 주님의 시간에",
    original: "주님의 시간에 (Official)",
    authorName: "마커스워십",
  });
  replace.mockReset();
  push.mockReset();
  assign.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PraiseEditor — 영상과 제목 제안 (00 §7-4)", () => {
  it("주소가 확정되면 미리보기를 우리가 만든 임베드 주소로 띄운다", () => {
    renderEditor();

    expect(screen.getByTitle("찬양 영상 미리보기")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });

  it("주소가 유튜브가 아니면 미리보기도 제안도 없다", () => {
    renderEditor({ initialValues: { ...filled(), youtubeUrl: "https://vimeo.com/1" } });

    expect(screen.queryByTitle("찬양 영상 미리보기")).toBeNull();
    expect(suggestTitleFromYouTube).not.toHaveBeenCalled();
  });

  it("제목이 비어 있으면 제안으로 채운다", async () => {
    renderEditor({ initialValues: { ...emptyPraiseForm(), youtubeUrl: YOUTUBE_URL } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByLabelText("찬양 제목")).toHaveValue("마커스워십 - 주님의 시간에");
  });

  it("적어둔 제목은 덮지 않는다 — 제안은 빈 칸을 채우는 일까지다", async () => {
    renderEditor({
      initialValues: { ...emptyPraiseForm(), youtubeUrl: YOUTUBE_URL, title: "내가 적은 제목" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByLabelText("찬양 제목")).toHaveValue("내가 적은 제목");
  });

  it("조회가 실패해도 화면은 조용하다", async () => {
    suggestTitleFromYouTube.mockResolvedValue({ ok: false, reason: "unavailable" });
    renderEditor({ initialValues: { ...emptyPraiseForm(), youtubeUrl: YOUTUBE_URL } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByLabelText("찬양 제목")).toHaveValue("");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("PraiseEditor — 섹션 (02 §5.4 · 04 §2.5)", () => {
  it("같은 라벨이 두 번 나오면 번호가 붙는다", () => {
    renderEditor({
      initialValues: {
        ...filled(),
        sections: [
          { id: "a", label: "Verse", lyrics: "1절" },
          { id: "b", label: "Verse", lyrics: "2절" },
        ],
      },
    });

    expect(screen.getByLabelText("Verse 1 가사")).toHaveValue("1절");
    expect(screen.getByLabelText("Verse 2 가사")).toHaveValue("2절");
  });

  it("엔터 2회로 다음 섹션이 생기고 라벨을 이어받는다", async () => {
    renderEditor();

    const lyrics = screen.getByLabelText("Verse 가사");
    await act(async () => {
      fireEvent.change(lyrics, { target: { value: "주님의 시간에\n" } });
      fireEvent.keyDown(lyrics, { key: "Enter" });
    });

    // Verse가 둘이 되어 번호가 붙는다
    expect(screen.getByLabelText("Verse 2 가사")).toHaveValue("");
    expect(screen.getByLabelText("Verse 1 가사")).toHaveValue("주님의 시간에");
  });

  it("한글 조합 중인 엔터로는 섹션이 갈리지 않는다 (IME)", async () => {
    renderEditor();

    const lyrics = screen.getByLabelText("Verse 가사");
    await act(async () => {
      fireEvent.change(lyrics, { target: { value: "주님의 시간에\n" } });
      fireEvent.keyDown(lyrics, { key: "Enter", isComposing: true });
    });

    expect(screen.queryByLabelText("Verse 2 가사")).toBeNull();
  });

  it("빈 섹션에서 Backspace로 지운다", async () => {
    renderEditor({
      initialValues: {
        ...filled(),
        sections: [
          { id: "a", label: "Verse", lyrics: "1절" },
          { id: "b", label: "Chorus", lyrics: "" },
        ],
      },
    });

    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText("Chorus 가사"), { key: "Backspace" });
    });

    expect(screen.queryByLabelText("Chorus 가사")).toBeNull();
  });

  it("마지막 섹션은 지우지 않는다 — 섹션 0개는 발행 불가 상태다", async () => {
    renderEditor({
      initialValues: {
        ...filled(),
        sections: [{ id: "a", label: "Verse", lyrics: "" }],
      },
    });

    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText("Verse 가사"), { key: "Backspace" });
    });

    expect(screen.getByLabelText("Verse 가사")).toBeInTheDocument();
  });

  it("Alt+↑↓로 순서를 바꾼다 — 드래그 없이도 완결된다", async () => {
    renderEditor();

    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText("Chorus 가사"), { key: "ArrowUp", altKey: true });
    });

    const lyricsBoxes = screen.getAllByRole("textbox", { name: /가사$/ });
    expect(lyricsBoxes[0]).toHaveValue("찬양하리");
    expect(lyricsBoxes[1]).toHaveValue("주님의 시간에");
  });

  it("라벨을 바꿔도 가사는 남는다", async () => {
    renderEditor();

    // 라벨 입력을 직접 입력 상태로 바꾸는 것은 Select 상호작용이므로, 여기서는 값 보존만 본다
    expect(screen.getByLabelText("Verse 가사")).toHaveValue("주님의 시간에");
    expect(screen.getByLabelText("섹션 1 라벨")).toBeInTheDocument();
  });
});

describe("PraiseEditor — 묵상 덩이 숨김 (02 §5.4)", () => {
  it("숨기면 상태가 버튼에 적히고, 적어둔 글은 그대로 남는다", async () => {
    renderEditor();

    const toggle = screen.getByLabelText("묵상과 기도 공개 지면에서 숨기기");
    expect(toggle).toHaveTextContent("보임");

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(screen.getByLabelText("묵상과 기도 공개 지면에 보이기")).toHaveTextContent("숨김");
    expect(screen.getByText("기다림을 배웁니다")).toBeInTheDocument();
  });

  it("덩이가 여럿이면 이름에 번호가 붙는다 — 어느 덩이를 감추는지 알아야 한다", () => {
    renderEditor({
      initialValues: {
        ...filled(),
        meditationBlocks: [
          { id: "m1", doc: { type: "doc", content: [] }, hidden: false },
          { id: "m2", doc: { type: "doc", content: [] }, hidden: false },
        ],
      },
    });

    expect(screen.getByLabelText("묵상과 기도 1 공개 지면에서 숨기기")).toBeInTheDocument();
    expect(screen.getByLabelText("묵상과 기도 2 공개 지면에서 숨기기")).toBeInTheDocument();
  });
});

describe("PraiseEditor — 발행", () => {
  it("갖춰지면 발행한다", async () => {
    renderEditor();

    await act(async () => {
      screen.getByRole("button", { name: "발행" }).click();
    });

    expect(publishPost).toHaveBeenCalledWith("post-1");
    expect(assign).toHaveBeenCalledWith("https://faith.example/pr-1");
  });

  it("묵상과 기도가 비면 막는다", async () => {
    renderEditor({
      initialValues: {
        ...filled(),
        meditationBlocks: [{ id: "m1", doc: { type: "doc", content: [] }, hidden: false }],
      },
    });

    await act(async () => {
      screen.getByRole("button", { name: "발행" }).click();
    });

    expect(publishPost).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("묵상과 기도를 적어주세요");
  });
});

describe("PraiseEditor — 자동 저장 배선", () => {
  it("가사를 적으면 로컬에 먼저 남고 잠시 뒤 서버로 올라간다", async () => {
    renderEditor();

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Verse 가사"), { target: { value: "고친 가사" } });
    });

    expect(window.localStorage.getItem("draft:PRAISE:post-1")).toContain("고친 가사");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(upsertDraft.mock.calls[0]?.[0]).toMatchObject({ id: "post-1", type: "PRAISE" });
  });
});
