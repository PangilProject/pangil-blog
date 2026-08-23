import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QtEditor } from "@/components/editor/QtEditor";
import { emptyQtForm, type QtFormValues } from "@/lib/editor/qtForm";
import type { RichTextValue } from "@/lib/editor/richText";

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

const doc = (text: string): RichTextValue => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

/** 크롤러가 새벽에 채워둔 초안 (06 §2) — 이게 목표 동작의 출발점이다 */
function crawledValues(): QtFormValues {
  return {
    ...emptyQtForm(),
    title: "주님이 네 악을 네 머리로 돌려보내시리라",
    scriptureRef: "열왕기상 2장 41~46절",
    scriptureBody: "44. 네가 네 마음으로 아는 모든 악",
    annotations: [{ term: "네 악을 네 머리로", verseRef: "44절", body: "하나님의 공의로운 판단" }],
    questionGroups: [
      {
        group: "내용관찰",
        questions: [
          { label: "1", text: "무엇을 지키지 않았다고 말합니까?", answer: doc("명령") },
          { label: "2", text: "무엇을 스스로 알고 있다고 말합니까?", answer: { ...doc("") } },
        ],
      },
    ],
  };
}

function renderEditor(overrides: Partial<Parameters<typeof QtEditor>[0]> = {}) {
  return render(
    <QtEditor
      postId="post-1"
      initialValues={crawledValues()}
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
    .mockResolvedValue({ ok: true, id: "post-1", slug: "qt-1", callNumber: 1 });
  replace.mockReset();
  push.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("QtEditor — 가져온 값에 잠금이 없다 (02 §5)", () => {
  it("크롤 유래 필드가 모두 편집 가능한 입력으로 열린다", () => {
    renderEditor();

    expect(screen.getByLabelText("큐티 제목")).toHaveValue(
      "주님이 네 악을 네 머리로 돌려보내시리라",
    );
    expect(screen.getByLabelText("말씀 범위")).toBeEnabled();
    expect(screen.getByLabelText("말씀 본문")).toBeEnabled();
    // 질문 원문도 고칠 수 있다 — 365qt 문구가 어색한 날이 있다
    expect(screen.getByLabelText("질문 1")).toBeEnabled();
    expect(screen.getByLabelText("주석 1 용어")).toHaveValue("네 악을 네 머리로");
  });

  it("답변 칸은 질문마다 하나씩 놓인다", () => {
    renderEditor();

    expect(screen.getByLabelText("답변 1")).toBeInTheDocument();
    expect(screen.getByLabelText("답변 2")).toBeInTheDocument();
  });

  it("답변 칸의 높이는 편집 영역에 붙는다 — 감싼 div에 주면 아래 빈 자리에 커서가 안 잡힌다", () => {
    renderEditor();

    expect(screen.getByLabelText("답변 1").className).toContain("min-h-[52px]");
  });

  it("주석은 추가·삭제할 수 있다 — 없는 날도 정상이다", async () => {
    renderEditor();

    await act(async () => {
      screen.getByRole("button", { name: "주석 1 삭제" }).click();
    });
    expect(screen.queryByLabelText("주석 1 용어")).toBeNull();

    await act(async () => {
      screen.getByRole("button", { name: "+ 주석 추가" }).click();
    });
    expect(screen.getByLabelText("주석 1 용어")).toHaveValue("");
  });
});

describe("QtEditor — 크롤 표시 (03 §3)", () => {
  it("크롤 초안은 출처 띠를 보여준다", () => {
    renderEditor({ crawl: { status: "ok", fetchedAt: "06:12" } });

    expect(screen.getByText(/날마다 솟는 샘물/)).toBeInTheDocument();
    expect(screen.getByText(/06:12/)).toBeInTheDocument();
  });

  it("크롤이 실패한 날은 수동 폴백을 안내한다 (프리모템 #1)", () => {
    renderEditor({ crawl: { status: "failed" } });

    expect(screen.getByText("가져오지 못했어요")).toBeInTheDocument();
  });

  it("손으로 만든 새 글에는 띠도 '가져옴' 표시도 없다 — 없는 출처를 적지 않는다", () => {
    renderEditor({ crawl: null });

    expect(screen.queryByText(/날마다 솟는 샘물/)).toBeNull();
    expect(screen.queryByText("가져오지 못했어요")).toBeNull();
    expect(screen.queryByText("가져옴")).toBeNull();
  });
});

describe("QtEditor — 답변 공란은 경고만 (07 M2 DoD)", () => {
  it("빈 답변 수를 알려주되 발행을 막지 않는다", async () => {
    renderEditor();

    expect(screen.getByText(/아직 답을 안 쓴 질문 1개/)).toBeInTheDocument();

    await act(async () => {
      screen.getByRole("button", { name: "발행" }).click();
    });

    expect(publishPost).toHaveBeenCalledWith("post-1");
    expect(push).toHaveBeenCalledWith("/admin/posts");
  });

  it("답변이 전부 비어 있어도 발행된다", async () => {
    renderEditor({
      initialValues: { ...crawledValues(), questionGroups: emptyQtForm().questionGroups },
    });

    await act(async () => {
      screen.getByRole("button", { name: "발행" }).click();
    });

    expect(publishPost).toHaveBeenCalledWith("post-1");
  });

  it("말씀 본문이 없으면 막고 무엇이 빠졌는지 알려준다", async () => {
    renderEditor({ initialValues: { ...crawledValues(), scriptureBody: "" } });

    await act(async () => {
      screen.getByRole("button", { name: "발행" }).click();
    });

    expect(publishPost).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("말씀 본문을 적어주세요");
  });
});

describe("QtEditor — 자동 저장 배선", () => {
  it("답변을 고치면 로컬에 먼저 남고 잠시 뒤 서버로 올라간다", async () => {
    render(
      <StrictMode>
        <QtEditor postId="post-1" initialValues={crawledValues()} afterPublishHref="/admin/posts" />
      </StrictMode>,
    );

    await act(async () => {
      fireEvent.change(screen.getByLabelText("질문 1"), { target: { value: "고친 질문" } });
    });

    expect(window.localStorage.getItem("draft:QT:post-1")).toContain("고친 질문");
    expect(upsertDraft).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(upsertDraft).toHaveBeenCalledTimes(1);
    expect(upsertDraft.mock.calls[0]?.[0]).toMatchObject({ id: "post-1", type: "QT" });
  });

  it("새 글은 첫 저장에서 초안을 만들고 URL을 맞춘다", async () => {
    upsertDraft.mockResolvedValue({ ok: true, id: "created-1", savedAt: new Date() });
    renderEditor({ postId: null });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("큐티 제목"), { target: { value: "오늘의 큐티" } });
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(replace).toHaveBeenCalledWith("/admin/write/qt/created-1");
  });
});
