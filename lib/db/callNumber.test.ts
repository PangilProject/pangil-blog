import { describe, expect, it } from "vitest";

import {
  assignCallNumber,
  type CallNumberCounterClient,
  ensureCallNumber,
} from "@/lib/db/callNumber";
import type { RecordType } from "@/lib/record/callNumber";

/**
 * 실제 원자성은 Postgres의 row lock이 보장한다. 여기서는 "우리 코드가 읽고-쓰기 대신
 * 증가 연산을 쓰는지", "이미 있는 번호를 다시 발급하지 않는지"를 고정한다.
 */
function fakeCounters(initial: Partial<Record<RecordType, number>> = {}) {
  const state = new Map<RecordType, number>(Object.entries(initial) as [RecordType, number][]);
  const calls: { type: RecordType; kind: "create" | "increment" }[] = [];

  const client: CallNumberCounterClient = {
    callNumberCounter: {
      async upsert({ where, create }) {
        const current = state.get(where.type);

        if (current === undefined) {
          state.set(where.type, create.lastNumber);
          calls.push({ type: where.type, kind: "create" });
          return { lastNumber: create.lastNumber };
        }

        const next = current + 1;
        state.set(where.type, next);
        calls.push({ type: where.type, kind: "increment" });
        return { lastNumber: next };
      },
    },
  };

  return { client, state, calls };
}

describe("assignCallNumber — 05 §5", () => {
  it("첫 발행은 1번이다", async () => {
    const { client } = fakeCounters();
    expect(await assignCallNumber(client, "QT")).toBe(1);
  });

  it("발행할 때마다 통산 번호가 하나씩 올라간다", async () => {
    const { client } = fakeCounters({ QT: 1042 });
    expect(await assignCallNumber(client, "QT")).toBe(1043);
    expect(await assignCallNumber(client, "QT")).toBe(1044);
  });

  it("타입별로 독립된 시퀀스다", async () => {
    const { client } = fakeCounters({ QT: 1042, PRAISE: 387 });
    expect(await assignCallNumber(client, "QT")).toBe(1043);
    expect(await assignCallNumber(client, "PRAISE")).toBe(388);
    expect(await assignCallNumber(client, "SERMON")).toBe(1);
  });

  it("읽고-쓰기가 아니라 증가 연산을 쓴다 — 동시 발행에서 번호가 겹치면 안 된다", async () => {
    const { client, calls } = fakeCounters({ QT: 10 });
    await assignCallNumber(client, "QT");
    expect(calls).toEqual([{ type: "QT", kind: "increment" }]);
  });

  it("연달아 발행해도 번호가 겹치지 않는다", async () => {
    const { client } = fakeCounters({ QT: 100 });
    const numbers = await Promise.all([
      assignCallNumber(client, "QT"),
      assignCallNumber(client, "QT"),
      assignCallNumber(client, "QT"),
    ]);

    expect(new Set(numbers).size).toBe(3);
    expect([...numbers].sort((a, b) => a - b)).toEqual([101, 102, 103]);
  });
});

describe("ensureCallNumber — 번호 불변 (05 §5)", () => {
  it("이미 있는 번호는 다시 발급하지 않는다 — 재공개해도 이력은 그대로다", async () => {
    const { client, calls } = fakeCounters({ QT: 1042 });
    expect(await ensureCallNumber(client, "QT", 7)).toBe(7);
    expect(calls).toEqual([]);
  });

  it("번호가 없으면(초안이었으면) 새로 발급한다", async () => {
    const { client } = fakeCounters({ QT: 1042 });
    expect(await ensureCallNumber(client, "QT", null)).toBe(1043);
  });

  it("0번도 유효한 번호로 취급한다 — falsy 함정", async () => {
    const { client, calls } = fakeCounters({ QT: 5 });
    expect(await ensureCallNumber(client, "QT", 0)).toBe(0);
    expect(calls).toEqual([]);
  });
});
