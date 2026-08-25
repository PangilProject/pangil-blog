import { describe, expect, it } from "vitest";

import { BACKUPS, backupOf } from "@/scripts/migrate-tistory/backups";
import { overrideFor } from "@/scripts/migrate-tistory/overrides";

/**
 * 백업이 둘이 되면서 생긴 함정을 고정한다.
 *
 * 두 백업의 같은 번호는 서로 다른 글이다 — 첫 백업의 134번은 학교 일지이고, 두 번째 백업의
 * 134번은 "2026년 02월 01일 주일 예배 설교"다. 예외 표가 새어 나가면 설교가 기술 글이 된다.
 */
describe("백업 등록부", () => {
  it("원본 글 ID 범위가 겹치지 않도록 오프셋이 갈린다", () => {
    const offsets = BACKUPS.map((backup) => backup.idOffset);
    expect(new Set(offsets).size).toBe(BACKUPS.length);
    // 첫 백업이 762번까지 썼다. 두 번째는 그보다 넉넉히 뒤에서 시작해야 한다
    expect(backupOf("log-2")?.idOffset).toBeGreaterThan(1_000);
  });

  it("첫 백업의 예외 표가 두 번째 백업에 붙지 않는다", () => {
    const first = backupOf("log-1");
    const second = backupOf("log-2");

    expect(overrideFor(first?.overrides ?? new Map(), 134)).toMatchObject({ type: "TECH" });
    expect(overrideFor(second?.overrides ?? new Map(), 134)).toBeNull();
  });

  it("모르는 키는 거절한다 — 폴더 이름으로 짐작하지 않는다", () => {
    expect(backupOf("pangpang")).toBeNull();
    expect(backupOf(undefined)).toBeNull();
  });
});
