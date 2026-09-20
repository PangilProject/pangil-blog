import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 공개 지면 클라이언트 아일랜드 래칫 (04 §3.6 · ADR-004).
 *
 * 한도는 **UI 7개 + 그리지 않는 것 2개**다. 이 숫자가 한때 세 문서에서 제각각이었고
 * (CLAUDE.md "3개" · 04 "5+1" · 실제 6), 숫자가 셋이면 "넘었나"를 판단할 수가 없어
 * 2026-09-13에 하나로 정본화했다. 그때 고친 것은 문장이었고, **이 테스트가 그 문장을 잠근다.**
 *
 * 늘어도 줄어도 실패한다. 늘 때는 한 번 묻고(그 물음이 ADR이다), 줄 때는 문서에서 지운다.
 *
 * `components/record`는 세지 않는다 — 공개·관리 양쪽이 함께 쓰는 서랍이라
 * 여기서 세면 관리 화면 변경이 공개 예산을 흔든다.
 */
const PUBLIC_ISLAND_ROOTS = ["components/public", "components/hub"];

/** 그리는 것이 있는 아일랜드. 늘리려면 ADR이 먼저다 */
const DRAWING_ISLANDS = [
  "components/hub/HubStage.tsx", // 허브 연출 (ADR-004)
  "components/public/CopyButton.tsx", // 코드 복사 버튼
  "components/public/OwnerMeditation.tsx", // 감춘 묵상 덩이
  "components/public/PostAdminControls.tsx", // 상세의 관리 컨트롤
  "components/public/ThemeToggle.tsx", // 다크모드 토글
  "components/public/Toc.tsx", // TOC 하이라이트
  "components/public/YouTubeLite.tsx", // YouTube lite
];

/**
 * 렌더 트리에 노드를 남기지 않는 것들. 읽고·쏘고·끝, 또는 읽고·심고·끝에서 멈춰야 한다 —
 * 여기에 상태·설정·개인화를 얹으면 세는 쪽으로 옮긴다.
 */
const NON_DRAWING_ISLANDS = [
  "components/public/StatBeacon.tsx", // 통계 비콘
  "components/public/ThemeProvider.tsx", // 테마 공급자
];

function findClientComponents(): string[] {
  const found: string[] = [];

  for (const root of PUBLIC_ISLAND_ROOTS) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
      if (entry.name.endsWith(".test.tsx")) continue;

      const path = join(root, entry.name);
      if (/^\s*["']use client["']/m.test(readFileSync(path, "utf8"))) {
        found.push(path);
      }
    }
  }

  return found.sort();
}

describe("공개 지면 클라이언트 아일랜드", () => {
  it("문서에 적힌 것과 정확히 같다 (04 §3.6)", () => {
    expect(findClientComponents()).toEqual([...DRAWING_ISLANDS, ...NON_DRAWING_ISLANDS].sort());
  });

  it("그리는 것은 7개다", () => {
    expect(DRAWING_ISLANDS).toHaveLength(7);
  });

  it("허브의 연출은 하나로 묶여 있다 (ADR-004 대가 #2)", () => {
    const hubIslands = findClientComponents().filter((path) => path.startsWith("components/hub/"));

    // 진행률·색 보간·물리·커서가 넷으로 흩어지면 이 예산은 숫자만 남는다
    expect(hubIslands).toEqual(["components/hub/HubStage.tsx"]);
  });
});
