import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 공개 지면의 색은 전부 토큰이다 (03 §2.1 · M6).
 *
 * 다크모드가 깨진 두 번의 원인이 같았다 — **하드코딩된 라이트 색**. 하나는 QT 질문 판
 * (`bg-[#fffefa]`), 하나는 찬양 가사 판이었고, 후자는 공개 지면이 에디터 컴포넌트를
 * 재사용하고 있어서 "관리 화면이니 괜찮다"고 지나쳤던 자리다.
 *
 * 그래서 파일이 아니라 **도달 범위**로 검사한다: 공개 지면이 그리는 컴포넌트에 임의 색값이
 * 있으면 실패한다. 새 컴포넌트를 공개 지면에 붙일 때 이 테스트가 먼저 말해 준다.
 */

/** 공개 지면이 그리는 컴포넌트가 사는 곳 */
const PUBLIC_DIRS = ["components/public", "components/record"];

/** 공개 지면이 다른 디렉터리에서 끌어다 쓰는 것 (components/public의 import로 확인) */
const BORROWED = ["components/editor/SectionBlock.tsx"];

/**
 * 임의 색값이 허용되는 파일과 그 이유. **줄일수록 좋다.**
 */
const ALLOWED = new Map([
  [
    "components/public/CodeBlock.tsx",
    "코드 블록은 라이트·다크 무관하게 항상 어둡다(03 §5.2) — 지면 색을 따라가면 안 된다",
  ],
  ["components/public/CopyButton.tsx", "항상 어두운 코드 블록 위에 놓이는 버튼"],
  ["components/record/PostIt.tsx", "관리 화면 전용 메모지. 공개 지면에 놓이지 않는다"],
]);

const ARBITRARY_COLOR = /(?:bg|text|border|from|via|to|fill|stroke|shadow)-\[#[0-9a-fA-F]{3,8}\]/;

async function tsxFilesIn(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await tsxFilesIn(path)));
    else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) files.push(path);
  }

  return files;
}

describe("공개 지면의 색", () => {
  it("임의 색값(bg-[#…]) 대신 토큰을 쓴다", async () => {
    const files = [...(await Promise.all(PUBLIC_DIRS.map(tsxFilesIn))).flat(), ...BORROWED];

    // 경로가 바뀌어 아무것도 검사하지 않는 상태를 막는다
    expect(files.length).toBeGreaterThan(5);

    const offenders: string[] = [];

    for (const file of files) {
      if (ALLOWED.has(file)) continue;

      const source = await readFile(file, "utf8");
      for (const line of source.split("\n")) {
        const match = line.match(ARBITRARY_COLOR);
        if (match) offenders.push(`${file}: ${match[0]}`);
      }
    }

    expect(
      offenders,
      `토큰으로 바꿔라 — 하드코딩된 색은 다크모드에서 라이트 값으로 굳는다:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("예외 목록의 파일이 실제로 존재한다", async () => {
    for (const file of ALLOWED.keys()) {
      // 파일이 사라지거나 이름이 바뀌면 예외가 조용히 무의미해진다
      await expect(readFile(file, "utf8")).resolves.toBeTruthy();
    }
  });

  it("공개 지면이 빌려 쓰는 컴포넌트 목록이 실제 import와 맞는다", async () => {
    const files = await tsxFilesIn("components/public");
    const imported = new Set<string>();

    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(/from "@\/(components\/(?:editor|ui)\/[\w/]+)"/g)) {
        imported.add(`${match[1]}.tsx`);
      }
    }

    // BORROWED가 낡으면 새로 빌려온 컴포넌트가 검사에서 빠진다 — 그게 찬양에서 일어난 일이다
    expect([...imported].sort()).toEqual([...BORROWED].sort());
  });
});
