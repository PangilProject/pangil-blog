import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 렌더 검증 실패 알림 (04 §2.4).
 *
 * **여기서 지키는 것은 "보낸다"가 아니라 "한 번만 보낸다"이다.** 이 자리는 캐시 안이라 평소에는
 * 드물게 도는데, 빌드가 지면을 한꺼번에 그릴 때는 같은 글이 여러 번 걸린다. 소음이 되면 사람이
 * 안 읽고, 안 읽는 채널은 없는 것과 같다(`slack.ts`의 소음 관리와 같은 이유).
 *
 * 모듈이 상태를 들고 있으므로 매번 새로 불러온다.
 */
const notifySlack = vi.fn();

vi.mock("@/lib/notify/slack", () => ({
  notifySlack: (...args: unknown[]) => notifySlack(...args),
}));
// `after`는 응답 뒤로 미루는 것뿐이라, 여기서는 바로 실행해 무엇이 나가는지 본다
vi.mock("next/server", () => ({ after: (task: () => void) => task() }));

async function load() {
  vi.resetModules();
  const module = await import("@/lib/notify/brokenContent");
  return module.reportBrokenContent;
}

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  notifySlack.mockClear();
  // 스파이는 매번 새로 건다 — 다시 걸지 않으면 앞선 테스트의 호출까지 함께 세어진다
  logged?.mockRestore();
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("reportBrokenContent", () => {
  it("같은 글은 한 번만 알린다 — 빌드가 지면을 한꺼번에 그려도 한 줄이다", async () => {
    const report = await load();

    report("post-1", ["kind: invalid"]);
    report("post-1", ["kind: invalid"]);
    report("post-1", ["kind: invalid"]);

    expect(notifySlack).toHaveBeenCalledTimes(1);
  });

  it("글이 다르면 각각 알린다 — 눌리는 것은 같은 글의 되풀이뿐이다", async () => {
    const report = await load();

    report("post-1", ["kind: invalid"]);
    report("post-2", ["body: required"]);

    expect(notifySlack).toHaveBeenCalledTimes(2);
  });

  it("로그는 매번 남는다 — 빈도를 누르는 것은 사람에게 가는 쪽뿐이다", async () => {
    const report = await load();

    report("post-1", ["kind: invalid"]);
    report("post-1", ["kind: invalid"]);

    expect(logged).toHaveBeenCalledTimes(2);
  });

  it("어느 필드가 깨졌는지 함께 보낸다 — 글 번호만으로는 열어 봐야 안다", async () => {
    const report = await load();

    report("post-9", ["content.kind: invalid", "content.body: required"]);

    expect(notifySlack).toHaveBeenCalledWith(expect.stringContaining("post-9"));
    expect(notifySlack).toHaveBeenCalledWith(expect.stringContaining("content.kind"));
  });
});
