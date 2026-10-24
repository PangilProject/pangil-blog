import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * loading.tsx가 서는 자리 래칫 (2026-10-25).
 *
 * loading.tsx는 **그 폴더의 자식 세그먼트마다** 새 Suspense 경계를 세운다(Next layout-router의
 * LoadingBoundary — 부모가 가진 loading을 자식마다 씌우고, 자식이 바뀌면 경계도 새로 선다).
 * 그래서 놓는 자리 하나가 "어느 이동에서 화면이 틀로 덮이는가"를 정한다. 잘못 놓으면 조용히
 * 틀린다 — 빌드도 테스트도 초록인 채 쓰고 있던 에디터가 덮인다.
 *
 * 늘어도 줄어도 실패한다. 늘릴 때는 아래 금지 자리를 먼저 읽는다.
 */
const EXPECTED = [
  "app/(public)/dev/(list)/loading.tsx",
  "app/(public)/dev/[slug]/loading.tsx",
  "app/(public)/faith/(list)/loading.tsx",
  "app/(public)/faith/[slug]/loading.tsx",
  "app/admin/(home)/loading.tsx",
  "app/admin/drafts/loading.tsx",
  "app/admin/edit/loading.tsx",
  "app/admin/posts/loading.tsx",
  "app/admin/settings/loading.tsx",
  "app/admin/stats/(list)/loading.tsx",
  "app/admin/stats/[postId]/loading.tsx",
  "app/admin/write/loading.tsx",
];

function findLoadingFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findLoadingFiles(path);
    return entry.name === "loading.tsx" ? [relative(process.cwd(), path)] : [];
  });
}

const found = findLoadingFiles("app").sort();

describe("loading.tsx 자리", () => {
  it("정해 둔 자리에만 있다", () => {
    expect(found).toEqual([...EXPECTED].sort());
  });

  it("에디터 타입 폴더 아래에는 없다 — 첫 저장의 [id] 이동이 쓰고 있는 에디터를 덮는다", () => {
    // 새 글은 첫 서버 저장 뒤 router.replace로 /write/{type}/{id}로 옮긴다. write/{type}/에
    // 경계가 있으면 그 이동이 새 자식(__PAGE__ → [id])이 되어 틀이 선다(app/admin/write/loading.tsx)
    expect(found.filter((path) => /^app\/admin\/write\/.+\/loading\.tsx$/.test(path))).toEqual([]);
  });

  it("세그먼트 맨 위에는 없다 — 형제 화면과 병렬 슬롯까지 덮는다", () => {
    for (const path of [
      "app/admin/loading.tsx", // 모든 관리 화면이 대시보드 틀을 먼저 보인다
      "app/admin/stats/loading.tsx", // @modal 슬롯까지 감싸 모달 자리에 목록 틀이 선다
      "app/(public)/dev/loading.tsx", // 상세로 가는 이동이 목록 틀을 먼저 보인다
      "app/(public)/faith/loading.tsx",
    ]) {
      expect(found).not.toContain(path);
    }
  });

  it("전부 서버 컴포넌트다 — 공개 지면 아일랜드를 늘리지 않는다(04 §3.6)", () => {
    for (const path of found) {
      expect(readFileSync(path, "utf8"), path).not.toMatch(/^\s*["']use client["']/m);
    }
  });
});
