import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 알림이 못 나간 사실을 거슬림 목록에 남기는 자리 (프리모템 #1).
 *
 * **여기서 지키는 것은 "적는다"가 아니라 "한 번만 적는다"이다.** 웹훅이 죽어 있으면 알림마다
 * 한 줄씩 쌓이고, 그 목록의 상한은 6줄이라 금세 벽이 된다 — 읽히지 않는 목록은 없는 것과 같고,
 * 그러면 이 항목이 하려던 일과 정반대가 된다.
 *
 * 그리고 **여기서 throw하면 안 된다.** DB가 흔들려서 크롤이나 백업이 죽으면 본말이 뒤집힌다.
 */
const findFirst = vi.fn();
const create = vi.fn();

vi.mock("@/lib/db/prisma", () => ({ prisma: { nit: { findFirst, create } } }));

async function load() {
  vi.resetModules();
  return (await import("@/lib/notify/unreachable")).noteUnreachable;
}

beforeEach(() => {
  findFirst.mockReset().mockResolvedValue(null);
  create.mockReset().mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("noteUnreachable", () => {
  it("처음이면 적는다 — 무엇을 확인해야 하는지까지", async () => {
    const note = await load();

    await note("Slack에 닿지 못했어요");

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0].data.body).toContain("웹훅");
  });

  it("같은 사유가 이미 열려 있으면 또 적지 않는다 — 목록이 벽이 되면 안 읽힌다", async () => {
    const note = await load();
    findFirst.mockResolvedValue({ id: "nit-1" });

    await note("Slack에 닿지 못했어요");

    expect(create).not.toHaveBeenCalled();
  });

  it("처리해 닫은 것은 다시 적는다 — 또 안 나갔다는 뜻이다", async () => {
    const note = await load();
    // 닫힌 것은 `doneAt: null` 조건에 안 걸리므로 findFirst가 null을 돌려준다
    findFirst.mockResolvedValue(null);

    await note("Slack에 닿지 못했어요");

    expect(create).toHaveBeenCalledTimes(1);
    expect(findFirst.mock.calls[0]?.[0].where.doneAt).toBeNull();
  });

  it("DB가 흔들려도 throw하지 않는다 — 알림을 못 적은 것이 크롤을 죽일 이유는 아니다", async () => {
    const note = await load();
    findFirst.mockRejectedValue(new Error("connection lost"));

    await expect(note("Slack에 닿지 못했어요")).resolves.toBeUndefined();
  });
});
