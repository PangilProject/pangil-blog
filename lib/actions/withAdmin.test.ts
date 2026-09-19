import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

/**
 * 변경 액션의 인가 가드 (05 §3.2 이중 가드).
 *
 * `lib/actions` 여덟 파일에 테스트가 하나도 없었다 — **변경·인가 표면 전체가 단위 테스트 밖**이었다
 * (전수조사 개발 1-12). `middleware`만으론 부족하다: Server Action은 별도 POST 엔드포인트로 직접
 * 호출될 수 있어서, 상태를 바꾸는 액션은 예외 없이 이 래퍼를 통과해야 한다.
 *
 * 여기서 지키는 것은 둘이다 — **래퍼가 실제로 막는가**, 그리고 **빠진 액션이 없는가.**
 * 뒤엣것이 더 중요하다. 래퍼는 짧고 잘 바뀌지 않는데, **새 액션을 쓰면서 감싸는 것을 잊는 일**은
 * 언제든 일어나고 그때 화면은 멀쩡해 보인다.
 */
const getAdminUser = vi.fn();

vi.mock("@/lib/auth/adminSession", () => ({ getAdminUser: () => getAdminUser() }));

const { UnauthorizedError, withAdmin } = await import("@/lib/actions/withAdmin");

describe("withAdmin", () => {
  it("세션이 없으면 던지고, 액션은 아예 불리지 않는다", async () => {
    getAdminUser.mockResolvedValue(null);
    const action = vi.fn();

    await expect(withAdmin(action)()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(action).not.toHaveBeenCalled();
  });

  it("세션이 있으면 그 사람을 첫 인자로 넘긴다", async () => {
    const user = { id: "u-1" };
    getAdminUser.mockResolvedValue(user);
    const action = vi.fn().mockResolvedValue("done");

    await expect(withAdmin(action)("post-1", 2)).resolves.toBe("done");
    expect(action).toHaveBeenCalledWith(user, "post-1", 2);
  });
});

/**
 * **맨손 액션을 세는 자리.** `lib/actions`의 `export const`는 전부 `withAdmin(`으로 시작해야 한다.
 *
 * `auth.ts`만 예외다 — 로그인·로그아웃 자체라 세션을 요구할 수 없다. 그 파일이 목록에서 빠지는
 * 순간 이 예외도 같이 사라지므로, 예외를 이름으로 박아 둔다.
 */
const GUARD_FREE = new Set(["auth.ts", "withAdmin.ts"]);

describe("변경 액션은 예외 없이 가드를 통과한다", () => {
  it("맨손으로 내보낸 액션이 없다", async () => {
    const bare: string[] = [];

    for (const name of await readdir("lib/actions")) {
      if (!name.endsWith(".ts") || name.includes(".test.") || GUARD_FREE.has(name)) continue;

      const source = await readFile(join("lib/actions", name), "utf8");
      for (const match of source.matchAll(/export const (\w+)\s*=\s*(\w+)/g)) {
        if (match[2] !== "withAdmin") bare.push(`${name} → ${match[1]}`);
      }
    }

    expect(bare, "상태를 바꾸는 액션은 withAdmin으로 감싼다(05 §3.2)").toEqual([]);
  });
});
