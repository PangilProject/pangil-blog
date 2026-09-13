import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 상태 선택자가 자기 대상을 적는지 (04 §3.6.1).
 *
 * 접고 펴는 판은 자바스크립트 없이 숨긴 입력과 `has-*`로 돈다. 그런데 **대상을 안 적으면
 * 그 그룹의 아무 입력이나 잡는다** — `has-checked`는 "이 안에 켜진 것이 있나"만 묻는다.
 *
 * 실제로 그랬다: 상단 띠에 손잡이가 둘이 되자 **목차를 눌렀는데 분류가 펼쳐졌다.**
 * 두 체크박스가 같은 그룹 안에 있었고 사이드바 쪽이 대상을 안 적고 있었다.
 *
 * **조판이 없는 테스트로는 무엇이 펼쳐지는지 볼 수 없다.** 볼 수 있는 것은 대상을 안 적은
 * 선택자가 남아 있는가뿐이고, 이 줄에 손잡이가 더 붙을 때 같은 사고가 되풀이된다.
 *
 * 통과하는 형태: `has-[#panel-axis:checked]` · `group-has-[[data-toc]]` · `has-[:focus-visible]`
 * 막는 형태: `has-checked` · `group-has-checked/side`
 */

/** Tailwind의 축약형. 대상을 안 적으므로 그 그룹의 아무 입력이나 잡는다 */
const UNSCOPED = /(?<![[\w-])(?:group-)?has-checked(?:\/[\w-]+)?:/g;

async function tsxFiles(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await tsxFiles(path, out);
    else if (entry.name.endsWith(".tsx") && !entry.name.includes(".test.")) out.push(path);
  }
  return out;
}

describe("접고 펴는 선택자", () => {
  it("자기 대상을 적는다 — 안 적으면 같은 그룹의 남의 입력까지 잡는다", async () => {
    const found: string[] = [];

    for (const dir of ["components", "app"]) {
      for (const path of await tsxFiles(dir)) {
        const source = await readFile(path, "utf8");
        for (const match of source.matchAll(UNSCOPED)) {
          found.push(`${path} → ${match[0]}`);
        }
      }
    }

    expect(found, "`has-[#그-입력의-id:checked]`처럼 대상을 적는다").toEqual([]);
  });
});
