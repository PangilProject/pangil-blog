import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { uploadBackup } from "@/lib/storage/backups";

/**
 * 첫 백업에서 버킷을 만드는 경로 (06 §8).
 *
 * 이 테스트가 있는 이유: 첫 구현은 "버킷 없음"을 HTTP 404로 기다렸는데 Supabase는
 * **400 + 본문에 404**로 준다. 실제 첫 실행이 그래서 실패했다. 상태 코드로 판단하지
 * 않는다는 규칙을 여기서 고정한다.
 */

const BUCKET_MISSING = JSON.stringify({
  statusCode: "404",
  error: "Bucket not found",
  message: "Bucket not found",
  code: "NoSuchBucket",
});

function response(status: number, body = "") {
  return new Response(body, { status });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(...responses: Response[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchMock = vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(responses[calls.length - 1] ?? response(500));
  });

  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

describe("uploadBackup", () => {
  it("버킷이 있으면 한 번에 올린다", async () => {
    const calls = stubFetch(response(200));

    const result = await uploadBackup("2026-08-24", '{"posts":[]}');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://example.supabase.co/storage/v1/object/backups/db/2026-08-24.json",
    );
    expect(result.path).toBe("backups/db/2026-08-24.json");
  });

  it("400 본문의 'Bucket not found'를 보고 비공개 버킷을 만든 뒤 다시 올린다", async () => {
    const calls = stubFetch(response(400, BUCKET_MISSING), response(200), response(200));

    const result = await uploadBackup("2026-08-24", '{"posts":[]}');

    expect(calls).toHaveLength(3);
    expect(calls[1].url).toBe("https://example.supabase.co/storage/v1/bucket");
    expect(JSON.parse(String(calls[1].init.body))).toMatchObject({
      name: "backups",
      public: false,
    });
    expect(result.path).toBe("backups/db/2026-08-24.json");
  });

  it("다른 실패는 버킷을 만들지 않고 그대로 던진다", async () => {
    const calls = stubFetch(response(403, "forbidden"));

    await expect(uploadBackup("2026-08-24", "{}")).rejects.toThrow(/403 forbidden/);
    expect(calls).toHaveLength(1);
  });

  it("버킷을 만든 뒤에도 실패하면 던진다", async () => {
    stubFetch(response(400, BUCKET_MISSING), response(200), response(500, "boom"));

    await expect(uploadBackup("2026-08-24", "{}")).rejects.toThrow(/500 boom/);
  });
});
