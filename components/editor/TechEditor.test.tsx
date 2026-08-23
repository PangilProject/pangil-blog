import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TechEditor } from "@/components/editor/TechEditor";
import { EMPTY_TECH_FORM, type TechFormValues } from "@/lib/editor/techForm";

const upsertDraft = vi.fn();
const publishPost = vi.fn();
const replace = vi.fn();
const push = vi.fn();

vi.mock("@/lib/actions/posts", () => ({
  upsertDraft: (input: unknown) => upsertDraft(input),
  publishPost: (id: string) => publishPost(id),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
}));

const CATEGORIES = [
  { id: "cat-1", name: "회고", slug: "retrospective" },
  { id: "cat-2", name: "트러블슈팅", slug: "troubleshooting" },
];

function filled(): TechFormValues {
  return {
    title: "Next 16 캐시 무효화 정리",
    categoryId: "cat-1",
    body: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "본문이다." }] }],
    },
    excerpt: "",
    thumbnailUrl: "",
    tags: ["Next.js"],
  };
}

function renderEditor(overrides: Partial<Parameters<typeof TechEditor>[0]> = {}) {
  return render(
    <TechEditor
      postId="post-1"
      initialValues={filled()}
      categories={CATEGORIES}
      afterPublishHref="/admin/posts"
      {...overrides}
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  upsertDraft.mockReset().mockResolvedValue({ ok: true, id: "post-1", savedAt: new Date() });
  publishPost
    .mockReset()
    .mockResolvedValue({ ok: true, id: "post-1", slug: "next-16", callNumber: 1 });
  replace.mockReset();
  push.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TechEditor — 화면 구성 (02 §5.5)", () => {
  it("제목·카테고리·태그·본문이 한 지면에 있다", () => {
    renderEditor();

    expect(screen.getByLabelText("제목")).toBeInTheDocument();
    expect(screen.getByLabelText("카테고리")).toBeInTheDocument();
    expect(screen.getByLabelText("태그")).toBeInTheDocument();
    expect(screen.getByLabelText("본문")).toBeInTheDocument();
  });

  it("미리보기 창이 없다 — 좌우 분할·소스 분리 금지(ADR-001)", () => {
    renderEditor();

    expect(screen.queryByText(/미리보기/)).toBeNull();
    expect(screen.getByLabelText("본문").className).toContain("record-prose");
  });

  it("툴바는 full 구성이다 — 코드 블록까지 쓴다", () => {
    renderEditor();

    expect(screen.getByRole("button", { name: "기울임" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "구분선" })).toBeInTheDocument();
  });
});

describe("TechEditor — 태그 입력", () => {
  it("엔터로 추가하고 ✕로 지운다", async () => {
    renderEditor();

    await act(async () => {
      fireEvent.change(screen.getByLabelText("태그"), { target: { value: "Prisma" } });
      fireEvent.keyDown(screen.getByLabelText("태그"), { key: "Enter" });
    });

    expect(screen.getByRole("button", { name: "태그 Prisma 삭제" })).toBeInTheDocument();

    await act(async () => {
      screen.getByRole("button", { name: "태그 Prisma 삭제" }).click();
    });

    expect(screen.queryByRole("button", { name: "태그 Prisma 삭제" })).toBeNull();
  });

  it("같은 태그를 두 번 넣지 않는다", async () => {
    renderEditor();

    await act(async () => {
      fireEvent.change(screen.getByLabelText("태그"), { target: { value: "next.js" } });
      fireEvent.keyDown(screen.getByLabelText("태그"), { key: "Enter" });
    });

    expect(screen.getAllByRole("button", { name: /태그 .* 삭제/ })).toHaveLength(1);
  });

  it("빈 칸에서 Backspace는 마지막 태그를 지운다", async () => {
    renderEditor();

    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText("태그"), { key: "Backspace" });
    });

    expect(screen.queryByRole("button", { name: "태그 Next.js 삭제" })).toBeNull();
  });
});

describe("TechEditor — 저장 (메타는 컬럼으로)", () => {
  it("content에는 body만, 카테고리·요약·태그는 따로 보낸다", async () => {
    renderEditor();

    await act(async () => {
      fireEvent.change(screen.getByLabelText("제목"), { target: { value: "고친 제목" } });
      await vi.advanceTimersByTimeAsync(1200);
    });

    const input = upsertDraft.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      id: "post-1",
      type: "TECH",
      title: "고친 제목",
      categoryId: "cat-1",
      tags: ["Next.js"],
    });
    expect(input.content).toEqual({ kind: "TECH", body: filled().body });
    // 요약을 비워두면 본문 앞부분이 실린다(02 §5.5)
    expect(input.excerpt).toBe("본문이다.");
  });

  it("새 글은 첫 저장에서 초안을 만들고 URL을 맞춘다", async () => {
    upsertDraft.mockResolvedValue({ ok: true, id: "created-1", savedAt: new Date() });
    renderEditor({ postId: null, initialValues: EMPTY_TECH_FORM });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("제목"), { target: { value: "새 글" } });
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(replace).toHaveBeenCalledWith("/admin/write/tech/created-1");
  });
});

describe("TechEditor — 발행", () => {
  it("갖춰지면 발행한다", async () => {
    renderEditor();

    await act(async () => {
      screen.getByRole("button", { name: "발행" }).click();
    });

    expect(publishPost).toHaveBeenCalledWith("post-1");
    expect(push).toHaveBeenCalledWith("/admin/posts");
  });

  it("카테고리가 없으면 막는다", async () => {
    renderEditor({ initialValues: { ...filled(), categoryId: "" } });

    await act(async () => {
      screen.getByRole("button", { name: "발행" }).click();
    });

    expect(publishPost).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("카테고리를 골라주세요");
  });

  it("태그가 없어도 발행된다 — 권장이지 필수가 아니다", async () => {
    renderEditor({ initialValues: { ...filled(), tags: [] } });

    await act(async () => {
      screen.getByRole("button", { name: "발행" }).click();
    });

    expect(publishPost).toHaveBeenCalledWith("post-1");
  });
});

describe("TechEditor — 저장 실패 (04 §2.2)", () => {
  it("첫 저장이 발행 클릭 안에서 끝나도 발행된다 — 방금 저장했는데 막히면 안 된다", async () => {
    upsertDraft.mockResolvedValue({ ok: true, id: "created-1", savedAt: new Date() });
    renderEditor({ postId: null, initialValues: { ...filled(), title: "새 글" } });

    // 자동 저장 debounce가 터지기 전에 바로 발행한다 (flush가 초안을 만든다)
    await act(async () => {
      screen.getByLabelText("제목").focus();
      fireEvent.change(screen.getByLabelText("제목"), { target: { value: "새 글 제목" } });
      screen.getByRole("button", { name: "발행" }).click();
    });

    expect(publishPost).toHaveBeenCalledWith("created-1");
    expect(screen.queryByText(/아직 저장되지 않았어요/)).toBeNull();
  });

  it("저장이 계속 실패하면 사유를 화면에 남긴다 — 동기화 대기만 보이면 할 수 있는 일이 없다", async () => {
    upsertDraft.mockResolvedValue({ ok: false, reason: "invalid-content" });
    renderEditor();

    await act(async () => {
      fireEvent.change(screen.getByLabelText("제목"), { target: { value: "고친 제목" } });
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(screen.getByText(/invalid-content/)).toBeInTheDocument();
  });

  it("저장이 다시 성공하면 사유는 사라진다", async () => {
    upsertDraft.mockResolvedValueOnce({ ok: false, reason: "invalid-content" });
    renderEditor();

    await act(async () => {
      fireEvent.change(screen.getByLabelText("제목"), { target: { value: "하나" } });
      await vi.advanceTimersByTimeAsync(1200);
    });
    expect(screen.getByText(/invalid-content/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByLabelText("제목"), { target: { value: "둘" } });
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(screen.queryByText(/invalid-content/)).toBeNull();
  });

  it("새 글에서 저장이 두 번 나가도 초안은 하나다", async () => {
    upsertDraft.mockResolvedValue({ ok: true, id: "created-1", savedAt: new Date() });
    renderEditor({ postId: null, initialValues: EMPTY_TECH_FORM });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("제목"), { target: { value: "하나" } });
      await vi.advanceTimersByTimeAsync(1200);
      fireEvent.change(screen.getByLabelText("제목"), { target: { value: "하나 둘" } });
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(upsertDraft.mock.calls[0]?.[0]?.id).toBeUndefined();
    expect(upsertDraft.mock.calls[1]?.[0]?.id).toBe("created-1");
  });
});

describe("TechEditor — 카테고리 (02 §5.5 필드 2)", () => {
  it("저장된 카테고리가 수정 진입에서 선택돼 있다", () => {
    renderEditor({ initialValues: { ...filled(), categoryId: "cat-2" } });

    expect(screen.getByLabelText("카테고리")).toHaveTextContent("트러블슈팅");
  });

  it("고른 카테고리가 저장 payload에 실린다", async () => {
    renderEditor({ initialValues: { ...filled(), categoryId: "" } });

    await act(async () => {
      screen.getByLabelText("카테고리").focus();
      fireEvent.keyDown(screen.getByLabelText("카테고리"), { key: "Enter" });
    });
    await act(async () => {
      screen.getByText("트러블슈팅").click();
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(upsertDraft.mock.calls.at(-1)?.[0]?.categoryId).toBe("cat-2");
  });
});
