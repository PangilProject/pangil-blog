import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SermonEditor } from "@/components/editor/SermonEditor";
import { EMPTY_SERMON_FORM } from "@/lib/editor/sermonForm";

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

/**
 * 설교 에디터는 예배 중에 돌아가는 화면이다. 여기서 고정하는 것은 세 가지다.
 * 1. 진입 커서가 제목에 있는가 (02 결정 로그 #10)
 * 2. 입력이 자동 저장 파이프라인에 실제로 들어가는가 (04 §2.2)
 * 3. 서버 저장이 실패해도 화면이 "동기화 대기"로 계속 쓸 수 있는 상태인가 (프리모템 #2)
 */
function renderEditor() {
  return render(
    <SermonEditor postId="post-1" initialValues={{ ...EMPTY_SERMON_FORM, title: "" }} />,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  upsertDraft.mockReset().mockResolvedValue({ ok: true, id: "post-1", savedAt: new Date() });
  publishPost
    .mockReset()
    .mockResolvedValue({ ok: true, id: "post-1", slug: "sr-1", callNumber: 1 });
  replace.mockReset();
  push.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SermonEditor — 방해 요소 제로 (02 §5.3)", () => {
  it("진입 커서는 제목에 있다", () => {
    renderEditor();
    expect(screen.getByLabelText("설교 제목")).toHaveFocus();
  });

  it("필드는 최소다 — 제목·말씀 범위·말씀 본문·본문·요약", () => {
    renderEditor();

    expect(screen.getByLabelText("설교 제목")).toBeInTheDocument();
    expect(screen.getByLabelText("말씀 범위")).toBeInTheDocument();
    expect(screen.getByLabelText("말씀 본문")).toBeInTheDocument();
    expect(screen.getByLabelText("설교 본문")).toBeInTheDocument();
    expect(screen.getByText("예배 후 요약 (선택)")).toBeInTheDocument();
  });

  it("본문에 기록 조판이 붙는다 — 없으면 서식이 적용돼도 본문과 똑같이 보인다", () => {
    renderEditor();
    expect(screen.getByLabelText("설교 본문").className).toContain("record-prose");
  });

  it("본문 높이는 편집 영역에 붙는다 — 지면 아래를 눌러도 커서가 잡혀야 한다", () => {
    renderEditor();
    expect(screen.getByLabelText("설교 본문").className).toContain("min-h-[420px]");
  });

  it("툴바는 슬림 구성이다 — 라이브 속기를 방해하지 않는다", () => {
    renderEditor();

    expect(screen.getByRole("button", { name: "굵게" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "기울임" })).toBeNull();
    expect(screen.queryByRole("button", { name: "구분선" })).toBeNull();
  });

  it("발행 확인 모달이 없다 — 끝나면 바로 발행이다(02 §3.4)", () => {
    renderEditor();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "발행" })).toBeInTheDocument();
  });
});

describe("SermonEditor — 자동 저장 배선", () => {
  it("입력하면 로컬에 먼저 남고 잠시 뒤 서버로 올라간다", async () => {
    renderEditor();

    // fireEvent.change는 React의 값 추적기를 우회해 onChange를 실제로 발화시킨다
    await act(async () => {
      fireEvent.change(screen.getByLabelText("설교 제목"), {
        target: { value: "오늘이라는 선물" },
      });
    });

    // 로컬 미러는 네트워크와 무관하게 이미 채워져 있다
    expect(window.localStorage.getItem("draft:SERMON:post-1")).toContain("오늘이라는 선물");
    expect(upsertDraft).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(upsertDraft).toHaveBeenCalledTimes(1);
    expect(upsertDraft.mock.calls[0]?.[0]).toMatchObject({
      id: "post-1",
      type: "SERMON",
      title: "오늘이라는 선물",
    });
  });

  it("임시저장 버튼은 debounce를 기다리지 않는다", async () => {
    renderEditor();

    await act(async () => {
      fireEvent.change(screen.getByLabelText("말씀 범위"), { target: { value: "전도서 9장" } });
    });

    await act(async () => {
      screen.getByRole("button", { name: "임시저장" }).click();
    });

    expect(upsertDraft).toHaveBeenCalledTimes(1);
  });

  it("서버 저장이 실패하면 동기화 대기로 표시하고 로컬 내용은 남는다", async () => {
    upsertDraft.mockRejectedValue(new Error("offline"));
    renderEditor();

    await act(async () => {
      fireEvent.change(screen.getByLabelText("설교 제목"), { target: { value: "예배당에서" } });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    // 저장 실패 사유(SaveErrorNote)도 같은 자리에 서므로 문구로 집는다
    expect(screen.getByText("로컬 저장됨 · 동기화 대기")).toBeInTheDocument();
    // 사유도 함께 남는다 — "동기화 대기"만 보이면 작성자가 할 수 있는 일이 없다
    expect(screen.getByText("offline")).toBeInTheDocument();
    expect(window.localStorage.getItem("draft:SERMON:post-1")).toContain("예배당에서");
  });
});

describe("SermonEditor — StrictMode (개발 모드 실제 환경)", () => {
  /**
   * Next dev는 StrictMode로 렌더해 effect를 실행 → 정리 → 재실행한다. 정리에서 상태 기계를
   * dispose한 뒤 같은 인스턴스를 재사용하면 이후 모든 입력이 무시된다 — 브라우저에서 저장이
   * 한 번도 나가지 않던 실제 버그이고, StrictMode 없이 렌더하던 테스트는 이를 놓쳤다.
   */
  it("effect가 두 번 실행돼도 저장이 나간다", async () => {
    render(
      <StrictMode>
        <SermonEditor postId="post-1" initialValues={{ ...EMPTY_SERMON_FORM }} />
      </StrictMode>,
    );

    await act(async () => {
      fireEvent.change(screen.getByLabelText("설교 제목"), { target: { value: "예배 노트" } });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(upsertDraft).toHaveBeenCalledTimes(1);
  });

  it("새 글(postId 없음)도 첫 저장에서 초안을 만들고 URL을 맞춘다", async () => {
    upsertDraft.mockResolvedValue({ ok: true, id: "created-1", savedAt: new Date() });

    render(
      <StrictMode>
        <SermonEditor postId={null} initialValues={{ ...EMPTY_SERMON_FORM }} />
      </StrictMode>,
    );

    await act(async () => {
      fireEvent.change(screen.getByLabelText("설교 제목"), { target: { value: "새 설교" } });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(upsertDraft.mock.calls[0]?.[0]).toMatchObject({ id: undefined, title: "새 설교" });
    expect(replace).toHaveBeenCalledWith("/admin/write/sermon/created-1");
  });
});

describe("SermonEditor — 발행", () => {
  it("필수 값이 비면 서버를 부르지 않고 무엇이 빠졌는지 알려준다", async () => {
    renderEditor();

    await act(async () => {
      screen.getByRole("button", { name: "발행" }).click();
    });

    expect(publishPost).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("설교 제목을 적어주세요");
  });

  it("갖춰지면 발행하고 그 글의 공개 지면으로 간다 (02 §3.2)", async () => {
    render(
      <SermonEditor
        postId="post-1"
        initialValues={{
          title: "오늘이라는 선물",
          scriptureRef: "전도서 9장 7~10절",
          scriptureBody: "너는 가서",
          body: { type: "doc", content: [{ type: "text", text: "속기" }] },
          summary: { type: "doc", content: [] },
        }}
      />,
    );

    await act(async () => {
      screen.getByRole("button", { name: "발행" }).click();
    });

    expect(publishPost).toHaveBeenCalledWith("post-1");
    expect(push).toHaveBeenCalledWith("/faith/sr-1");
  });

  it("발행이 실패하면 이동하지 않고 사유를 남긴다", async () => {
    publishPost.mockResolvedValue({ ok: false, reason: "invalid-content" });

    render(
      <SermonEditor
        postId="post-1"
        initialValues={{
          title: "제목",
          scriptureRef: "전도서",
          scriptureBody: "본문",
          body: { type: "doc", content: [{ type: "text", text: "속기" }] },
          summary: { type: "doc", content: [] },
        }}
      />,
    );

    await act(async () => {
      screen.getByRole("button", { name: "발행" }).click();
    });

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("invalid-content");
  });
});

describe("SermonEditor — 복구 배너 (04 §2.3)", () => {
  it("서버에 안 올라간 로컬 스냅샷이 있으면 복원 여부를 묻는다", () => {
    window.localStorage.setItem(
      "draft:SERMON:post-1",
      JSON.stringify({
        rev: 4,
        syncedRev: 1,
        value: { ...EMPTY_SERMON_FORM, title: "저장 안 된 설교" },
        updatedAt: new Date("2026-08-16T02:00:00.000Z").toISOString(),
      }),
    );

    renderEditor();

    expect(screen.getByRole("alert")).toHaveTextContent("저장 안 된 내용이 있어요");
    expect(screen.getByRole("button", { name: "복원" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "서버 버전 유지" })).toBeInTheDocument();
  });

  it("복원을 누르면 로컬 값이 폼에 들어온다", async () => {
    window.localStorage.setItem(
      "draft:SERMON:post-1",
      JSON.stringify({
        rev: 4,
        syncedRev: 1,
        value: { ...EMPTY_SERMON_FORM, title: "저장 안 된 설교" },
        updatedAt: new Date("2026-08-16T02:00:00.000Z").toISOString(),
      }),
    );

    renderEditor();

    await act(async () => {
      screen.getByRole("button", { name: "복원" }).click();
    });

    expect(screen.getByLabelText("설교 제목")).toHaveValue("저장 안 된 설교");
  });
});
